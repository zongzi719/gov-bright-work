-- 1. 领用申请添加领用日期字段
ALTER TABLE public.supply_requisitions 
ADD COLUMN requisition_date date NOT NULL DEFAULT CURRENT_DATE;

-- 2. 采购申请添加采购日期、单价、总额字段
ALTER TABLE public.purchase_requests 
ADD COLUMN purchase_date date NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN unit_price numeric(10,2) DEFAULT 0,
ADD COLUMN total_amount numeric(10,2) DEFAULT 0;