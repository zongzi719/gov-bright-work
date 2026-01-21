-- Create leave_balances table for vacation management
CREATE TABLE public.leave_balances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    annual_leave_total NUMERIC(5,1) NOT NULL DEFAULT 5,
    annual_leave_used NUMERIC(5,1) NOT NULL DEFAULT 0,
    sick_leave_total NUMERIC(5,1) NOT NULL DEFAULT 10,
    sick_leave_used NUMERIC(5,1) NOT NULL DEFAULT 0,
    personal_leave_total NUMERIC(5,1) NOT NULL DEFAULT 5,
    personal_leave_used NUMERIC(5,1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(contact_id, year)
);

-- Enable RLS
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage leave balances"
ON public.leave_balances
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view leave balances"
ON public.leave_balances
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_leave_balances_updated_at
    BEFORE UPDATE ON public.leave_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create leave_type enum for categorizing leave requests
CREATE TYPE public.leave_type AS ENUM ('annual', 'sick', 'personal');

-- Add leave_type column to absence_records for tracking which leave category is used
ALTER TABLE public.absence_records ADD COLUMN leave_type public.leave_type;