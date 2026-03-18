-- 审批模板增加导航可见范围字段
-- nav_visible_scope: 'all' | 'leader_only' | 'specific_orgs' | 'specific_roles' | 'specific_users'
-- nav_visible_org_ids: 指定可见的单位ID数组
-- nav_visible_role_names: 指定可见的角色名数组
-- nav_visible_user_ids: 指定可见的用户ID数组

ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS nav_visible_scope VARCHAR(50) NOT NULL DEFAULT 'all';
ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS nav_visible_org_ids TEXT DEFAULT '[]';
ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS nav_visible_role_names TEXT DEFAULT '[]';
ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS nav_visible_user_ids TEXT DEFAULT '[]';
