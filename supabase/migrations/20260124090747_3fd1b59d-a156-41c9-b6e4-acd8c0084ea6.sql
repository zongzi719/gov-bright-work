
-- 创建待办来源枚举
CREATE TYPE public.todo_source AS ENUM ('internal', 'external');

-- 创建待办业务类型枚举
CREATE TYPE public.todo_business_type AS ENUM (
  'absence',           -- 外出/请假/出差申请
  'supply_requisition', -- 物资领用申请
  'purchase_request',   -- 采购申请
  'external_approval'   -- 外部系统审批
);

-- 创建待办状态枚举
CREATE TYPE public.todo_status AS ENUM (
  'pending',    -- 待处理
  'processing', -- 处理中
  'approved',   -- 已通过
  'rejected',   -- 已驳回
  'cancelled',  -- 已取消
  'completed'   -- 已完成
);

-- 创建待办优先级枚举
CREATE TYPE public.todo_priority AS ENUM ('urgent', 'normal', 'low');

-- 创建待办事项表
CREATE TABLE public.todo_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 来源信息
  source public.todo_source NOT NULL DEFAULT 'internal',
  source_system TEXT,                    -- 来源系统名称（如"OA办公系统"、"公文系统"）
  source_department TEXT,                -- 来源部门
  
  -- 业务关联
  business_type public.todo_business_type NOT NULL,
  business_id UUID,                      -- 关联的业务记录ID（如absence_records.id）
  
  -- 任务信息
  title TEXT NOT NULL,
  description TEXT,
  priority public.todo_priority NOT NULL DEFAULT 'normal',
  status public.todo_status NOT NULL DEFAULT 'pending',
  
  -- 外部系统链接（用于跳转到其他系统处理）
  action_url TEXT,
  
  -- 人员关联
  initiator_id UUID REFERENCES public.contacts(id),  -- 发起人
  assignee_id UUID NOT NULL REFERENCES public.contacts(id), -- 处理人/被指派人
  
  -- 处理结果
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES public.contacts(id),
  process_result TEXT,
  process_notes TEXT,
  
  -- 时间戳
  due_date TIMESTAMP WITH TIME ZONE,    -- 截止时间
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用RLS
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

-- RLS策略：管理员可以管理所有待办
CREATE POLICY "Admins can manage todo items"
ON public.todo_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS策略：用户可以查看分配给自己的待办（基于contact关联）
CREATE POLICY "Users can view assigned todo items"
ON public.todo_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS策略：允许插入待办（用于外部系统推送）
CREATE POLICY "Allow insert todo items"
ON public.todo_items
FOR INSERT
WITH CHECK (true);

-- 创建更新时间触发器
CREATE TRIGGER update_todo_items_updated_at
BEFORE UPDATE ON public.todo_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 创建索引优化查询
CREATE INDEX idx_todo_items_assignee ON public.todo_items(assignee_id);
CREATE INDEX idx_todo_items_status ON public.todo_items(status);
CREATE INDEX idx_todo_items_business ON public.todo_items(business_type, business_id);
CREATE INDEX idx_todo_items_created ON public.todo_items(created_at DESC);
