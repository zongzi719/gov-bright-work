-- Create purchase request items table for multi-item support
CREATE TABLE public.purchase_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  supply_id UUID NOT NULL REFERENCES public.office_supplies(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage purchase request items"
ON public.purchase_request_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert purchase request items"
ON public.purchase_request_items
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can view purchase request items"
ON public.purchase_request_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Make legacy columns in purchase_requests nullable
ALTER TABLE public.purchase_requests 
ALTER COLUMN supply_id DROP NOT NULL,
ALTER COLUMN quantity DROP NOT NULL;

ALTER TABLE public.purchase_requests 
ALTER COLUMN supply_id SET DEFAULT NULL,
ALTER COLUMN quantity SET DEFAULT NULL;