-- Create a table for notice carousel images
CREATE TABLE public.notice_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notice_images ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage notice images" 
ON public.notice_images 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active notice images" 
ON public.notice_images 
FOR SELECT 
USING (is_active = true);

-- Add trigger for updated_at
CREATE TRIGGER update_notice_images_updated_at
BEFORE UPDATE ON public.notice_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();