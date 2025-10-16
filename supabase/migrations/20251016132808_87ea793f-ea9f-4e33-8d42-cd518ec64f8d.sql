-- ===================================================================
-- SECURITY FIX: Consolidate to single role management system (CORRECTED)
-- Removes user_roles table, expands members to 5 roles
-- Fixes increment_usage_tokens authorization
-- Enhances get_marketplace_content security
-- ===================================================================

-- 1. Drop trigger first to stop new writes to user_roles
DROP TRIGGER IF EXISTS on_org_created ON public.orgs;

-- 2. Drop policies that reference is_org_admin explicitly
DROP POLICY IF EXISTS "Org admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Org admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Org admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Org members can view roles in their org" ON public.user_roles;

-- 3. Now drop the user_roles table and related objects
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, uuid, app_role);
DROP TYPE IF EXISTS public.app_role;

-- 4. Expand members table to support 5 roles
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_role_check;
ALTER TABLE public.members ADD CONSTRAINT members_role_check 
  CHECK (role IN ('owner', 'admin', 'editor', 'member', 'viewer'));

-- Add granted_by for audit trail
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id);

-- 5. Recreate handle_new_org to ONLY write to members
CREATE OR REPLACE FUNCTION public.handle_new_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert owner role into members table ONLY (not user_roles)
  INSERT INTO public.members (user_id, org_id, role, granted_by)
  VALUES (NEW.owner_id, NEW.id, 'owner', NEW.owner_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_org_created
  AFTER INSERT ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_org();

-- 6. Fix increment_usage_tokens - ADD AUTHORIZATION CHECK
CREATE OR REPLACE FUNCTION public.increment_usage_tokens(p_org_id uuid, p_tokens bigint)
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_new_used BIGINT;
  v_limit BIGINT;
BEGIN
  -- CRITICAL FIX: Verify caller belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid() AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Not authorized for this organization';
  END IF;
  
  -- Lock and update atomically
  UPDATE public.usage_credits
  SET used_tokens = used_tokens + p_tokens, updated_at = now()
  WHERE org_id = p_org_id
  RETURNING used_tokens, hard_limit_tokens INTO v_new_used, v_limit;
  
  IF NOT FOUND THEN
    INSERT INTO public.usage_credits (org_id, used_tokens)
    VALUES (p_org_id, p_tokens)
    RETURNING used_tokens, hard_limit_tokens INTO v_new_used, v_limit;
  END IF;
  
  v_result := jsonb_build_object(
    'ok', v_new_used <= v_limit,
    'used_tokens', v_new_used,
    'remaining_tokens', GREATEST(0, v_limit - v_new_used),
    'limit', v_limit
  );
  
  RETURN v_result;
END;
$$;

-- 7. Enhance get_marketplace_content - Generic errors + download tracking
-- First add downloaded_at column to marketplace_purchases
ALTER TABLE public.marketplace_purchases 
ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.get_marketplace_content(p_item_id uuid)
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_content jsonb;
  v_price integer;
  v_user_orgs uuid[];
  v_first_download boolean;
BEGIN
  -- Get user's organizations
  SELECT ARRAY_AGG(org_id) INTO v_user_orgs
  FROM public.members
  WHERE user_id = auth.uid();
  
  IF v_user_orgs IS NULL THEN
    RAISE EXCEPTION 'Access denied';  -- Generic error (don't reveal membership status)
  END IF;
  
  -- Get item price
  SELECT price_cents INTO v_price
  FROM public.marketplace_items
  WHERE id = p_item_id;
  
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Access denied';  -- Generic error (don't reveal if item exists)
  END IF;
  
  -- Check if item is free or if user has purchased it
  IF v_price > 0 THEN
    IF NOT EXISTS (
      SELECT 1 
      FROM public.marketplace_purchases 
      WHERE item_id = p_item_id 
        AND org_id = ANY(v_user_orgs)
        AND payment_status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Access denied';  -- Generic error (don't reveal purchase status)
    END IF;
  END IF;
  
  -- Return content
  SELECT content INTO v_content
  FROM public.marketplace_items
  WHERE id = p_item_id;
  
  -- Track first download per org (prevent download count spam)
  UPDATE public.marketplace_purchases
  SET downloaded_at = COALESCE(downloaded_at, NOW())
  WHERE item_id = p_item_id
    AND org_id = ANY(v_user_orgs)
    AND downloaded_at IS NULL
  RETURNING TRUE INTO v_first_download;
  
  -- Only increment counter on first download
  IF v_first_download THEN
    UPDATE public.marketplace_items
    SET downloads = downloads + 1
    WHERE id = p_item_id;
  END IF;
  
  -- Audit log for content access
  INSERT INTO public.audit_log (user_id, org_id, action, resource_type, resource_id)
  VALUES (
    auth.uid(),
    v_user_orgs[1],
    'marketplace_content_access',
    'marketplace_item',
    p_item_id::text
  );
  
  RETURN v_content;
END;
$$;