-- 扩展 leave_balances 表，添加更多假期类型
-- 先添加新的假期类型列
ALTER TABLE public.leave_balances
ADD COLUMN IF NOT EXISTS paternity_leave_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS paternity_leave_used numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bereavement_leave_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bereavement_leave_used numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS maternity_leave_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS maternity_leave_used numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS nursing_leave_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS nursing_leave_used numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS marriage_leave_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS marriage_leave_used numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS compensatory_leave_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS compensatory_leave_used numeric DEFAULT 0;

-- 添加新的假期类型到枚举
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'paternity';
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'bereavement';
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'maternity';
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'nursing';
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'marriage';
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'compensatory';

-- 添加注释说明各字段
COMMENT ON COLUMN public.leave_balances.sick_leave_total IS '病假总额(小时)';
COMMENT ON COLUMN public.leave_balances.annual_leave_total IS '年假总额(小时)，按工龄配额';
COMMENT ON COLUMN public.leave_balances.personal_leave_total IS '事假总额(天)';
COMMENT ON COLUMN public.leave_balances.paternity_leave_total IS '陪产假总额(天)，手动发放';
COMMENT ON COLUMN public.leave_balances.bereavement_leave_total IS '丧假总额(天)，手动发放';
COMMENT ON COLUMN public.leave_balances.maternity_leave_total IS '产假总额(天)，手动发放';
COMMENT ON COLUMN public.leave_balances.nursing_leave_total IS '哺乳假总额(小时)，手动发放';
COMMENT ON COLUMN public.leave_balances.marriage_leave_total IS '婚假总额(天)，手动发放';
COMMENT ON COLUMN public.leave_balances.compensatory_leave_total IS '调休总额(小时)，加班自动累积';

-- 创建函数：请假审批通过后扣减假期余额
CREATE OR REPLACE FUNCTION public.deduct_leave_balance(
  p_contact_id UUID,
  p_leave_type TEXT,
  p_duration_hours NUMERIC,
  p_duration_days NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_year INT := EXTRACT(YEAR FROM NOW())::INT;
  v_field_used TEXT;
  v_deduct_value NUMERIC;
BEGIN
  -- 根据假期类型确定扣减字段和值
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
    WHEN 'nursing' THEN 
      v_field_used := 'nursing_leave_used';
      v_deduct_value := COALESCE(p_duration_hours, p_duration_days * 8);
    WHEN 'marriage' THEN 
      v_field_used := 'marriage_leave_used';
      v_deduct_value := COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'compensatory' THEN 
      v_field_used := 'compensatory_leave_used';
      v_deduct_value := COALESCE(p_duration_hours, p_duration_days * 8);
    ELSE
      RETURN FALSE;
  END CASE;

  -- 确保有假期余额记录
  INSERT INTO public.leave_balances (contact_id, year)
  VALUES (p_contact_id, v_current_year)
  ON CONFLICT (contact_id, year) DO NOTHING;

  -- 动态更新已用假期
  EXECUTE format(
    'UPDATE public.leave_balances SET %I = %I + $1, updated_at = NOW() WHERE contact_id = $2 AND year = $3',
    v_field_used, v_field_used
  ) USING v_deduct_value, p_contact_id, v_current_year;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为 leave_balances 添加唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_balances_contact_year_unique'
  ) THEN
    ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_contact_year_unique UNIQUE (contact_id, year);
  END IF;
END $$;