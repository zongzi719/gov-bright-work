-- 创建领导日程表
CREATE TABLE public.leader_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'internal_meeting' CHECK (schedule_type IN ('internal_meeting', 'party_activity', 'research_trip')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建领导日程查看权限表
CREATE TABLE public.leader_schedule_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  leader_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  can_view_all BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, leader_id)
);

-- 启用 RLS
ALTER TABLE public.leader_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_schedule_permissions ENABLE ROW LEVEL SECURITY;

-- RLS 策略：管理员可以管理所有日程
CREATE POLICY "Admins can manage leader schedules"
ON public.leader_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'::text))
WITH CHECK (has_role(auth.uid(), 'admin'::text));

-- RLS 策略：有权限的用户可以查看日程
CREATE POLICY "Authorized users can view leader schedules"
ON public.leader_schedules
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::text) OR
  EXISTS (
    SELECT 1 FROM public.leader_schedule_permissions
    WHERE user_id = auth.uid()
    AND (can_view_all = true OR leader_id = leader_schedules.leader_id)
  )
);

-- RLS 策略：管理员可以管理权限
CREATE POLICY "Admins can manage schedule permissions"
ON public.leader_schedule_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::text))
WITH CHECK (has_role(auth.uid(), 'admin'::text));

-- RLS 策略：用户可以查看自己的权限
CREATE POLICY "Users can view their own permissions"
ON public.leader_schedule_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- 添加更新时间触发器
CREATE TRIGGER update_leader_schedules_updated_at
BEFORE UPDATE ON public.leader_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leader_schedule_permissions_updated_at
BEFORE UPDATE ON public.leader_schedule_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 插入模拟数据 (需要先获取一些联系人ID)
-- 假设有一些领导联系人，这里用占位符，实际会用真实ID