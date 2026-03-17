-- Add 'custom_approval' to todo_business_type enum for dynamic forms
ALTER TYPE public.todo_business_type ADD VALUE IF NOT EXISTS 'custom_approval';