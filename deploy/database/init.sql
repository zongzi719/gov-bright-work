-- ============================================
-- 党政办公平台 - MariaDB 完整数据库初始化脚本
-- 适用于 MariaDB 10.3+ (aarch64 / 鲲鹏920)
-- 与 Supabase PostgreSQL 表结构完全对齐
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 第一部分：表结构（按依赖顺序创建）
-- ============================================================

-- ==================== 1. 组织架构表 ====================
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(255) NOT NULL,
  `short_name` VARCHAR(100) DEFAULT NULL,
  `parent_id` CHAR(36) DEFAULT NULL,
  `level` INT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `phone` VARCHAR(50) DEFAULT NULL,
  `address` VARCHAR(500) DEFAULT NULL,
  `direct_supervisor_id` CHAR(36) DEFAULT NULL COMMENT '直接主管ID',
  `department_head_id` CHAR(36) DEFAULT NULL COMMENT '部门负责人ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_direct_supervisor` (`direct_supervisor_id`),
  KEY `idx_department_head` (`department_head_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 2. 通讯录表 ====================
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(100) NOT NULL,
  `mobile` VARCHAR(20) DEFAULT NULL,
  `account` VARCHAR(100) DEFAULT NULL COMMENT '登录账号(离线版扩展)',
  `phone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `position` VARCHAR(100) DEFAULT NULL,
  `department` VARCHAR(100) DEFAULT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `is_leader` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `office_location` VARCHAR(255) DEFAULT NULL,
  `first_work_date` DATE DEFAULT NULL,
  `security_level` VARCHAR(20) NOT NULL DEFAULT '一般',
  `status` VARCHAR(20) NOT NULL DEFAULT 'on_duty' COMMENT 'on_duty/leave/out/business_trip',
  `status_note` VARCHAR(255) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL DEFAULT '123456',
  `rmsid` VARCHAR(255) DEFAULT NULL COMMENT '信任体系用户标识(SSO)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_organization_id` (`organization_id`),
  KEY `idx_mobile` (`mobile`),
  KEY `idx_account` (`account`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_status` (`status`),
  UNIQUE KEY `uk_rmsid` (`rmsid`),
  CONSTRAINT `fk_contacts_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 组织表自引用与指向 contacts 的外键（延迟添加）
ALTER TABLE `organizations`
  ADD CONSTRAINT `fk_org_parent` FOREIGN KEY (`parent_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_org_direct_supervisor` FOREIGN KEY (`direct_supervisor_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_org_department_head` FOREIGN KEY (`department_head_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==================== 3. 角色表 ====================
CREATE TABLE IF NOT EXISTS `roles` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(50) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 4. 用户角色关联表 ====================
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role` (`role`),
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role`) REFERENCES `roles` (`name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 5. 角色权限表 ====================
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `role` VARCHAR(50) NOT NULL,
  `module_name` VARCHAR(100) NOT NULL,
  `module_label` VARCHAR(100) NOT NULL,
  `can_create` TINYINT(1) DEFAULT 0,
  `can_read` TINYINT(1) DEFAULT 0,
  `can_update` TINYINT(1) DEFAULT 0,
  `can_delete` TINYINT(1) DEFAULT 0,
  `data_scope` VARCHAR(20) DEFAULT 'all' COMMENT 'all/department/self',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_role` (`role`),
  UNIQUE KEY `uk_role_module` (`role`, `module_name`),
  CONSTRAINT `fk_role_perms_role` FOREIGN KEY (`role`) REFERENCES `roles` (`name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 6. 用户配置表 ====================
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `display_name` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 7. 公告表 ====================
CREATE TABLE IF NOT EXISTS `notices` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT DEFAULT NULL,
  `department` VARCHAR(100) NOT NULL,
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `is_published` TINYINT(1) NOT NULL DEFAULT 1,
  `security_level` VARCHAR(20) NOT NULL DEFAULT '一般',
  `publish_scope` VARCHAR(20) NOT NULL DEFAULT 'all',
  `publish_scope_ids` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_published` (`is_published`),
  KEY `idx_is_pinned` (`is_pinned`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 8. 通知图片表 ====================
CREATE TABLE IF NOT EXISTS `notice_images` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` VARCHAR(255) NOT NULL DEFAULT '',
  `image_url` VARCHAR(500) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 9. 轮播图表 ====================
CREATE TABLE IF NOT EXISTS `banners` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` VARCHAR(255) NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 10. 食堂菜单表 ====================
CREATE TABLE IF NOT EXISTS `canteen_menus` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `day_of_week` INT NOT NULL COMMENT '1-7 代表周一到周日',
  `breakfast` JSON DEFAULT NULL,
  `lunch` JSON DEFAULT NULL,
  `dinner` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_day_of_week` (`day_of_week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 11. 请假/外出/出差记录表 ====================
CREATE TABLE IF NOT EXISTS `absence_records` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `contact_id` CHAR(36) NOT NULL,
  `type` VARCHAR(20) NOT NULL COMMENT 'out/leave/business_trip/meeting',
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected/completed/cancelled',
  `reason` TEXT NOT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `leave_type` VARCHAR(20) DEFAULT NULL COMMENT 'annual/sick/personal/paternity/bereavement/maternity/nursing/marriage/compensatory',
  `duration_hours` DECIMAL(10,2) DEFAULT NULL,
  `duration_days` DECIMAL(10,2) DEFAULT NULL,
  `destination` VARCHAR(255) DEFAULT NULL,
  `transport_type` VARCHAR(50) DEFAULT NULL,
  `estimated_cost` DECIMAL(10,2) DEFAULT NULL,
  `companions` JSON DEFAULT NULL,
  `handover_person_id` CHAR(36) DEFAULT NULL,
  `handover_notes` TEXT DEFAULT NULL,
  `contact_phone` VARCHAR(50) DEFAULT NULL,
  `out_type` VARCHAR(50) DEFAULT NULL,
  `out_location` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `approved_by` CHAR(36) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `cancelled_at` DATETIME DEFAULT NULL,
  `cancel_reason` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_handover_person` (`handover_person_id`),
  CONSTRAINT `fk_absence_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_absence_handover` FOREIGN KEY (`handover_person_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 12. 日程表 ====================
CREATE TABLE IF NOT EXISTS `schedules` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `contact_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `schedule_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_schedule_date` (`schedule_date`),
  CONSTRAINT `fk_schedules_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 13. 领导日程表 ====================
CREATE TABLE IF NOT EXISTS `leader_schedules` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `leader_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `schedule_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `schedule_type` VARCHAR(50) NOT NULL DEFAULT 'internal_meeting',
  `location` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_leader_id` (`leader_id`),
  KEY `idx_schedule_date` (`schedule_date`),
  CONSTRAINT `fk_leader_schedules_leader` FOREIGN KEY (`leader_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 14. 领导日程查看权限表 ====================
CREATE TABLE IF NOT EXISTS `leader_schedule_permissions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `leader_id` CHAR(36) DEFAULT NULL,
  `can_view_all` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_leader_id` (`leader_id`),
  CONSTRAINT `fk_lsp_leader` FOREIGN KEY (`leader_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 15. 假期余额表 ====================
CREATE TABLE IF NOT EXISTS `leave_balances` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `contact_id` CHAR(36) NOT NULL,
  `year` INT NOT NULL DEFAULT (YEAR(CURRENT_DATE)),
  `annual_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 40 COMMENT '年假总额(小时)',
  `annual_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `sick_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 80 COMMENT '病假总额(小时)',
  `sick_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `personal_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 5 COMMENT '事假总额(天)',
  `personal_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `paternity_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '陪产假总额(天)',
  `paternity_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `bereavement_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '丧假总额(天)',
  `bereavement_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `maternity_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '产假总额(天)',
  `maternity_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `nursing_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '哺乳假总额(小时)',
  `nursing_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `marriage_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '婚假总额(天)',
  `marriage_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `compensatory_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '调休总额(小时)',
  `compensatory_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contact_year` (`contact_id`, `year`),
  CONSTRAINT `fk_leave_balances_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 16. 审批模板表 ====================
CREATE TABLE IF NOT EXISTS `approval_templates` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT '外出管理',
  `icon` VARCHAR(50) NOT NULL DEFAULT '📋',
  `business_type` VARCHAR(50) NOT NULL DEFAULT 'absence',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `allow_withdraw` TINYINT(1) NOT NULL DEFAULT 1,
  `allow_transfer` TINYINT(1) NOT NULL DEFAULT 0,
  `notify_initiator` TINYINT(1) NOT NULL DEFAULT 1,
  `notify_approver` TINYINT(1) NOT NULL DEFAULT 1,
  `auto_approve_timeout` INT DEFAULT NULL,
  `callback_url` VARCHAR(500) DEFAULT NULL,
  `current_version_id` CHAR(36) DEFAULT NULL,
  `last_process_saved_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 17. 审批流程版本表 ====================
CREATE TABLE IF NOT EXISTS `approval_process_versions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `template_id` CHAR(36) NOT NULL,
  `version_number` INT NOT NULL DEFAULT 1,
  `version_name` VARCHAR(100) NOT NULL,
  `nodes_snapshot` JSON DEFAULT NULL,
  `is_current` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT DEFAULT NULL,
  `published_by` VARCHAR(36) DEFAULT NULL,
  `published_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_template_id` (`template_id`),
  KEY `idx_is_current` (`is_current`),
  CONSTRAINT `fk_apv_template` FOREIGN KEY (`template_id`) REFERENCES `approval_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 审批模板的 current_version_id 外键（延迟添加，避免循环依赖）
ALTER TABLE `approval_templates`
  ADD CONSTRAINT `fk_at_current_version` FOREIGN KEY (`current_version_id`) REFERENCES `approval_process_versions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==================== 18. 审批节点表 ====================
CREATE TABLE IF NOT EXISTS `approval_nodes` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `template_id` CHAR(36) NOT NULL,
  `node_name` VARCHAR(255) NOT NULL,
  `node_type` VARCHAR(50) NOT NULL DEFAULT 'approver',
  `approver_type` VARCHAR(50) NOT NULL DEFAULT 'specific',
  `approver_ids` JSON DEFAULT NULL,
  `approval_mode` VARCHAR(50) NOT NULL DEFAULT 'countersign',
  `condition_expression` JSON DEFAULT NULL,
  `field_permissions` JSON DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_template_id` (`template_id`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_nodes_template` FOREIGN KEY (`template_id`) REFERENCES `approval_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 19. 审批表单字段表 ====================
CREATE TABLE IF NOT EXISTS `approval_form_fields` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `template_id` CHAR(36) NOT NULL,
  `field_type` VARCHAR(50) NOT NULL DEFAULT 'text',
  `field_name` VARCHAR(100) NOT NULL,
  `field_label` VARCHAR(100) NOT NULL,
  `placeholder` VARCHAR(255) DEFAULT NULL,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `field_options` JSON DEFAULT NULL,
  `col_span` INT NOT NULL DEFAULT 2,
  `default_value` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_template_id` (`template_id`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_form_fields_template` FOREIGN KEY (`template_id`) REFERENCES `approval_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 20. 审批实例表 ====================
CREATE TABLE IF NOT EXISTS `approval_instances` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `template_id` CHAR(36) NOT NULL,
  `version_id` CHAR(36) NOT NULL,
  `version_number` INT NOT NULL,
  `business_type` VARCHAR(50) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `initiator_id` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/in_progress/approved/rejected/withdrawn',
  `current_node_index` INT NOT NULL DEFAULT 0,
  `form_data` JSON DEFAULT NULL,
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_template_id` (`template_id`),
  KEY `idx_version_id` (`version_id`),
  KEY `idx_business_id` (`business_id`),
  KEY `idx_initiator_id` (`initiator_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_ai_template` FOREIGN KEY (`template_id`) REFERENCES `approval_templates` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ai_version` FOREIGN KEY (`version_id`) REFERENCES `approval_process_versions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ai_initiator` FOREIGN KEY (`initiator_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 21. 审批记录表 ====================
CREATE TABLE IF NOT EXISTS `approval_records` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `instance_id` CHAR(36) NOT NULL,
  `node_index` INT NOT NULL,
  `node_name` VARCHAR(255) NOT NULL,
  `node_type` VARCHAR(50) NOT NULL,
  `approver_id` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected/transferred',
  `comment` TEXT DEFAULT NULL,
  `transferred_to` CHAR(36) DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_instance_id` (`instance_id`),
  KEY `idx_approver_id` (`approver_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_ar_instance` FOREIGN KEY (`instance_id`) REFERENCES `approval_instances` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ar_approver` FOREIGN KEY (`approver_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ar_transferred` FOREIGN KEY (`transferred_to`) REFERENCES `contacts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 22. 待办事项表 ====================
CREATE TABLE IF NOT EXISTS `todo_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `business_type` VARCHAR(50) NOT NULL COMMENT 'leave/out/business_trip/supply_requisition/supply_purchase/purchase_request/file_transfer/meeting',
  `business_id` CHAR(36) DEFAULT NULL,
  `initiator_id` CHAR(36) DEFAULT NULL,
  `assignee_id` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/processing/completed/cancelled',
  `priority` VARCHAR(20) NOT NULL DEFAULT 'normal' COMMENT 'low/normal/high/urgent',
  `source` VARCHAR(20) NOT NULL DEFAULT 'internal' COMMENT 'internal/external',
  `source_system` VARCHAR(100) DEFAULT NULL,
  `source_department` VARCHAR(100) DEFAULT NULL,
  `action_url` VARCHAR(500) DEFAULT NULL,
  `due_date` DATETIME DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `processed_by` CHAR(36) DEFAULT NULL,
  `process_result` VARCHAR(50) DEFAULT NULL,
  `process_notes` TEXT DEFAULT NULL,
  `approval_instance_id` CHAR(36) DEFAULT NULL,
  `approval_version_number` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assignee_id` (`assignee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_business_type` (`business_type`),
  KEY `idx_initiator_id` (`initiator_id`),
  KEY `idx_approval_instance` (`approval_instance_id`),
  CONSTRAINT `fk_todo_assignee` FOREIGN KEY (`assignee_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_todo_initiator` FOREIGN KEY (`initiator_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_todo_processed_by` FOREIGN KEY (`processed_by`) REFERENCES `contacts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_todo_approval` FOREIGN KEY (`approval_instance_id`) REFERENCES `approval_instances` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 23. 文件收发表 ====================
CREATE TABLE IF NOT EXISTS `file_transfers` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` VARCHAR(255) NOT NULL,
  `doc_number` VARCHAR(100) NOT NULL,
  `send_unit` VARCHAR(255) NOT NULL,
  `send_unit_id` CHAR(36) DEFAULT NULL,
  `security_level` VARCHAR(20) NOT NULL DEFAULT '公开',
  `urgency` VARCHAR(20) NOT NULL DEFAULT '普通',
  `file_type` VARCHAR(50) DEFAULT '中央文件',
  `source_unit` VARCHAR(255) DEFAULT NULL,
  `document_date` DATE DEFAULT NULL,
  `main_unit` VARCHAR(255) DEFAULT NULL,
  `copy_unit` TEXT DEFAULT NULL,
  `sign_leader` VARCHAR(100) DEFAULT NULL,
  `sign_date` DATE DEFAULT NULL,
  `copies` INT DEFAULT 1,
  `send_type` VARCHAR(50) DEFAULT '不限制份数',
  `notify_type` VARCHAR(50) DEFAULT '不通知',
  `contact_person` VARCHAR(100) DEFAULT NULL,
  `contact_phone` VARCHAR(50) DEFAULT NULL,
  `confidential_period` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `attachments` JSON DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT '待签收',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_send_unit_id` (`send_unit_id`),
  CONSTRAINT `fk_ft_send_unit` FOREIGN KEY (`send_unit_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 24. 办公用品表 ====================
CREATE TABLE IF NOT EXISTS `office_supplies` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(255) NOT NULL,
  `specification` VARCHAR(255) DEFAULT NULL,
  `unit` VARCHAR(20) NOT NULL DEFAULT '个',
  `current_stock` INT NOT NULL DEFAULT 0,
  `min_stock` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 25. 领用申请表 ====================
CREATE TABLE IF NOT EXISTS `supply_requisitions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `requisition_by` CHAR(36) NOT NULL,
  `supply_id` CHAR(36) DEFAULT NULL,
  `quantity` INT DEFAULT NULL,
  `requisition_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `approved_by` CHAR(36) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_requisition_by` (`requisition_by`),
  KEY `idx_status` (`status`),
  KEY `idx_supply_id` (`supply_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 26. 领用申请明细表 ====================
CREATE TABLE IF NOT EXISTS `supply_requisition_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `requisition_id` CHAR(36) NOT NULL,
  `supply_id` CHAR(36) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_requisition_id` (`requisition_id`),
  KEY `idx_supply_id` (`supply_id`),
  CONSTRAINT `fk_sri_requisition` FOREIGN KEY (`requisition_id`) REFERENCES `supply_requisitions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sri_supply` FOREIGN KEY (`supply_id`) REFERENCES `office_supplies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 27. 采购申请表 ====================
CREATE TABLE IF NOT EXISTS `purchase_requests` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `requested_by` CHAR(36) NOT NULL,
  `supply_id` CHAR(36) DEFAULT NULL,
  `quantity` INT DEFAULT NULL,
  `unit_price` DECIMAL(10,2) DEFAULT NULL,
  `reason` TEXT DEFAULT NULL,
  `purpose` TEXT DEFAULT NULL,
  `department` VARCHAR(100) DEFAULT NULL,
  `funding_source` VARCHAR(100) DEFAULT NULL,
  `funding_detail` VARCHAR(255) DEFAULT NULL,
  `budget_amount` DECIMAL(10,2) DEFAULT 0,
  `total_amount` DECIMAL(10,2) DEFAULT 0,
  `procurement_method` VARCHAR(50) DEFAULT NULL,
  `expected_completion_date` DATE DEFAULT NULL,
  `purchase_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `approved_by` CHAR(36) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_requested_by` (`requested_by`),
  KEY `idx_status` (`status`),
  KEY `idx_supply_id` (`supply_id`),
  CONSTRAINT `fk_pr_supply` FOREIGN KEY (`supply_id`) REFERENCES `office_supplies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 28. 采购申请明细表 ====================
CREATE TABLE IF NOT EXISTS `purchase_request_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `request_id` CHAR(36) NOT NULL,
  `supply_id` CHAR(36) DEFAULT NULL,
  `item_name` VARCHAR(255) DEFAULT NULL,
  `specification` VARCHAR(255) DEFAULT NULL,
  `unit` VARCHAR(20) DEFAULT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `category_link` VARCHAR(500) DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_request_id` (`request_id`),
  KEY `idx_supply_id` (`supply_id`),
  CONSTRAINT `fk_pri_request` FOREIGN KEY (`request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pri_supply` FOREIGN KEY (`supply_id`) REFERENCES `office_supplies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 29. 办公采购表 ====================
CREATE TABLE IF NOT EXISTS `supply_purchases` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `applicant_id` CHAR(36) NOT NULL,
  `applicant_name` VARCHAR(100) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `reason` TEXT DEFAULT NULL,
  `total_amount` DECIMAL(10,2) DEFAULT 0,
  `purchase_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_applicant_id` (`applicant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 30. 办公采购明细表 ====================
CREATE TABLE IF NOT EXISTS `supply_purchase_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `purchase_id` CHAR(36) NOT NULL,
  `supply_id` CHAR(36) DEFAULT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `specification` VARCHAR(255) DEFAULT NULL,
  `unit` VARCHAR(20) DEFAULT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `remarks` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_id` (`purchase_id`),
  KEY `idx_supply_id` (`supply_id`),
  CONSTRAINT `fk_spi_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `supply_purchases` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_spi_supply` FOREIGN KEY (`supply_id`) REFERENCES `office_supplies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 31. 库存变动记录表 ====================
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `supply_id` CHAR(36) NOT NULL,
  `movement_type` VARCHAR(20) NOT NULL COMMENT 'in/out',
  `quantity` INT NOT NULL,
  `before_stock` INT NOT NULL,
  `after_stock` INT NOT NULL,
  `reference_type` VARCHAR(50) DEFAULT NULL,
  `reference_id` CHAR(36) DEFAULT NULL,
  `operator_name` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_supply_id` (`supply_id`),
  CONSTRAINT `fk_sm_supply` FOREIGN KEY (`supply_id`) REFERENCES `office_supplies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 第二部分：初始化数据（幂等写法）
-- ============================================================

-- 默认角色
INSERT INTO `roles` (`id`, `name`, `label`, `is_system`, `sort_order`)
SELECT UUID(), 'admin', '系统管理员', 1, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'admin');

INSERT INTO `roles` (`id`, `name`, `label`, `is_system`, `sort_order`)
SELECT UUID(), 'user', '普通用户', 1, 2 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'user');

-- 默认组织
INSERT INTO `organizations` (`id`, `name`, `short_name`, `level`, `sort_order`)
SELECT UUID(), 'xx州人民政府', '州政府', 1, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `organizations` WHERE `name` = 'xx州人民政府');

-- 默认管理员
SET @org_id = (SELECT `id` FROM `organizations` WHERE `name` = 'xx州人民政府' LIMIT 1);

INSERT INTO `contacts` (`id`, `name`, `mobile`, `account`, `email`, `position`, `department`, `organization_id`, `is_leader`, `is_active`, `security_level`, `password_hash`)
SELECT UUID(), '系统管理员', '13800000001', 'admin@gov.cn', 'admin@gov.cn', '管理员', '信息中心', @org_id, 1, 1, '机密', '123456' FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `contacts` WHERE `account` = 'admin@gov.cn');

-- 管理员角色绑定
SET @admin_id = (SELECT `id` FROM `contacts` WHERE `account` = 'admin@gov.cn' LIMIT 1);

INSERT INTO `user_roles` (`id`, `user_id`, `role`)
SELECT UUID(), @admin_id, 'admin' FROM dual
WHERE @admin_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM `user_roles` WHERE `user_id` = @admin_id AND `role` = 'admin');

-- 默认办公用品
INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '中性笔', '0.5mm黑色', '支', 100, 20, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '中性笔' AND `specification` = '0.5mm黑色');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), 'A4复印纸', '70g 500张/包', '包', 50, 10, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = 'A4复印纸');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '订书机', '小号', '个', 20, 5, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '订书机');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '订书钉', '24/6', '盒', 100, 20, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '订书钉');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '文件夹', 'A4单夹', '个', 80, 15, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '文件夹');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '档案盒', 'A4厚型', '个', 50, 10, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '档案盒');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '回形针', '29mm', '盒', 60, 10, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '回形针');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '便签纸', '76x76mm', '本', 40, 10, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '便签纸');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '笔记本', 'A5软皮', '本', 30, 10, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '笔记本');

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`)
SELECT UUID(), '胶带', '透明48mm', '卷', 40, 10, 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `office_supplies` WHERE `name` = '胶带');

-- 默认审批模板
INSERT INTO `approval_templates` (`id`, `code`, `name`, `description`, `category`, `icon`, `business_type`, `is_active`)
SELECT UUID(), 'PROC_LEAVE', '请假申请', '员工请假申请流程', '外出管理', '🏖️', 'leave', 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_LEAVE');

INSERT INTO `approval_templates` (`id`, `code`, `name`, `description`, `category`, `icon`, `business_type`, `is_active`)
SELECT UUID(), 'PROC_OUT', '外出申请', '员工临时外出申请流程', '外出管理', '🚶', 'out', 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_OUT');

INSERT INTO `approval_templates` (`id`, `code`, `name`, `description`, `category`, `icon`, `business_type`, `is_active`)
SELECT UUID(), 'PROC_TRIP', '出差申请', '员工出差申请流程', '外出管理', '🚗', 'business_trip', 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_TRIP');

INSERT INTO `approval_templates` (`id`, `code`, `name`, `description`, `category`, `icon`, `business_type`, `is_active`)
SELECT UUID(), 'PROC_REQ', '物品领用', '办公用品领用申请流程', '办公用品', '📦', 'supply_requisition', 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_REQ');

INSERT INTO `approval_templates` (`id`, `code`, `name`, `description`, `category`, `icon`, `business_type`, `is_active`)
SELECT UUID(), 'PROC_PURCHASE', '办公采购', '处室办公用品采购申请流程', '办公用品', '🛒', 'supply_purchase', 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_PURCHASE');

INSERT INTO `approval_templates` (`id`, `code`, `name`, `description`, `category`, `icon`, `business_type`, `is_active`)
SELECT UUID(), 'PROC_GOV', '政府采购申请', '政府采购申请流程', '采购管理', '💰', 'purchase_request', 1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_GOV');

-- ============================================================
-- 第三部分：存储过程
-- ============================================================

-- 登录验证
DELIMITER //

DROP PROCEDURE IF EXISTS `verify_contact_login`//

CREATE PROCEDURE `verify_contact_login`(
  IN p_identifier VARCHAR(100),
  IN p_password VARCHAR(255)
)
BEGIN
  SELECT 
    c.id AS contact_id,
    c.name AS contact_name,
    c.mobile AS contact_mobile,
    c.account AS contact_account,
    c.position AS contact_position,
    c.department AS contact_department,
    o.name AS organization_name,
    c.security_level AS contact_security_level,
    c.organization_id AS contact_organization_id
  FROM contacts c
  LEFT JOIN organizations o ON c.organization_id = o.id
  WHERE (c.mobile = p_identifier OR c.account = p_identifier)
    AND c.password_hash = p_password 
    AND c.is_active = 1;
END //

-- 假期余额扣减
DROP PROCEDURE IF EXISTS `deduct_leave_balance`//

CREATE PROCEDURE `deduct_leave_balance`(
  IN p_contact_id CHAR(36),
  IN p_leave_type VARCHAR(20),
  IN p_duration_hours DECIMAL(10,2),
  IN p_duration_days DECIMAL(10,2)
)
BEGIN
  DECLARE v_current_year INT DEFAULT YEAR(CURDATE());
  DECLARE v_deduct_value DECIMAL(10,2);
  
  -- 按假期类型确定扣减值
  -- 年假/病假/哺乳假/调休 按小时；事假/陪产假/丧假/产假/婚假 按天
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
END //

-- 联系人状态同步
DROP PROCEDURE IF EXISTS `sync_contact_status`//

CREATE PROCEDURE `sync_contact_status`()
BEGIN
  DECLARE v_updated INT DEFAULT 0;
  
  -- 1. 恢复已过期的请假/外出/出差状态为在职
  UPDATE contacts c
  SET c.status = 'on_duty', c.status_note = NULL, c.updated_at = NOW()
  WHERE c.status IN ('leave', 'out', 'business_trip')
  AND NOT EXISTS (
    SELECT 1 FROM absence_records ar
    INNER JOIN approval_instances ai ON ai.business_id = ar.id AND ai.business_type = 'absence'
    WHERE ar.contact_id = c.id
      AND ar.status = 'approved'
      AND ai.status = 'approved'
      AND ar.start_time <= NOW()
      AND (ar.end_time IS NULL OR ar.end_time > NOW())
  );
  
  SET v_updated = v_updated + ROW_COUNT();
  
  -- 2. 将当前正在请假/外出/出差的在职人员状态更新
  UPDATE contacts c
  INNER JOIN (
    SELECT ar.contact_id, ar.type, ar.reason
    FROM absence_records ar
    INNER JOIN approval_instances ai ON ai.business_id = ar.id AND ai.business_type = 'absence'
    WHERE ar.status = 'approved'
      AND ai.status = 'approved'
      AND ar.start_time <= NOW()
      AND (ar.end_time IS NULL OR ar.end_time > NOW())
    ORDER BY ar.start_time DESC
  ) latest ON latest.contact_id = c.id
  SET c.status = latest.type, c.status_note = latest.reason, c.updated_at = NOW()
  WHERE c.status = 'on_duty';
  
  SET v_updated = v_updated + ROW_COUNT();
  
  SELECT v_updated AS updated_count;
END //

DELIMITER ;

-- ============================================================
-- 完成
-- ============================================================
SELECT '数据库初始化完成! 共 31 张表, 3 个存储过程' AS message;
