-- ============================================
-- 三员角色体系 - MariaDB 版本
-- 执行时间: 2026-03-13
-- 说明: 创建三员角色、互斥触发器、超管自动切换触发器
-- ============================================

-- 1. 插入三员角色（幂等）
INSERT INTO roles (name, label, description, is_system, is_active, sort_order)
SELECT 'sys_admin', '系统管理员', '负责系统日常运维管理：通讯录、通知公告、食堂菜谱、轮播图、日程、办公用品等', 1, 1, 1
FROM dual WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'sys_admin');

INSERT INTO roles (name, label, description, is_system, is_active, sort_order)
SELECT 'security_admin', '安全保密管理员', '负责安全策略与权限管理：角色管理、角色用户分配、权限管理、审批流程', 1, 1, 2
FROM dual WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'security_admin');

INSERT INTO roles (name, label, description, is_system, is_active, sort_order)
SELECT 'audit_admin', '安全审计员', '负责审计日志查看与监督', 1, 1, 3
FROM dual WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'audit_admin');

-- 2. 互斥触发器：防止同一用户持有多个三员角色
DELIMITER //

DROP TRIGGER IF EXISTS trg_check_three_officer_exclusivity //
CREATE TRIGGER trg_check_three_officer_exclusivity
BEFORE INSERT ON user_roles
FOR EACH ROW
BEGIN
  DECLARE v_existing_role VARCHAR(50);
  
  IF NEW.role IN ('sys_admin', 'security_admin', 'audit_admin') THEN
    SELECT role INTO v_existing_role
    FROM user_roles
    WHERE user_id = NEW.user_id
      AND role IN ('sys_admin', 'security_admin', 'audit_admin')
      AND role != NEW.role
    LIMIT 1;
    
    IF v_existing_role IS NOT NULL THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '该用户已持有三员角色，不可兼任';
    END IF;
  END IF;
END //

-- 3. 超管自动切换触发器（INSERT后）：三员齐备时禁用超管，缺员时恢复
DROP TRIGGER IF EXISTS trg_admin_toggle_after_insert //
CREATE TRIGGER trg_admin_toggle_after_insert
AFTER INSERT ON user_roles
FOR EACH ROW
BEGIN
  DECLARE v_count INT;
  
  SELECT COUNT(DISTINCT role) INTO v_count
  FROM user_roles
  WHERE role IN ('sys_admin', 'security_admin', 'audit_admin');
  
  IF v_count >= 3 THEN
    UPDATE roles SET is_active = 0, updated_at = NOW()
    WHERE name = 'admin' AND is_active = 1;
  ELSE
    UPDATE roles SET is_active = 1, updated_at = NOW()
    WHERE name = 'admin' AND is_active = 0;
  END IF;
END //

-- 4. 超管自动切换触发器（DELETE后）
DROP TRIGGER IF EXISTS trg_admin_toggle_after_delete //
CREATE TRIGGER trg_admin_toggle_after_delete
AFTER DELETE ON user_roles
FOR EACH ROW
BEGIN
  DECLARE v_count INT;
  
  SELECT COUNT(DISTINCT role) INTO v_count
  FROM user_roles
  WHERE role IN ('sys_admin', 'security_admin', 'audit_admin');
  
  IF v_count >= 3 THEN
    UPDATE roles SET is_active = 0, updated_at = NOW()
    WHERE name = 'admin' AND is_active = 1;
  ELSE
    UPDATE roles SET is_active = 1, updated_at = NOW()
    WHERE name = 'admin' AND is_active = 0;
  END IF;
END //

DELIMITER ;

-- 验证
SELECT name, label, is_active FROM roles WHERE name IN ('admin', 'sys_admin', 'security_admin', 'audit_admin');
