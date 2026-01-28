-- 创建办公用品采购申请表
CREATE TABLE public.supply_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  total_amount NUMERIC DEFAULT 0,
  applicant_id UUID NOT NULL,
  applicant_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建办公用品采购明细表
CREATE TABLE public.supply_purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.supply_purchases(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.supply_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_purchase_items ENABLE ROW LEVEL SECURITY;

-- RLS 策略 for supply_purchases
CREATE POLICY "Admins can manage supply purchases"
  ON public.supply_purchases FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert supply purchases"
  ON public.supply_purchases FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update supply purchases"
  ON public.supply_purchases FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can view supply purchases"
  ON public.supply_purchases FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS 策略 for supply_purchase_items
CREATE POLICY "Admins can manage supply purchase items"
  ON public.supply_purchase_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert supply purchase items"
  ON public.supply_purchase_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view supply purchase items"
  ON public.supply_purchase_items FOR SELECT
  USING (auth.uid() IS NOT NULL);