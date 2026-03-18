-- 外部链接管理表
-- 用于前台首页"常用链接"区域的动态管理

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

-- 插入默认的人民网链接
INSERT INTO external_links (id, title, url, icon_url, sort_order, is_active) VALUES
(UUID(), '人民网资料库', 'http://www.people.com.cn', NULL, 0, 1);
