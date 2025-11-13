-- Step 1.1: Restrict Profiles RLS Policy
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Create more restrictive policy: users can only view their own profile or profiles of org members
CREATE POLICY "Users can view own and org members' profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid() OR
  id IN (
    SELECT m2.user_id 
    FROM public.members m1
    JOIN public.members m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid()
  )
);

-- Step 1.2: Add Publication Status to Library Items
-- Add publication_status column with constraint
ALTER TABLE public.library_items 
ADD COLUMN IF NOT EXISTS publication_status TEXT DEFAULT 'public'
CHECK (publication_status IN ('public', 'org', 'private'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_library_items_publication_status 
ON public.library_items(publication_status);

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view library items" ON public.library_items;

-- Create policy that respects publication status
CREATE POLICY "Users can view published or installed library items"
ON public.library_items FOR SELECT TO authenticated
USING (
  publication_status = 'public' OR
  (publication_status = 'org' AND EXISTS (
    SELECT 1 FROM public.library_installs li
    JOIN public.members m ON li.org_id = m.org_id
    WHERE li.item_id = library_items.id
    AND m.user_id = auth.uid()
  )) OR
  (publication_status = 'private' AND EXISTS (
    SELECT 1 FROM public.library_installs li
    WHERE li.item_id = library_items.id
    AND li.installed_by = auth.uid()
  ))
);