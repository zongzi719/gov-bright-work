-- 创建日程表（与领导日程分开，用于普通日程管理）
CREATE TABLE public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 添加索引
CREATE INDEX idx_schedules_contact_id ON public.schedules(contact_id);
CREATE INDEX idx_schedules_schedule_date ON public.schedules(schedule_date);

-- 启用 RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- 管理员可以管理所有日程
CREATE POLICY "Admins can manage schedules"
ON public.schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 认证用户可以查看所有日程
CREATE POLICY "Authenticated users can view schedules"
ON public.schedules
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 添加更新时间触发器
CREATE TRIGGER update_schedules_updated_at
BEFORE UPDATE ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();