-- 创建采购申请状态枚举
CREATE TYPE public.purchase_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

-- 创建领用状态枚举
CREATE TYPE public.requisition_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

-- 办公用品表
CREATE TABLE public.office_supplies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    specification TEXT,
    unit TEXT NOT NULL DEFAULT '个',
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 采购申请表
CREATE TABLE public.purchase_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    supply_id UUID NOT NULL REFERENCES public.office_supplies(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    reason TEXT,
    status purchase_status NOT NULL DEFAULT 'pending',
    requested_by TEXT NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 领用记录表
CREATE TABLE public.supply_requisitions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    supply_id UUID NOT NULL REFERENCES public.office_supplies(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    requisition_by TEXT NOT NULL,
    status requisition_status NOT NULL DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用RLS
ALTER TABLE public.office_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_requisitions ENABLE ROW LEVEL SECURITY;

-- office_supplies RLS策略
CREATE POLICY "Admins can manage office supplies"
ON public.office_supplies
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view office supplies"
ON public.office_supplies
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- purchase_requests RLS策略
CREATE POLICY "Admins can manage purchase requests"
ON public.purchase_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view purchase requests"
ON public.purchase_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- supply_requisitions RLS策略
CREATE POLICY "Admins can manage supply requisitions"
ON public.supply_requisitions
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view supply requisitions"
ON public.supply_requisitions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 创建更新时间戳触发器
CREATE TRIGGER update_office_supplies_updated_at
    BEFORE UPDATE ON public.office_supplies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_requests_updated_at
    BEFORE UPDATE ON public.purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supply_requisitions_updated_at
    BEFORE UPDATE ON public.supply_requisitions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();