-- ============================================
-- 近期数据库更新 (2025-02-08 ~ 2025-02-09)
-- 适用于 MariaDB 10.3+ 离线部署环境
-- ============================================

SET NAMES utf8mb4;

-- ============================================
-- 更新 1: 扩展 leave_balances 表假期类型
-- 日期: 2025-02-08
-- ============================================

-- 添加新的假期类型列 (如已存在则跳过)
ALTER TABLE `leave_balances`
  ADD COLUMN IF NOT EXISTS `paternity_leave_total` DECIMAL(10,2) DEFAULT 0 COMMENT '陪产假总额(天)',
  ADD COLUMN IF NOT EXISTS `paternity_leave_used` DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `bereavement_leave_total` DECIMAL(10,2) DEFAULT 0 COMMENT '丧假总额(天)',
  ADD COLUMN IF NOT EXISTS `bereavement_leave_used` DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `maternity_leave_total` DECIMAL(10,2) DEFAULT 0 COMMENT '产假总额(天)',
  ADD COLUMN IF NOT EXISTS `maternity_leave_used` DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `nursing_leave_total` DECIMAL(10,2) DEFAULT 0 COMMENT '哺乳假总额(小时)',
  ADD COLUMN IF NOT EXISTS `nursing_leave_used` DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `marriage_leave_total` DECIMAL(10,2) DEFAULT 0 COMMENT '婚假总额(天)',
  ADD COLUMN IF NOT EXISTS `marriage_leave_used` DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `compensatory_leave_total` DECIMAL(10,2) DEFAULT 0 COMMENT '调休总额(小时)',
  ADD COLUMN IF NOT EXISTS `compensatory_leave_used` DECIMAL(10,2) DEFAULT 0;

-- ============================================
-- 更新 2: organizations 表添加主管字段
-- 日期: 2025-02-08
-- ============================================

-- 添加直接主管和部门负责人字段
ALTER TABLE `organizations`
  ADD COLUMN IF NOT EXISTS `direct_supervisor_id` CHAR(36) DEFAULT NULL COMMENT '直接主管ID',
  ADD COLUMN IF NOT EXISTS `department_head_id` CHAR(36) DEFAULT NULL COMMENT '部门负责人ID';

-- 添加索引 (忽略已存在错误)
-- 注意：MariaDB 不支持 CREATE INDEX IF NOT EXISTS，需用存储过程或忽略错误
SET @sql = (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'organizations' AND index_name = 'idx_direct_supervisor'),
  'SELECT 1',
  'CREATE INDEX idx_direct_supervisor ON organizations(direct_supervisor_id)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'organizations' AND index_name = 'idx_department_head'),
  'SELECT 1',
  'CREATE INDEX idx_department_head ON organizations(department_head_id)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 更新 3: 假期扣减存储过程 (MariaDB 版本)
-- 日期: 2025-02-08
-- ============================================

DELIMITER //

DROP PROCEDURE IF EXISTS `deduct_leave_balance`//

CREATE PROCEDURE `deduct_leave_balance`(
  IN p_contact_id CHAR(36),
  IN p_duration_days DECIMAL(10,2),
  IN p_duration_hours DECIMAL(10,2),
  IN p_leave_type VARCHAR(20)
)
BEGIN
  DECLARE v_current_year INT DEFAULT YEAR(CURDATE());
  DECLARE v_deduct_value DECIMAL(10,2);
  
  -- 根据假期类型确定扣减值
  -- 年假/病假/哺乳假/调休 按小时计算
  -- 事假/陪产假/丧假/产假/婚假 按天计算
  
  CASE p_leave_type
    WHEN 'annual' THEN 
      SET v_deduct_value = COALESCE(p_duration_hours, p_duration_days * 8);
    WHEN 'sick' THEN 
      SET v_deduct_value = COALESCE(p_duration_hours, p_duration_days * 8);
    WHEN 'personal' THEN 
      SET v_deduct_value = COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'paternity' THEN 
      SET v_deduct_value = COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'bereavement' THEN 
      SET v_deduct_value = COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'maternity' THEN 
      SET v_deduct_value = COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'nursing' THEN 
      SET v_deduct_value = COALESCE(p_duration_hours, p_duration_days * 8);
    WHEN 'marriage' THEN 
      SET v_deduct_value = COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'compensatory' THEN 
      SET v_deduct_value = COALESCE(p_duration_hours, p_duration_days * 8);
    ELSE 
      SET v_deduct_value = 0;
  END CASE;
  
  -- 确保有假期余额记录 (使用 INSERT IGNORE)
  INSERT IGNORE INTO `leave_balances` (`id`, `contact_id`, `year`)
  VALUES (UUID(), p_contact_id, v_current_year);
  
  -- 更新已用假期
  CASE p_leave_type
    WHEN 'annual' THEN 
      UPDATE `leave_balances` SET `annual_leave_used` = `annual_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
    WHEN 'sick' THEN 
      UPDATE `leave_balances` SET `sick_leave_used` = `sick_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
    WHEN 'personal' THEN 
      UPDATE `leave_balances` SET `personal_leave_used` = `personal_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
    WHEN 'paternity' THEN 
      UPDATE `leave_balances` SET `paternity_leave_used` = `paternity_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
    WHEN 'bereavement' THEN 
      UPDATE `leave_balances` SET `bereavement_leave_used` = `bereavement_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
    WHEN 'maternity' THEN 
      UPDATE `leave_balances` SET `maternity_leave_used` = `maternity_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
    WHEN 'nursing' THEN 
      UPDATE `leave_balances` SET `nursing_leave_used` = `nursing_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
    WHEN 'marriage' THEN 
      UPDATE `leave_balances` SET `marriage_leave_used` = `marriage_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
    WHEN 'compensatory' THEN 
      UPDATE `leave_balances` SET `compensatory_leave_used` = `compensatory_leave_used` + v_deduct_value, `updated_at` = NOW() 
      WHERE `contact_id` = p_contact_id AND `year` = v_current_year;
  END CASE;
  
END//

DELIMITER ;

-- ============================================
-- 验证更新结果
-- ============================================

-- 检查 leave_balances 表结构
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
FROM information_schema.columns 
WHERE table_schema = DATABASE() AND table_name = 'leave_balances'
ORDER BY ordinal_position;

-- 检查 organizations 表结构
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
FROM information_schema.columns 
WHERE table_schema = DATABASE() AND table_name = 'organizations'
ORDER BY ordinal_position;

-- 检查存储过程
SHOW PROCEDURE STATUS WHERE Db = DATABASE() AND Name = 'deduct_leave_balance';

-- ============================================
-- 执行说明
-- ============================================
-- 1. 连接数据库: mysql -u root -p --default-character-set=utf8mb4 gov_platform
-- 2. 执行此脚本: SOURCE /path/to/recent-updates-2025-02-08-09.sql;
-- 或: mysql -u root -p gov_platform < recent-updates-2025-02-08-09.sql
