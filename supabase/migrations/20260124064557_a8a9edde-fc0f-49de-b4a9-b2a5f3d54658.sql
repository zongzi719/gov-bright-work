-- Add policy to allow anonymous login verification (only select necessary fields for auth)
CREATE POLICY "Allow login verification"
ON public.contacts
FOR SELECT
USING (true);