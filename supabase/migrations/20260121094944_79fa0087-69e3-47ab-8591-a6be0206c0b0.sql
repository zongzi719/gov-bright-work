-- 创建角色表存储角色定义
CREATE TABLE public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    label text NOT NULL,
    description text,
    is_system boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- RLS 策略：管理员可以管理角色
CREATE POLICY "Admins can manage roles" 
ON public.roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS 策略：已认证用户可以查看角色
CREATE POLICY "Authenticated users can view roles" 
ON public.roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 更新时间戳触发器
CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 插入系统预设角色
INSERT INTO public.roles (name, label, description, is_system, sort_order) VALUES
('admin', '管理员', '拥有系统所有权限，可以管理所有模块和用户', true, 1),
('user', '普通用户', '普通用户，权限受限，只能操作授权的模块', true, 2);