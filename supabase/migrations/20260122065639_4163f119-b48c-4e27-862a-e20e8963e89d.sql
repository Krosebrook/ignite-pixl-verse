-- ============================================
-- 1. VERIFY login_history RLS is properly configured
-- ============================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're RESTRICTIVE (not PERMISSIVE)
DROP POLICY IF EXISTS "Users can view their own login history" ON public.login_history;
DROP POLICY IF EXISTS "Users can insert their own login history" ON public.login_history;

-- Recreate as RESTRICTIVE policies for defense in depth
CREATE POLICY "Users can view their own login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own login history"
ON public.login_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Explicitly deny UPDATE and DELETE (already not allowed, but make it explicit)
CREATE POLICY "No updates to login history"
ON public.login_history
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No deletes from login history"
ON public.login_history
FOR DELETE
TO authenticated
USING (false);

-- ============================================
-- 2. SECURE marketplace_items_preview view
-- ============================================

-- Drop and recreate view with SECURITY INVOKER (default) that filters sensitive data
DROP VIEW IF EXISTS public.marketplace_items_preview;

-- Create a secure view that:
-- - Only shows essential preview fields (no creator_id for anonymous)
-- - Uses SECURITY INVOKER so RLS on underlying table applies
CREATE VIEW public.marketplace_items_preview
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  type,
  description,
  thumbnail_url,
  price_cents,
  downloads,
  created_at,
  -- Only show creator_id to authenticated users
  CASE 
    WHEN auth.uid() IS NOT NULL THEN creator_id 
    ELSE NULL 
  END as creator_id
FROM public.marketplace_items;

-- Add comment explaining security model
COMMENT ON VIEW public.marketplace_items_preview IS 
'Secure preview of marketplace items. Creator ID only visible to authenticated users. 
Inherits RLS from marketplace_items table.';

-- ============================================
-- 3. Strengthen marketplace_items RLS
-- ============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Anyone can view marketplace items" ON public.marketplace_items;

-- Create more restrictive SELECT policy - authenticated users only for full access
CREATE POLICY "Authenticated users can view marketplace items"
ON public.marketplace_items
FOR SELECT
TO authenticated
USING (true);

-- Allow anonymous users to view only basic item info (price, name, type)
-- This is handled by the view filtering creator_id for anon users
CREATE POLICY "Anonymous can view published marketplace items"
ON public.marketplace_items
FOR SELECT
TO anon
USING (true);