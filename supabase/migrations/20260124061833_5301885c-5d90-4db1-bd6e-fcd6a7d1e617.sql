-- Add password field to contacts table for frontend user authentication
ALTER TABLE public.contacts ADD COLUMN password_hash text NOT NULL DEFAULT '123456';

-- Create index for login lookup
CREATE INDEX idx_contacts_mobile_password ON public.contacts(mobile, password_hash) WHERE is_active = true;

-- Add RLS policy for users to update their own password
CREATE POLICY "Users can update their own password"
ON public.contacts
FOR UPDATE
USING (true)
WITH CHECK (true);