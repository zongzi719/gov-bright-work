-- 创建库存变动记录表
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_id UUID NOT NULL REFERENCES public.office_supplies(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase_in', 'requisition_out', 'adjustment')),
  quantity INTEGER NOT NULL,
  before_stock INTEGER NOT NULL,
  after_stock INTEGER NOT NULL,
  reference_type TEXT, -- 'purchase_request', 'supply_purchase', 'supply_requisition'
  reference_id UUID,
  operator_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 添加索引
CREATE INDEX idx_stock_movements_supply_id ON public.stock_movements(supply_id);
CREATE INDEX idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- 启用RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 管理员可以管理库存变动记录
CREATE POLICY "Admins can manage stock movements"
ON public.stock_movements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 任何人可以插入库存变动记录（用于审批完成后自动记录）
CREATE POLICY "Anyone can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (true);

-- 认证用户可以查看库存变动记录
CREATE POLICY "Authenticated users can view stock movements"
ON public.stock_movements
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 给 supply_purchase_items 添加关联库存的字段
ALTER TABLE public.supply_purchase_items ADD COLUMN IF NOT EXISTS supply_id UUID REFERENCES public.office_supplies(id);
ALTER TABLE public.supply_purchase_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '个';
ALTER TABLE public.supply_purchase_items ADD COLUMN IF NOT EXISTS specification TEXT;