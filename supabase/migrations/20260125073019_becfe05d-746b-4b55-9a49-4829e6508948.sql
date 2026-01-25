-- 创建审批流程版本表
CREATE TABLE public.approval_process_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.approval_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  version_name TEXT NOT NULL,
  published_by TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  nodes_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_current BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(template_id, version_number)
);

-- 在模板表添加字段追踪最后保存时间和是否有修改
ALTER TABLE public.approval_templates 
ADD COLUMN IF NOT EXISTS last_process_saved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES public.approval_process_versions(id);

-- 启用RLS
ALTER TABLE public.approval_process_versions ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "Admins can manage process versions" 
ON public.approval_process_versions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view process versions" 
ON public.approval_process_versions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 索引优化
CREATE INDEX idx_approval_process_versions_template ON public.approval_process_versions(template_id);
CREATE INDEX idx_approval_process_versions_current ON public.approval_process_versions(template_id, is_current) WHERE is_current = true;