-- Fix overly permissive RLS policy on ip_rate_limits table
-- The current policy allows ALL operations with USING (true) and WITH CHECK (true)
-- This should be restricted to service role only via database functions

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage IP rate limits" ON public.ip_rate_limits;

-- ip_rate_limits should only be managed by database functions (check_ip_rate_limit, reset_ip_rate_limit)
-- which run with SECURITY DEFINER and bypass RLS
-- No direct client access should be allowed

-- Create a restrictive policy that denies all direct client access
-- The existing database functions use SECURITY DEFINER so they bypass RLS

-- Policy for SELECT: No direct client access (functions handle this)
CREATE POLICY "No direct client access for select"
ON public.ip_rate_limits
FOR SELECT
TO authenticated, anon
USING (false);

-- Policy for INSERT: No direct client access (functions handle this)
CREATE POLICY "No direct client access for insert"
ON public.ip_rate_limits
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- Policy for UPDATE: No direct client access (functions handle this)
CREATE POLICY "No direct client access for update"
ON public.ip_rate_limits
FOR UPDATE
TO authenticated, anon
USING (false);

-- Policy for DELETE: No direct client access (functions handle this)
CREATE POLICY "No direct client access for delete"
ON public.ip_rate_limits
FOR DELETE
TO authenticated, anon
USING (false);