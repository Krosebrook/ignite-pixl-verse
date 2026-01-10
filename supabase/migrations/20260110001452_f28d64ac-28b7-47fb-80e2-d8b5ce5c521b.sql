-- Fix Security Definer Views by setting them to SECURITY INVOKER
-- This ensures RLS policies are enforced based on the querying user, not the view creator

ALTER VIEW public.marketplace_items_preview SET (security_invoker = on);
ALTER VIEW public.integrations_admin_view SET (security_invoker = on);