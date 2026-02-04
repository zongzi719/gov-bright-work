-- ============================================
-- 党政办公平台 - MariaDB数据库初始化脚本
-- 适用于MariaDB 10.3+ (aarch64)
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==================== 组织架构表 ====================
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(255) NOT NULL,
  `short_name` VARCHAR(100) DEFAULT NULL,
  `parent_id` CHAR(36) DEFAULT NULL,
  `level` INT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `phone` VARCHAR(50) DEFAULT NULL,
  `address` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 通讯录表 ====================
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(100) NOT NULL,
  `mobile` VARCHAR(20) DEFAULT NULL,
  `account` VARCHAR(100) DEFAULT NULL COMMENT '登录账号',
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
  `status` VARCHAR(20) NOT NULL DEFAULT 'on_duty',
  `status_note` VARCHAR(255) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL DEFAULT '123456',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_organization_id` (`organization_id`),
  KEY `idx_mobile` (`mobile`),
  KEY `idx_account` (`account`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 角色表 ====================
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

-- ==================== 用户角色关联表 ====================
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 公告表 ====================
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

-- ==================== 轮播图/导航背景表 ====================
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

-- ==================== 食堂菜单表 ====================
CREATE TABLE IF NOT EXISTS `canteen_menus` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `day_of_week` INT NOT NULL COMMENT '1-7代表周一到周日',
  `breakfast` JSON DEFAULT NULL,
  `lunch` JSON DEFAULT NULL,
  `dinner` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_day_of_week` (`day_of_week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 请假/外出/出差记录表 ====================
CREATE TABLE IF NOT EXISTS `absence_records` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `contact_id` CHAR(36) NOT NULL,
  `type` VARCHAR(20) NOT NULL COMMENT 'out/leave/business_trip/meeting',
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `reason` TEXT NOT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `leave_type` VARCHAR(20) DEFAULT NULL COMMENT 'annual/sick/personal',
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
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 日程表 ====================
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
  KEY `idx_schedule_date` (`schedule_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 领导日程表 ====================
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
  KEY `idx_schedule_date` (`schedule_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 待办事项表 ====================
CREATE TABLE IF NOT EXISTS `todo_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `business_type` VARCHAR(50) NOT NULL,
  `business_id` CHAR(36) DEFAULT NULL,
  `initiator_id` CHAR(36) DEFAULT NULL,
  `assignee_id` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `priority` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `source` VARCHAR(20) NOT NULL DEFAULT 'internal',
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
  KEY `idx_business_type` (`business_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 办公用品表 ====================
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

-- ==================== 文件收发表 ====================
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
  KEY `idx_send_unit_id` (`send_unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 审批模板表 ====================
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

-- ==================== 审批节点表 ====================
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
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 审批实例表 ====================
CREATE TABLE IF NOT EXISTS `approval_instances` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `template_id` CHAR(36) NOT NULL,
  `version_id` CHAR(36) NOT NULL,
  `version_number` INT NOT NULL,
  `business_type` VARCHAR(50) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `initiator_id` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `current_node_index` INT NOT NULL DEFAULT 0,
  `form_data` JSON DEFAULT NULL,
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_template_id` (`template_id`),
  KEY `idx_business_id` (`business_id`),
  KEY `idx_initiator_id` (`initiator_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 审批表单字段表 ====================
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
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 审批记录表 ====================
CREATE TABLE IF NOT EXISTS `approval_records` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `instance_id` CHAR(36) NOT NULL,
  `node_index` INT NOT NULL,
  `node_name` VARCHAR(255) NOT NULL,
  `node_type` VARCHAR(50) NOT NULL,
  `approver_id` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `comment` TEXT DEFAULT NULL,
  `transferred_to` CHAR(36) DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_instance_id` (`instance_id`),
  KEY `idx_approver_id` (`approver_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 假期余额表 ====================
CREATE TABLE IF NOT EXISTS `leave_balances` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `contact_id` CHAR(36) NOT NULL,
  `year` INT NOT NULL DEFAULT (YEAR(CURRENT_DATE)),
  `annual_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 5,
  `annual_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `sick_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 10,
  `sick_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `personal_leave_total` DECIMAL(10,2) NOT NULL DEFAULT 5,
  `personal_leave_used` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contact_year` (`contact_id`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 通知图片表 ====================
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

-- ==================== 领用申请表 ====================
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
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 领用申请明细表 ====================
CREATE TABLE IF NOT EXISTS `supply_requisition_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `requisition_id` CHAR(36) NOT NULL,
  `supply_id` CHAR(36) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_requisition_id` (`requisition_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 采购申请表 ====================
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
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 采购申请明细表 ====================
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
  KEY `idx_request_id` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 办公采购表 ====================
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

-- ==================== 办公采购明细表 ====================
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
  KEY `idx_purchase_id` (`purchase_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 库存变动记录表 ====================
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
  KEY `idx_supply_id` (`supply_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 审批流程版本表 ====================
CREATE TABLE IF NOT EXISTS `approval_process_versions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `template_id` CHAR(36) NOT NULL,
  `version_number` INT NOT NULL DEFAULT 1,
  `version_name` VARCHAR(100) NOT NULL,
  `nodes_snapshot` JSON DEFAULT NULL,
  `is_current` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT DEFAULT NULL,
  `published_by` CHAR(36) DEFAULT NULL,
  `published_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_template_id` (`template_id`),
  KEY `idx_is_current` (`is_current`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 领导日程查看权限表 ====================
CREATE TABLE IF NOT EXISTS `leader_schedule_permissions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `leader_id` CHAR(36) DEFAULT NULL,
  `can_view_all` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 初始化默认数据 ====================

-- 插入默认角色
INSERT INTO `roles` (`id`, `name`, `label`, `is_system`, `sort_order`) VALUES
(UUID(), 'admin', '系统管理员', 1, 1),
(UUID(), 'user', '普通用户', 1, 2);

-- 插入示例组织（使用固定ID以便后续关联）
SET @org_id = UUID();
INSERT INTO `organizations` (`id`, `name`, `short_name`, `level`, `sort_order`) VALUES
(@org_id, 'xx州人民政府', '州政府', 1, 1);

-- 插入默认测试用户
SET @admin_id = UUID();
INSERT INTO `contacts` (`id`, `name`, `mobile`, `account`, `email`, `position`, `department`, `organization_id`, `is_leader`, `is_active`, `security_level`, `password_hash`) VALUES
(@admin_id, '系统管理员', '13800000001', 'admin@gov.cn', 'admin@gov.cn', '管理员', '信息中心', @org_id, 1, 1, '机密', '123456');

-- 为测试用户分配管理员角色
INSERT INTO `user_roles` (`id`, `user_id`, `role`) VALUES
(UUID(), @admin_id, 'admin');

-- ==================== 插入示例办公用品数据 ====================
INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`) VALUES
(UUID(), '中性笔', '0.5mm黑色', '支', 100, 20, 1),
(UUID(), 'A4复印纸', '70g 500张/包', '包', 50, 10, 1),
(UUID(), '订书机', '小号', '个', 20, 5, 1),
(UUID(), '订书钉', '24/6', '盒', 100, 20, 1),
(UUID(), '文件夹', 'A4单夹', '个', 80, 15, 1),
(UUID(), '档案盒', 'A4厚型', '个', 50, 10, 1),
(UUID(), '回形针', '29mm', '盒', 60, 10, 1),
(UUID(), '便签纸', '76x76mm', '本', 40, 10, 1),
(UUID(), '笔记本', 'A5软皮', '本', 30, 10, 1),
(UUID(), '胶带', '透明48mm', '卷', 40, 10, 1);

-- ==================== 初始化默认审批模板 ====================
INSERT INTO `approval_templates` (`id`, `code`, `name`, `description`, `category`, `icon`, `business_type`, `is_active`) VALUES
(UUID(), 'PROC_LEAVE', '请假申请', '员工请假申请流程', '外出管理', '🏖️', 'leave', 1),
(UUID(), 'PROC_OUT', '外出申请', '员工临时外出申请流程', '外出管理', '🚶', 'out', 1),
(UUID(), 'PROC_TRIP', '出差申请', '员工出差申请流程', '外出管理', '🚗', 'business_trip', 1),
(UUID(), 'PROC_REQ', '物品领用', '办公用品领用申请流程', '办公用品', '📦', 'supply_requisition', 1),
(UUID(), 'PROC_PURCHASE', '办公采购', '处室办公用品采购申请流程', '办公用品', '🛒', 'supply_purchase', 1),
(UUID(), 'PROC_GOV', '政府采购申请', '政府采购申请流程', '采购管理', '💰', 'purchase_request', 1);

SET FOREIGN_KEY_CHECKS = 1;

-- ==================== 登录验证存储过程 ====================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS `verify_contact_login`(
  IN p_identifier VARCHAR(100),
  IN p_password VARCHAR(255)
)
BEGIN
  SELECT 
    c.id as contact_id,
    c.name as contact_name,
    c.mobile as contact_mobile,
    c.account as contact_account,
    c.position as contact_position,
    c.department as contact_department,
    o.name as organization_name,
    c.security_level as contact_security_level,
    c.organization_id as contact_organization_id
  FROM contacts c
  LEFT JOIN organizations o ON c.organization_id = o.id
  WHERE (c.mobile = p_identifier OR c.account = p_identifier)
    AND c.password_hash = p_password 
    AND c.is_active = 1;
END //

DELIMITER ;

-- 完成
SELECT '数据库初始化完成!' as message;
