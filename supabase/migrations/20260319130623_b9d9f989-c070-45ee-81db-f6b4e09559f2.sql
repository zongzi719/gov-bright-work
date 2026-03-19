
-- Add medical certificate URL column to absence_records
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS medical_certificate_url TEXT DEFAULT NULL;

-- Create storage bucket for medical certificates
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-certificates', 'medical-certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload medical certificates
CREATE POLICY "Anyone can view medical certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'medical-certificates');

CREATE POLICY "Authenticated users can upload medical certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'medical-certificates');

CREATE POLICY "Users can delete their own medical certificates"
ON storage.objects FOR DELETE
USING (bucket_id = 'medical-certificates');
