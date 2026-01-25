-- 为审批节点添加表单字段权限配置
ALTER TABLE public.approval_nodes
ADD COLUMN IF NOT EXISTS field_permissions JSONB DEFAULT '{}';

-- 添加注释
COMMENT ON COLUMN public.approval_nodes.field_permissions IS '表单字段权限配置，格式: { field_name: "editable" | "readonly" | "hidden" }';