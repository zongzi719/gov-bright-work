
-- 1. Remove 'nursing' from leave_type enum and add 'family_visit'
-- PostgreSQL doesn't support removing enum values easily, so we add family_visit
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'family_visit';

-- 2. Add family_visit_leave columns to leave_balances
ALTER TABLE public.leave_balances
ADD COLUMN IF NOT EXISTS family_visit_leave_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS family_visit_leave_used numeric DEFAULT 0;

COMMENT ON COLUMN public.leave_balances.family_visit_leave_total IS '探亲假总额(天)，手动发放';
COMMENT ON COLUMN public.leave_balances.family_visit_leave_used IS '探亲假已用(天)';

-- 3. Update deduct_leave_balance function to handle family_visit and remove nursing
CREATE OR REPLACE FUNCTION public.deduct_leave_balance(p_contact_id uuid, p_leave_type text, p_duration_hours numeric, p_duration_days numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_current_year INT := EXTRACT(YEAR FROM NOW())::INT;
  v_field_used TEXT;
  v_deduct_value NUMERIC;
BEGIN
  CASE p_leave_type
    WHEN 'sick' THEN 
      v_field_used := 'sick_leave_used';
      v_deduct_value := COALESCE(p_duration_hours, p_duration_days * 8);
    WHEN 'annual' THEN 
      v_field_used := 'annual_leave_used';
      v_deduct_value := COALESCE(p_duration_hours, p_duration_days * 8);
    WHEN 'personal' THEN 
      v_field_used := 'personal_leave_used';
      v_deduct_value := COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'paternity' THEN 
      v_field_used := 'paternity_leave_used';
      v_deduct_value := COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'bereavement' THEN 
      v_field_used := 'bereavement_leave_used';
      v_deduct_value := COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'maternity' THEN 
      v_field_used := 'maternity_leave_used';
      v_deduct_value := COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'family_visit' THEN 
      v_field_used := 'family_visit_leave_used';
      v_deduct_value := COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'marriage' THEN 
      v_field_used := 'marriage_leave_used';
      v_deduct_value := COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'compensatory' THEN 
      v_field_used := 'compensatory_leave_used';
      v_deduct_value := COALESCE(p_duration_hours, p_duration_days * 8);
    ELSE
      RETURN FALSE;
  END CASE;

  INSERT INTO public.leave_balances (contact_id, year)
  VALUES (p_contact_id, v_current_year)
  ON CONFLICT (contact_id, year) DO NOTHING;

  EXECUTE format(
    'UPDATE public.leave_balances SET %I = %I + $1, updated_at = NOW() WHERE contact_id = $2 AND year = $3',
    v_field_used, v_field_used
  ) USING v_deduct_value, p_contact_id, v_current_year;
  
  RETURN TRUE;
END;
$function$;
