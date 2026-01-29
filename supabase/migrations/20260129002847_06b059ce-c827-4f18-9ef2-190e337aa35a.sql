-- Create file_transfers table for persisting file transfer records
CREATE TABLE public.file_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  send_unit TEXT NOT NULL,
  send_unit_id UUID REFERENCES public.organizations(id),
  doc_number TEXT NOT NULL,
  security_level TEXT NOT NULL DEFAULT '公开',
  urgency TEXT NOT NULL DEFAULT '普通',
  source_unit TEXT,
  send_type TEXT DEFAULT '不限制份数',
  contact_person TEXT,
  contact_phone TEXT,
  document_date DATE,
  copies INTEGER DEFAULT 1,
  confidential_period TEXT,
  main_unit TEXT,
  sign_leader TEXT,
  sign_date DATE,
  file_type TEXT DEFAULT '中央文件',
  notify_type TEXT DEFAULT '不通知',
  copy_unit TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT '待签收',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.file_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for file_transfers - allow public access since using contact-based auth
CREATE POLICY "Anyone can view file transfers"
  ON public.file_transfers
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert file transfers"
  ON public.file_transfers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update file transfers"
  ON public.file_transfers
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete file transfers"
  ON public.file_transfers
  FOR DELETE
  USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_file_transfers_updated_at
  BEFORE UPDATE ON public.file_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for file transfer attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('file-transfers', 'file-transfers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for file-transfers bucket
CREATE POLICY "Anyone can view file transfer attachments"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'file-transfers');

CREATE POLICY "Anyone can upload file transfer attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'file-transfers');

CREATE POLICY "Anyone can delete file transfer attachments"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'file-transfers');