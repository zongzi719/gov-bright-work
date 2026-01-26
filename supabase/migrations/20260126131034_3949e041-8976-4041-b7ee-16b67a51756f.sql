-- Create a table for supply requisition items (detail lines)
CREATE TABLE public.supply_requisition_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id UUID NOT NULL REFERENCES public.supply_requisitions(id) ON DELETE CASCADE,
  supply_id UUID NOT NULL REFERENCES public.office_supplies(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supply_requisition_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage requisition items"
ON public.supply_requisition_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert requisition items"
ON public.supply_requisition_items
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can view requisition items"
ON public.supply_requisition_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create index for performance
CREATE INDEX idx_supply_requisition_items_requisition_id ON public.supply_requisition_items(requisition_id);