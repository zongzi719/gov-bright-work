-- 为 organizations 表添加直接主管和部门负责人字段
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS direct_supervisor_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS department_head_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_organizations_direct_supervisor ON public.organizations(direct_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_organizations_department_head ON public.organizations(department_head_id);

-- 添加注释说明
COMMENT ON COLUMN public.organizations.direct_supervisor_id IS '直接主管ID';
COMMENT ON COLUMN public.organizations.department_head_id IS '部门负责人ID';