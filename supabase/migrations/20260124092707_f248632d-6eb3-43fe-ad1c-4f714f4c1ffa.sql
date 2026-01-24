-- 创建审批模板表
CREATE TABLE public.approval_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT '📋',
  business_type TEXT NOT NULL DEFAULT 'absence',
  is_active BOOLEAN NOT NULL DEFAULT true,
  callback_url TEXT,
  auto_approve_timeout INTEGER,
  allow_withdraw BOOLEAN NOT NULL DEFAULT true,
  allow_transfer BOOLEAN NOT NULL DEFAULT false,
  notify_initiator BOOLEAN NOT NULL DEFAULT true,
  notify_approver BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建表单字段表
CREATE TABLE public.approval_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.approval_templates(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  placeholder TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  field_options JSONB,
  default_value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建审批节点表
CREATE TABLE public.approval_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.approval_templates(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL DEFAULT 'approver',
  node_name TEXT NOT NULL,
  approver_type TEXT NOT NULL DEFAULT 'specific',
  approver_ids UUID[],
  condition_expression JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.approval_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_nodes ENABLE ROW LEVEL SECURITY;

-- approval_templates RLS 策略
CREATE POLICY "Admins can manage approval templates" ON public.approval_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active templates" ON public.approval_templates
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- approval_form_fields RLS 策略
CREATE POLICY "Admins can manage form fields" ON public.approval_form_fields
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view form fields" ON public.approval_form_fields
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- approval_nodes RLS 策略
CREATE POLICY "Admins can manage approval nodes" ON public.approval_nodes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view approval nodes" ON public.approval_nodes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 创建更新时间触发器
CREATE TRIGGER update_approval_templates_updated_at
  BEFORE UPDATE ON public.approval_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approval_form_fields_updated_at
  BEFORE UPDATE ON public.approval_form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approval_nodes_updated_at
  BEFORE UPDATE ON public.approval_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();