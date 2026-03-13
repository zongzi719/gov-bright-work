-- ============================================
-- 审计日志表 - MariaDB 版本
-- 执行时间: 2026-03-13
-- 说明: 创建 audit_logs 表及索引
-- ============================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `operator_id` VARCHAR(100) NOT NULL COMMENT '操作人ID',
  `operator_name` VARCHAR(100) NOT NULL COMMENT '操作人姓名',
  `operator_role` VARCHAR(50) DEFAULT NULL COMMENT '操作人角色',
  `action` VARCHAR(50) NOT NULL COMMENT '操作类型：登录/退出登录/新增/修改/删除/查看/审批通过/审批驳回等',
  `module` VARCHAR(50) NOT NULL COMMENT '模块：认证管理/通讯录管理/审批设置等',
  `target_type` VARCHAR(100) DEFAULT NULL COMMENT '目标类型：如 轮播图/通知公告/审批模板',
  `target_id` VARCHAR(100) DEFAULT NULL COMMENT '目标ID',
  `target_name` VARCHAR(500) DEFAULT NULL COMMENT '目标名称',
  `detail` JSON DEFAULT NULL COMMENT '操作详情（JSON）',
  `ip_address` VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` VARCHAR(500) DEFAULT NULL COMMENT '浏览器UA',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_audit_operator` (`operator_id`),
  INDEX `idx_audit_module` (`module`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_created` (`created_at`),
  INDEX `idx_audit_role` (`operator_role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计日志表';

-- 验证
SELECT COUNT(*) AS audit_logs_count FROM audit_logs;
