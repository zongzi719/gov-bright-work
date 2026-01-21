-- 创建数据范围枚举
CREATE TYPE public.data_scope AS ENUM ('self', 'department', 'organization', 'all');

-- 创建角色权限表（控制每个角色对每个模块的权限）
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module_name TEXT NOT NULL,
  module_label TEXT NOT NULL,
  can_create BOOLEAN DEFAULT false,
  can_read BOOLEAN DEFAULT false,
  can_update BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  data_scope data_scope DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, module_name)
);

-- 启用 RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 只有管理员可以管理权限
CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 已认证用户可以查看权限配置
CREATE POLICY "Authenticated users can view permissions"
ON public.role_permissions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 创建更新时间触发器
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 初始化管理员默认权限（所有模块全部权限）
INSERT INTO public.role_permissions (role, module_name, module_label, can_create, can_read, can_update, can_delete, data_scope) VALUES
('admin', 'banners', '轮播图管理', true, true, true, true, 'all'),
('admin', 'notices', '通知公告', true, true, true, true, 'all'),
('admin', 'menus', '食堂菜单', true, true, true, true, 'all'),
('admin', 'contacts', '通讯录管理', true, true, true, true, 'all'),
('admin', 'organizations', '组织架构', true, true, true, true, 'all'),
('admin', 'absences', '外出管理', true, true, true, true, 'all'),
('admin', 'leaves', '假期管理', true, true, true, true, 'all'),
('admin', 'supplies', '办公用品', true, true, true, true, 'all'),
('admin', 'system', '系统管理', true, true, true, true, 'all');

-- 初始化普通用户默认权限（只能查看，数据范围为本人）
INSERT INTO public.role_permissions (role, module_name, module_label, can_create, can_read, can_update, can_delete, data_scope) VALUES
('user', 'banners', '轮播图管理', false, true, false, false, 'all'),
('user', 'notices', '通知公告', false, true, false, false, 'all'),
('user', 'menus', '食堂菜单', false, true, false, false, 'all'),
('user', 'contacts', '通讯录管理', false, true, false, false, 'department'),
('user', 'organizations', '组织架构', false, true, false, false, 'all'),
('user', 'absences', '外出管理', true, true, true, false, 'self'),
('user', 'leaves', '假期管理', false, true, false, false, 'self'),
('user', 'supplies', '办公用品', true, true, false, false, 'self'),
('user', 'system', '系统管理', false, false, false, false, 'self');