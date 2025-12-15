-- Drop the problematic trigger that causes RLS recursion
DROP TRIGGER IF EXISTS on_org_created ON public.orgs;
DROP FUNCTION IF EXISTS public.handle_new_org();

-- Create a security definer function to create org + member atomically
CREATE OR REPLACE FUNCTION public.create_org_with_owner(
  p_name TEXT,
  p_slug TEXT,
  p_timezone TEXT DEFAULT 'UTC',
  p_locale TEXT DEFAULT 'en-US'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Create the organization
  INSERT INTO public.orgs (name, slug, owner_id, timezone, locale)
  VALUES (p_name, p_slug, v_user_id, p_timezone, p_locale)
  RETURNING id INTO v_org_id;
  
  -- Add the user as owner member
  INSERT INTO public.members (org_id, user_id, role, granted_by)
  VALUES (v_org_id, v_user_id, 'owner', v_user_id);
  
  RETURN v_org_id;
END;
$$;