-- 添加 supply_purchase 到 todo_business_type 枚举
ALTER TYPE public.todo_business_type ADD VALUE IF NOT EXISTS 'supply_purchase';