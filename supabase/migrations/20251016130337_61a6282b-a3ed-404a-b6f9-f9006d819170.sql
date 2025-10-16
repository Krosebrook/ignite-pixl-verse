-- Migration: Marketplace purchase verification and content protection
-- Implements purchase tracking and restricts content access to paid items

-- 1. Create marketplace_purchases table to track user purchases
CREATE TABLE IF NOT EXISTS public.marketplace_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  purchase_date timestamptz NOT NULL DEFAULT now(),
  amount_cents integer NOT NULL,
  payment_status text NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'refunded')),
  UNIQUE(org_id, item_id)
);

-- 2. Enable RLS on purchases table
ALTER TABLE public.marketplace_purchases ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies for purchases - users can view their org's purchases
CREATE POLICY marketplace_purchases_select_org_members
ON public.marketplace_purchases
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM public.members WHERE user_id = auth.uid()
  )
);

-- 4. Allow authenticated users to insert purchases (would be done via Stripe webhook in production)
CREATE POLICY marketplace_purchases_insert_authenticated
ON public.marketplace_purchases
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND org_id IN (
    SELECT org_id FROM public.members WHERE user_id = auth.uid()
  )
);

-- 5. Create metadata-only view for browsing marketplace
CREATE OR REPLACE VIEW public.marketplace_items_preview AS
SELECT 
  id, 
  name, 
  type, 
  description, 
  thumbnail_url, 
  price_cents, 
  downloads, 
  creator_id, 
  created_at
FROM public.marketplace_items;

-- 6. Grant access to preview view
GRANT SELECT ON public.marketplace_items_preview TO authenticated, anon;

-- 7. Create secure RPC to fetch content after purchase verification
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
BEGIN
  -- Get user's organizations
  SELECT ARRAY_AGG(org_id) INTO v_user_orgs
  FROM public.members
  WHERE user_id = auth.uid();
  
  IF v_user_orgs IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;
  
  -- Get item price
  SELECT price_cents INTO v_price
  FROM public.marketplace_items
  WHERE id = p_item_id;
  
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Item not found';
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
      RAISE EXCEPTION 'Purchase required to access this content';
    END IF;
  END IF;
  
  -- Return content
  SELECT content INTO v_content
  FROM public.marketplace_items
  WHERE id = p_item_id;
  
  -- Increment download count
  UPDATE public.marketplace_items
  SET downloads = downloads + 1
  WHERE id = p_item_id;
  
  RETURN v_content;
END;
$$;

-- 8. Add index for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_org_item 
ON public.marketplace_purchases(org_id, item_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_user 
ON public.marketplace_purchases(user_id);

-- Rollback plan (run these commands if you need to undo this migration):
-- DROP FUNCTION IF EXISTS public.get_marketplace_content(uuid);
-- DROP VIEW IF EXISTS public.marketplace_items_preview;
-- DROP POLICY IF EXISTS marketplace_purchases_insert_authenticated ON public.marketplace_purchases;
-- DROP POLICY IF EXISTS marketplace_purchases_select_org_members ON public.marketplace_purchases;
-- DROP TABLE IF EXISTS public.marketplace_purchases;