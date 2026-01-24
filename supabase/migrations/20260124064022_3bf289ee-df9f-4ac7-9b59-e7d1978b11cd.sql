-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can update their own password" ON public.contacts;

-- Note: Password updates will be handled through admin or a dedicated edge function
-- The existing admin policy already covers management needs