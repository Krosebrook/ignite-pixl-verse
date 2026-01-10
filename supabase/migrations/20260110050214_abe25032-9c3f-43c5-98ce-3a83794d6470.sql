-- Fix overly permissive RLS policy on security_activity_log table
-- The current INSERT policy has WITH CHECK (true) which is too permissive

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert activity logs" ON public.security_activity_log;

-- Create a proper policy that only allows users to insert their own security events
-- This ensures users can only log events for their own user_id
CREATE POLICY "Users can insert their own security activity"
ON public.security_activity_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also allow anon to insert for pre-auth events like failed logins
-- but only with proper validation (the user_id must be provided)
CREATE POLICY "Anon can insert security activity with valid user_id"
ON public.security_activity_log
FOR INSERT
TO anon
WITH CHECK (user_id IS NOT NULL);