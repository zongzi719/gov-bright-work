-- Make supply_id and quantity nullable since we now use the detail table
ALTER TABLE public.supply_requisitions 
ALTER COLUMN supply_id DROP NOT NULL,
ALTER COLUMN quantity DROP NOT NULL;

-- Set default values
ALTER TABLE public.supply_requisitions 
ALTER COLUMN supply_id SET DEFAULT NULL,
ALTER COLUMN quantity SET DEFAULT NULL;