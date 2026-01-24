-- 添加 category 字段到 approval_templates 表，用于审批模板分组
ALTER TABLE public.approval_templates 
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '外出管理';

-- 添加注释
COMMENT ON COLUMN public.approval_templates.category IS '审批模板分组：外出管理、办公用品等';