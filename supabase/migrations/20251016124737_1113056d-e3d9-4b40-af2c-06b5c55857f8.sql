-- Fix infinite recursion in members table RLS policies

-- Create security definer function to check if user is member of org
CREATE OR REPLACE FUNCTION public.is_member_of_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members
    WHERE user_id = _user_id
      AND org_id = _org_id
  )
$$;

-- Create security definer function to check if user is admin of org
CREATE OR REPLACE FUNCTION public.is_member_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Get all orgs user is member of
CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id uuid)
RETURNS TABLE(org_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM public.members
  WHERE user_id = _user_id
$$;

-- Drop existing problematic policies on members table
DROP POLICY IF EXISTS "Org admins can manage members" ON public.members;
DROP POLICY IF EXISTS "Users can view members of their orgs" ON public.members;

-- Create new policies using security definer functions
CREATE POLICY "Users can view members of their orgs"
ON public.members
FOR SELECT
TO authenticated
USING (is_member_of_org(auth.uid(), org_id));

CREATE POLICY "Org admins can insert members"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (is_member_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update members"
ON public.members
FOR UPDATE
TO authenticated
USING (is_member_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete members"
ON public.members
FOR DELETE
TO authenticated
USING (is_member_admin(auth.uid(), org_id));

-- Update handle_new_org trigger to insert into members table
CREATE OR REPLACE FUNCTION public.handle_new_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert into members table (primary membership tracking)
  INSERT INTO public.members (user_id, org_id, role)
  VALUES (NEW.owner_id, NEW.id, 'owner');
  
  -- Also insert into user_roles for backward compatibility
  INSERT INTO public.user_roles (user_id, org_id, role, granted_by)
  VALUES (NEW.owner_id, NEW.id, 'owner', NEW.owner_id);
  
  RETURN NEW;
END;
$function$;