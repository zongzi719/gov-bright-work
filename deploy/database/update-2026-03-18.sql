-- ============================================
-- 2026-03-18 增量更新 SQL（MariaDB 兼容）
-- 功能：外部链接管理 + 审批模板导航可见范围
-- 执行方式: mysql -u root -p gov_platform < update-2026-03-18.sql
-- ============================================

-- ============================================
-- 一、外部链接管理表
-- ============================================
CREATE TABLE IF NOT EXISTS external_links (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  url VARCHAR(500) NOT NULL,
  icon_url VARCHAR(500) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 幂等插入默认链接
INSERT INTO external_links (id, title, url, icon_url, sort_order, is_active)
SELECT UUID(), '人民网资料库', 'http://www.people.com.cn', NULL, 0, 1
FROM dual WHERE NOT EXISTS (SELECT 1 FROM external_links WHERE title = '人民网资料库');

-- ============================================
-- 二、审批模板增加导航发布与可见范围字段
-- ============================================

-- 2.1 是否在前台导航显示
ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS show_in_nav TINYINT(1) NOT NULL DEFAULT 0;

-- 2.2 导航可见范围：all | leader_only | specific_orgs | specific_roles | specific_users
ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS nav_visible_scope VARCHAR(50) NOT NULL DEFAULT 'all';

-- 2.3 指定可见的单位ID数组（JSON TEXT）
ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS nav_visible_org_ids TEXT DEFAULT '[]';

-- 2.4 指定可见的角色名数组（JSON TEXT）
ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS nav_visible_role_names TEXT DEFAULT '[]';

-- 2.5 指定可见的用户ID数组（JSON TEXT）
ALTER TABLE approval_templates ADD COLUMN IF NOT EXISTS nav_visible_user_ids TEXT DEFAULT '[]';

-- ============================================
-- 验证
-- ============================================
SELECT 'external_links' AS `表`, COUNT(*) AS `记录数` FROM external_links
UNION ALL
SELECT 'approval_templates.show_in_nav' AS `表`, COUNT(*) FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approval_templates' AND COLUMN_NAME = 'show_in_nav';
