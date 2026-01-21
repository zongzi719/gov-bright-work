-- 创建外出/请假记录状态枚举
CREATE TYPE public.absence_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'cancelled');

-- 创建外出/请假类型枚举
CREATE TYPE public.absence_type AS ENUM ('out', 'leave', 'business_trip', 'meeting');

-- 创建外出/请假记录表
CREATE TABLE public.absence_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    type public.absence_type NOT NULL,
    reason TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status public.absence_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用RLS
ALTER TABLE public.absence_records ENABLE ROW LEVEL SECURITY;

-- 管理员可以管理所有记录
CREATE POLICY "Admins can manage absence records"
ON public.absence_records
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 已认证用户可以查看记录
CREATE POLICY "Authenticated users can view absence records"
ON public.absence_records
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 创建更新时间戳触发器
CREATE TRIGGER update_absence_records_updated_at
BEFORE UPDATE ON public.absence_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();