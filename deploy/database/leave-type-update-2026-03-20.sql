-- ============================================
-- 假期类型调整 (2026-03-20)
-- 适用于 MariaDB 10.3+ 离线部署环境
-- 变更内容:
--   1. 产假 → 生育假 (仅前端标签变更，DB字段 maternity_leave_* 不变)
--   2. 移除哺乳假 (nursing_leave_* 字段保留但前端不再使用)
--   3. 新增探亲假 (family_visit_leave_total / family_visit_leave_used)
-- ============================================

SET NAMES utf8mb4;

-- 1. 添加探亲假字段到 leave_balances 表
ALTER TABLE `leave_balances`
  ADD COLUMN IF NOT EXISTS `family_visit_leave_total` DECIMAL(10,2) DEFAULT 0 COMMENT '探亲假总额(天)',
  ADD COLUMN IF NOT EXISTS `family_visit_leave_used` DECIMAL(10,2) DEFAULT 0 COMMENT '探亲假已用(天)';

-- 2. 更新存储过程，增加 family_visit 类型支持
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
  
  -- 年假/病假/调休 按小时计算
  -- 事假/陪产假/丧假/生育假(maternity)/婚假/探亲假 按天计算
  
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
    WHEN 'family_visit' THEN 
      SET v_deduct_value = COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'marriage' THEN 
      SET v_deduct_value = COALESCE(p_duration_days, p_duration_hours / 8);
    WHEN 'compensatory' THEN 
      SET v_deduct_value = COALESCE(p_duration_hours, p_duration_days * 8);
    ELSE 
      SET v_deduct_value = 0;
  END CASE;
  
  -- 确保有假期余额记录
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
    WHEN 'family_visit' THEN 
      UPDATE `leave_balances` SET `family_visit_leave_used` = `family_visit_leave_used` + v_deduct_value, `updated_at` = NOW() 
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

-- 3. 更新请假审批模板的表单字段选项，加入探亲假
UPDATE `approval_form_fields` 
SET `field_options` = '["annual","sick","personal","paternity","bereavement","maternity","family_visit","marriage","compensatory"]'
WHERE `field_name` = 'leave_type' AND `field_type` = 'select';

-- ============================================
-- 执行说明
-- ============================================
-- 1. 连接数据库: mysql -u root -p --default-character-set=utf8mb4 gov_platform
-- 2. 执行此脚本: SOURCE /path/to/leave-type-update-2026-03-20.sql;
