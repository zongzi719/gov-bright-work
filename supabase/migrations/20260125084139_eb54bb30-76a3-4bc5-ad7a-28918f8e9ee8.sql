
-- 创建审批实例状态枚举
CREATE TYPE public.approval_instance_status AS ENUM (
  'pending',     -- 进行中
  'approved',    -- 已通过
  'rejected',    -- 已拒绝
  'cancelled',   -- 已撤回
  'expired'      -- 已过期
);

-- 创建审批记录状态枚举
CREATE TYPE public.approval_record_status AS ENUM (
  'pending',     -- 待处理
  'approved',    -- 已同意
  'rejected',    -- 已拒绝
  'transferred'  -- 已转交
);

-- 创建审批实例表 - 记录每一次发起的审批
CREATE TABLE public.approval_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 关联审批模版和版本
  template_id UUID NOT NULL REFERENCES public.approval_templates(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.approval_process_versions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,  -- 记录版本号，如 V1, V2
  
  -- 业务关联
  business_type TEXT NOT NULL,      -- 业务类型: business_trip, leave, out, supply_requisition, purchase_request
  business_id UUID NOT NULL,        -- 业务记录ID（如 absence_records.id）
  
  -- 发起人
  initiator_id UUID NOT NULL REFERENCES public.contacts(id),
  
  -- 审批状态
  status public.approval_instance_status NOT NULL DEFAULT 'pending',
  current_node_index INTEGER NOT NULL DEFAULT 0,  -- 当前节点索引（在 nodes_snapshot 中的位置）
  
  -- 表单数据快照（可选，用于存储提交时的表单数据）
  form_data JSONB DEFAULT '{}'::jsonb,
  
  -- 时间戳
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建审批记录表 - 记录每个节点的审批决定
CREATE TABLE public.approval_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 关联审批实例
  instance_id UUID NOT NULL REFERENCES public.approval_instances(id) ON DELETE CASCADE,
  
  -- 节点信息
  node_index INTEGER NOT NULL,       -- 节点在流程中的位置
  node_name TEXT NOT NULL,           -- 节点名称快照
  node_type TEXT NOT NULL,           -- 节点类型快照
  
  -- 审批人
  approver_id UUID NOT NULL REFERENCES public.contacts(id),
  
  -- 审批结果
  status public.approval_record_status NOT NULL DEFAULT 'pending',
  comment TEXT,                      -- 审批意见
  
  -- 转交信息（如果是转交）
  transferred_to UUID REFERENCES public.contacts(id),
  
  -- 时间戳
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 给 todo_items 表添加审批相关字段
ALTER TABLE public.todo_items 
  ADD COLUMN approval_instance_id UUID REFERENCES public.approval_instances(id) ON DELETE CASCADE,
  ADD COLUMN approval_version_number INTEGER;

-- 为 business_trip 添加到 todo_business_type 枚举
ALTER TYPE public.todo_business_type ADD VALUE IF NOT EXISTS 'business_trip';

-- 创建索引以提高查询性能
CREATE INDEX idx_approval_instances_template ON public.approval_instances(template_id);
CREATE INDEX idx_approval_instances_business ON public.approval_instances(business_type, business_id);
CREATE INDEX idx_approval_instances_initiator ON public.approval_instances(initiator_id);
CREATE INDEX idx_approval_instances_status ON public.approval_instances(status);

CREATE INDEX idx_approval_records_instance ON public.approval_records(instance_id);
CREATE INDEX idx_approval_records_approver ON public.approval_records(approver_id);
CREATE INDEX idx_approval_records_status ON public.approval_records(status);

CREATE INDEX idx_todo_items_approval ON public.todo_items(approval_instance_id);

-- 启用 RLS
ALTER TABLE public.approval_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_records ENABLE ROW LEVEL SECURITY;

-- approval_instances 的 RLS 策略
CREATE POLICY "Admins can manage approval instances"
  ON public.approval_instances FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create approval instances"
  ON public.approval_instances FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view approval instances"
  ON public.approval_instances FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can update approval instances"
  ON public.approval_instances FOR UPDATE
  USING (true);

-- approval_records 的 RLS 策略
CREATE POLICY "Admins can manage approval records"
  ON public.approval_records FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create approval records"
  ON public.approval_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view approval records"
  ON public.approval_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can update approval records"
  ON public.approval_records FOR UPDATE
  USING (true);

-- 更新触发器
CREATE TRIGGER update_approval_instances_updated_at
  BEFORE UPDATE ON public.approval_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approval_records_updated_at
  BEFORE UPDATE ON public.approval_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
