-- 修改 user_roles 表，将 role 字段从 enum 改为 text，以支持自定义角色
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;

-- 修改 role_permissions 表，将 role 字段从 enum 改为 text，以支持自定义角色
ALTER TABLE public.role_permissions ALTER COLUMN role TYPE text USING role::text;

-- 添加外键约束，确保角色名称必须存在于 roles 表中
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_role_fkey 
FOREIGN KEY (role) REFERENCES public.roles(name) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.role_permissions 
ADD CONSTRAINT role_permissions_role_fkey 
FOREIGN KEY (role) REFERENCES public.roles(name) ON UPDATE CASCADE ON DELETE RESTRICT;