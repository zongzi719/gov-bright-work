-- 为 absence_records 表添加详细字段（参考钉钉）
-- 通用字段
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS duration_days NUMERIC(10,2) DEFAULT NULL;

-- 出差申请专用字段
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT NULL;
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS transport_type TEXT DEFAULT NULL;
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS companions TEXT[] DEFAULT NULL;
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2) DEFAULT NULL;

-- 外出申请专用字段
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS out_location TEXT DEFAULT NULL;
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS out_type TEXT DEFAULT NULL;
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT NULL;

-- 请假申请专用字段（leave_type 已存在）
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS handover_person_id UUID DEFAULT NULL;
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS handover_notes TEXT DEFAULT NULL;

-- 添加外键约束
ALTER TABLE public.absence_records 
  ADD CONSTRAINT absence_records_handover_person_id_fkey 
  FOREIGN KEY (handover_person_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

-- 添加注释
COMMENT ON COLUMN public.absence_records.duration_hours IS '时长（小时）';
COMMENT ON COLUMN public.absence_records.duration_days IS '时长（天）';
COMMENT ON COLUMN public.absence_records.destination IS '出差目的地';
COMMENT ON COLUMN public.absence_records.transport_type IS '交通方式：plane/train/car/other';
COMMENT ON COLUMN public.absence_records.companions IS '同行人员ID列表';
COMMENT ON COLUMN public.absence_records.estimated_cost IS '预计费用';
COMMENT ON COLUMN public.absence_records.out_location IS '外出地点';
COMMENT ON COLUMN public.absence_records.out_type IS '外出类型：meeting/client/errand/other';
COMMENT ON COLUMN public.absence_records.contact_phone IS '外出期间联系电话';
COMMENT ON COLUMN public.absence_records.handover_person_id IS '工作交接人ID';
COMMENT ON COLUMN public.absence_records.handover_notes IS '交接事项说明';