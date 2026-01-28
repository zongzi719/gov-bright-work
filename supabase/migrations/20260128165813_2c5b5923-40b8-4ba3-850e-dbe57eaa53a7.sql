-- Add new columns to purchase_requests table
ALTER TABLE public.purchase_requests
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS procurement_method text,
ADD COLUMN IF NOT EXISTS funding_source text,
ADD COLUMN IF NOT EXISTS funding_detail text,
ADD COLUMN IF NOT EXISTS budget_amount numeric,
ADD COLUMN IF NOT EXISTS expected_completion_date date,
ADD COLUMN IF NOT EXISTS purpose text;

-- Modify purchase_request_items table to support custom items
ALTER TABLE public.purchase_request_items
ADD COLUMN IF NOT EXISTS item_name text,
ADD COLUMN IF NOT EXISTS specification text,
ADD COLUMN IF NOT EXISTS unit text DEFAULT '个',
ADD COLUMN IF NOT EXISTS category_link text,
ADD COLUMN IF NOT EXISTS remarks text;

-- Make supply_id nullable since we now support custom items
ALTER TABLE public.purchase_request_items
ALTER COLUMN supply_id DROP NOT NULL;