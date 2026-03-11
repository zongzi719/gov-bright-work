-- ============================================
-- 党政办公平台 - 基础数据导入脚本（从 Supabase 导出）
-- 适用于 MariaDB 10.3+
-- 执行前提：已执行 init.sql 创建表结构
-- 注意：init.sql 中已有的数据（简单角色、单个组织、单个管理员、
--       简单办公用品、审批模板骨架）会被此脚本覆盖为完整数据
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. 组织架构（11个部门，保留原始UUID）
-- ============================================================

-- 先清空再插入，确保数据一致
DELETE FROM `organizations`;

INSERT INTO `organizations` (`id`, `name`, `short_name`, `parent_id`, `level`, `sort_order`, `phone`, `address`) VALUES
('4910addd-88b4-47c8-aef5-7729a9c35920', '州人民政府办公室', '州政府办', NULL, 1, 1, '0851-12345678', '州政府大楼1号楼'),
('a770f66a-6dc7-4a8f-b03f-645744c71a63', '州发展和改革委员会', '州发改委', '5bb92b2e-0667-4ca4-b8db-2dfc2106944c', 1, 2, '0851-12345679', '州政府大楼2号楼'),
('684e1333-d1d4-48a5-9934-0739f4c9c62f', '州教育局', '州教育局', NULL, 1, 3, '0851-12345680', '教育大厦A栋'),
('5bb92b2e-0667-4ca4-b8db-2dfc2106944c', '州公安局', '州公安局', NULL, 1, 4, '0851-12345681', '公安大厦'),
('c22a3e78-0c08-42d5-ad0c-238760999dba', '州财政局', '州财政局', NULL, 1, 5, '0851-12345682', '财政大楼'),
('62625215-19f4-4445-842d-c2baa86a1b59', '州人力资源和社会保障局', '州人社局', NULL, 1, 6, '0851-12345683', '人社大厦'),
('ebbdec13-69fc-44ca-bb9d-56d21faa00b0', '州自然资源局', '州自然资源局', NULL, 1, 7, '0851-12345684', '自然资源大厦'),
('74cdb875-def6-40d4-aff8-ef1c79fb6d6f', '州住房和城乡建设局', '州住建局', NULL, 1, 8, '0851-12345685', '住建大厦'),
('c2f0d252-220f-448f-8db6-dade3c444c9e', '州交通运输局', '州交通局', '684e1333-d1d4-48a5-9934-0739f4c9c62f', 1, 9, '0851-12345686', '交通大厦'),
('dfb1a8b4-3961-4dae-b100-594ddbf01bc3', '州农业农村局', '州农业局', NULL, 1, 10, '0851-12345687', '农业大厦'),
('5d2085db-b4c2-4492-9dc8-7335be2f0794', '洲人民政府-信访办', '洲人民政府-信访办', '4910addd-88b4-47c8-aef5-7729a9c35920', 1, 0, '0672-2786531', '洲人民政府-信访办-A-101');

-- ============================================================
-- 2. 人员通讯录（20人，保留原始UUID）
-- ============================================================

DELETE FROM `contacts`;

INSERT INTO `contacts` (`id`, `name`, `mobile`, `phone`, `email`, `position`, `department`, `organization_id`, `is_leader`, `is_active`, `sort_order`, `office_location`, `first_work_date`, `security_level`, `status`, `password_hash`) VALUES
-- 各局局长/主任（sort_order=1）
('f734d35b-8388-4691-82a2-10a06ed27982', '何振国', '13000130001', '0851-02345678', 'hezhenguo@gov.cn', '局长', '办公室', 'dfb1a8b4-3961-4dae-b100-594ddbf01bc3', 1, 1, 1, '农业大厦701室', NULL, '公开', 'on_duty', '123456'),
('93c27e22-125f-4984-8123-c575e71fdeb4', '冯志远', '13500135001', '0851-52345678', 'fengzhiyuan@gov.cn', '局长', '办公室', 'c22a3e78-0c08-42d5-ad0c-238760999dba', 1, 1, 1, '财政大楼801室', NULL, '公开', 'on_duty', '123456'),
('7b59aa90-0e0f-4045-a54c-7d620587b458', '卫国强', '13400134001', '0851-62345678', 'weiguoqiang@gov.cn', '局长', '办公室', '62625215-19f4-4445-842d-c2baa86a1b59', 1, 1, 1, '人社大厦701室', NULL, '公开', 'on_duty', '123456'),
('7df23296-868d-4e52-870b-e9a2df816206', '孙文斌', '13700137001', '0851-32345678', 'sunwenbin@gov.cn', '局长', '办公室', '684e1333-d1d4-48a5-9934-0739f4c9c62f', 0, 1, 1, 'A栋801室', NULL, '公开', 'on_duty', '123456'),
('bc9e9efd-de26-4c40-988e-453cf8c109fc', '尤建峰', '13100131001', '0851-92345678', 'youjianfeng@gov.cn', '局长', '办公室', 'c2f0d252-220f-448f-8db6-dade3c444c9e', 0, 1, 1, '交通大厦801室', NULL, '公开', 'on_duty', '123456'),
('342ba74d-a7dc-4e31-9310-dae66eacad17', '朱明亮', '13200132001', '0851-82345678', 'zhumingliang@gov.cn', '局长', '办公室', '74cdb875-def6-40d4-aff8-ef1c79fb6d6f', 0, 1, 1, '住建大厦901室', '2026-01-28', '公开', 'on_duty', '123456'),
('4be38d0e-2943-46bc-ac3f-290bee7531ec', '李明华', '13800138001', '0851-12345678', 'liminghua@gov.cn', '主任', '办公室', 'c22a3e78-0c08-42d5-ad0c-238760999dba', 1, 1, 1, '1号楼501室', NULL, '公开', 'on_duty', '123456'),
('00a96fe3-f716-41e0-8b2e-16f51e3d578d', '沈建华', '13300133001', '0851-72345678', 'shenjianhua@gov.cn', '局长', '办公室', 'ebbdec13-69fc-44ca-bb9d-56d21faa00b0', 0, 1, 1, '自然资源大厦801室', NULL, '公开', 'on_duty', '123456'),
('04ca79b1-64f6-4102-9f8a-ccbdda076ca1', '钱国庆', '13600136001', '0851-42345678', 'qianguoqing@gov.cn', '局长', '办公室', '5bb92b2e-0667-4ca4-b8db-2dfc2106944c', 1, 1, 1, '公安大厦901室', NULL, '公开', 'on_duty', '123456'),
('8881090f-8145-49c7-ad1e-edec6195e098', '陈建国', '13900139001', '0851-22345678', 'chenjianguo@gov.cn', '主任', '办公室', 'a770f66a-6dc7-4a8f-b03f-645744c71a63', 0, 1, 1, '2号楼601室', NULL, '公开', 'on_duty', '123456'),
-- 副职/科长（sort_order=2）
('8ccef7e7-9746-480e-96d2-c59c72e69263', '刘晓燕', '13900139002', '0851-22345679', 'liuxiaoyan@gov.cn', '副主任', '投资科', 'a770f66a-6dc7-4a8f-b03f-645744c71a63', 1, 1, 2, '2号楼602室', NULL, '一般', 'on_duty', '123456'),
('9994c178-5351-48e3-b2cb-02c1f44070ec', '吕春华', '13000130002', '0851-02345679', 'lvchunhua@gov.cn', '副局长', '种植业科', 'dfb1a8b4-3961-4dae-b100-594ddbf01bc3', 0, 1, 2, '农业大厦702室', NULL, '一般', 'on_duty', '123456'),
('60df0e23-5bd8-46e6-b033-6d1f42453990', '周红梅', '13700137002', '0851-32345679', 'zhouhongmei@gov.cn', '科长', '基础教育科', '684e1333-d1d4-48a5-9934-0739f4c9c62f', 0, 1, 2, 'A栋802室', NULL, '一般', 'on_duty', '123456'),
('06ce77c1-dbab-44fb-857e-b3d16a381475', '马国栋', '13500135002', '0851-52345679', 'maguodong@gov.cn', '副局长', '预算科', 'c22a3e78-0c08-42d5-ad0c-238760999dba', 0, 1, 2, '财政大楼802室', NULL, '一般', 'on_duty', '123456'),
('23e2fbd2-b7a8-4527-b76a-f434fd13b554', '唐凤英', '13400134002', '0851-62345679', 'tangfengying@gov.cn', '副局长', '就业科', '62625215-19f4-4445-842d-c2baa86a1b59', 0, 1, 2, '人社大厦702室', NULL, '一般', 'on_duty', '123456'),
('cd4f2dae-c5b3-45f3-ada7-92ea6c6a5a37', '赵立伟', '13600136002', '0851-42345679', 'zhaoliwei@gov.cn', '副局长', '刑侦支队', '5bb92b2e-0667-4ca4-b8db-2dfc2106944c', 0, 1, 2, '公安大厦902室', NULL, '一般', 'on_duty', '123456'),
('a0d20ddd-1e4e-4c16-9e3a-fc2aa4c7af7a', '许慧芳', '13300133002', '0851-72345679', 'xuhuifang@gov.cn', '副局长', '规划科', 'ebbdec13-69fc-44ca-bb9d-56d21faa00b0', 0, 1, 2, '自然资源大厦802室', NULL, '一般', 'on_duty', '123456'),
('4a637f4c-2c19-498e-a1b2-38f10e16b76b', '郭志强', '13200132002', '0851-82345679', 'guozhiqiang@gov.cn', '副局长', '工程科', '74cdb875-def6-40d4-aff8-ef1c79fb6d6f', 0, 1, 2, '住建大厦902室', NULL, '一般', 'on_duty', '123456'),
('3ec3d508-e4e7-4eee-b1bb-bb3a6e5daabd', '方晓东', '13100131002', '0851-92345679', 'fangxiaodong@gov.cn', '副局长', '路政科', 'c2f0d252-220f-448f-8db6-dade3c444c9e', 0, 1, 2, '交通大厦802室', NULL, '一般', 'on_duty', '123456'),
('b08d9e09-e86e-45e7-b1a3-e39f54ddd13f', '韩永生', '13800138002', '0851-12345679', 'hanyongsheng@gov.cn', '副主任', '综合科', '4910addd-88b4-47c8-aef5-7729a9c35920', 0, 1, 2, '1号楼502室', NULL, '一般', 'on_duty', '123456');

-- 更新组织的 department_head_id 和 direct_supervisor_id
UPDATE `organizations` SET `department_head_id` = '60df0e23-5bd8-46e6-b033-6d1f42453990', `direct_supervisor_id` = '60df0e23-5bd8-46e6-b033-6d1f42453990' WHERE `id` = 'a770f66a-6dc7-4a8f-b03f-645744c71a63';
UPDATE `organizations` SET `department_head_id` = '4be38d0e-2943-46bc-ac3f-290bee7531ec', `direct_supervisor_id` = '93c27e22-125f-4984-8123-c575e71fdeb4' WHERE `id` = '684e1333-d1d4-48a5-9934-0739f4c9c62f';

-- ============================================================
-- 3. 角色（覆盖 init.sql 的简单数据，添加描述）
-- ============================================================

DELETE FROM `roles`;

INSERT INTO `roles` (`id`, `name`, `label`, `description`, `is_system`, `is_active`, `sort_order`) VALUES
('5f75a1e7-597f-431d-81a7-862a4fccc10c', 'admin', '管理员', '拥有系统所有权限，可以管理所有模块和用户', 1, 1, 1),
('d2aec739-98cb-4d8c-ac89-265d91c8eb26', 'user', '普通用户', '普通用户，权限受限，只能操作授权的模块', 1, 1, 2);

-- ============================================================
-- 4. 角色权限（18条，admin 9个模块全权限 + user 9个模块受限权限）
-- ============================================================

DELETE FROM `role_permissions`;

INSERT INTO `role_permissions` (`id`, `role`, `module_name`, `module_label`, `can_create`, `can_read`, `can_update`, `can_delete`, `data_scope`) VALUES
-- admin 权限
('74b2e3f6-c25c-48b8-bc79-129431bd1db8', 'admin', 'absences', '外出管理', 1, 1, 1, 1, 'all'),
('ff4501a5-b470-47a5-a9d1-891c80694d7c', 'admin', 'banners', '轮播图管理', 1, 1, 1, 1, 'all'),
('1d730ca3-edec-4ad7-88ec-2e61d063ada6', 'admin', 'contacts', '通讯录管理', 1, 1, 1, 1, 'all'),
('7cffb1de-fa72-4998-82f0-d8455233236d', 'admin', 'leaves', '假期管理', 1, 1, 1, 1, 'all'),
('de8d5be3-42e5-45d1-a851-b423299f2845', 'admin', 'menus', '食堂菜单', 1, 1, 1, 1, 'all'),
('8de7ff32-384a-4d4c-80f2-c77b3387bcd7', 'admin', 'notices', '通知公告', 1, 1, 1, 1, 'all'),
('30e56a0e-f0fe-4621-8536-d72eec762d2c', 'admin', 'organizations', '组织架构', 1, 1, 1, 1, 'all'),
('a6bde195-2c06-4754-9b28-3d15ee0bcf82', 'admin', 'supplies', '办公用品', 1, 1, 1, 1, 'all'),
('c75152fa-c0d8-42ff-89c5-2a00e05e5126', 'admin', 'system', '系统管理', 1, 1, 1, 1, 'all'),
-- user 权限
('0013cfcd-f0db-4443-bba6-c03980eec4ce', 'user', 'absences', '外出管理', 1, 1, 1, 0, 'self'),
('aab41468-b786-47a6-b107-ae58ebfc985e', 'user', 'banners', '轮播图管理', 0, 1, 0, 0, 'all'),
('53a67fc5-f248-4c35-9658-5aa20f448f7c', 'user', 'contacts', '通讯录管理', 0, 1, 0, 0, 'department'),
('861bdde0-ee32-4b95-9afa-a0a30807f319', 'user', 'leaves', '假期管理', 0, 1, 0, 0, 'self'),
('7f203f4b-33a7-4bca-aa98-673421a8b104', 'user', 'menus', '食堂菜单', 0, 1, 0, 0, 'all'),
('56f59f01-a584-476e-93b8-57b38c357bf4', 'user', 'notices', '通知公告', 0, 1, 0, 0, 'all'),
('f5a0b5ff-fa5a-46d2-bc88-5b24d771f558', 'user', 'organizations', '组织架构', 0, 1, 0, 0, 'all'),
('87dd8219-7541-4e28-be13-2ef32c89f25a', 'user', 'supplies', '办公用品', 1, 1, 0, 0, 'self'),
('11abfebb-1c6b-4511-9157-aeaafa450000', 'user', 'system', '系统管理', 0, 0, 0, 0, 'self');

-- ============================================================
-- 5. 用户角色绑定（为李明华绑定 admin，用其 contact_id 作为 user_id）
-- ============================================================

DELETE FROM `user_roles`;

-- 注意：离线版中 user_id 对应 contacts.id（而非 Supabase auth.users.id）
-- 管理员绑定：使用李明华的 contact_id
INSERT INTO `user_roles` (`id`, `user_id`, `role`) VALUES
('4ac79aba-5393-4ff9-82d4-fcea40626d35', '4be38d0e-2943-46bc-ac3f-290bee7531ec', 'admin');

-- ============================================================
-- 6. 办公用品（24种，覆盖 init.sql 的简单数据）
-- ============================================================

DELETE FROM `office_supplies`;

INSERT INTO `office_supplies` (`id`, `name`, `specification`, `unit`, `current_stock`, `min_stock`, `is_active`) VALUES
('fa567214-7457-441a-9b62-1ba1dd6b1625', 'A3复印纸', '80g 500张/包', '包', 20, 5, 1),
('17bf8e89-f0c9-4680-a50f-db64985c6d62', 'A4复印纸', '80g 500张/包', '包', 50, 10, 1),
('0b363340-4de4-43b3-85dd-bf02c1119bf1', '中性笔（红色）', '0.5mm', '支', 50, 10, 1),
('4ac0d2d6-1696-4236-8e3d-7eef3677cfa0', '中性笔（蓝色）', '0.5mm', '支', 80, 20, 1),
('8e8a71e3-9fd1-4e47-8c60-3961dea351e9', '中性笔（黑色）', '0.5mm', '支', 100, 20, 1),
('5a87f6fc-d80c-4239-b48e-4791291c0b57', '便签纸', '76x76mm 100张', '本', 50, 15, 1),
('27b83ba0-17d7-4a2d-bd91-11d161f8641d', '剪刀', '办公剪刀', '把', 10, 3, 1),
('605c3073-fcac-4ae0-adaf-ee78bbfa88ba', '印台', '红色', '个', 5, 2, 1),
('0917a97e-ec24-4dce-8500-4dda1a65edc5', '印油', '红色', '瓶', 8, 2, 1),
('0110753a-d1c1-430c-b54a-35e6c4691b11', '双面胶', '宽12mm', '卷', 15, 5, 1),
('a5cf278e-cbcc-4a59-89a2-be9fa211cc6a', '回形针', '29mm', '盒', 25, 8, 1),
('78db9222-9539-4211-92af-39696563c613', '文件夹', 'A4双夹', '个', 40, 10, 1),
('65107bad-923b-490b-a41c-0c4515468c3c', '文件袋', 'A4透明', '个', 60, 15, 1),
('7e5b296f-9740-4fed-95f0-0ec03226762b', '档案盒', 'A4 55mm', '个', 30, 8, 1),
('ade7b98d-233d-47fe-b252-b05a9d08d578', '橡皮擦', '普通', '块', 40, 10, 1),
('9ac35387-826d-4da8-93a8-a88923c426dd', '白板笔', '黑色', '支', 20, 5, 1),
('cb647969-5aa8-41bc-932e-9ff78f4ab222', '笔记本', 'A5 80页', '本', 30, 10, 1),
('a7b722ff-7d3c-4541-b365-15e8c3dbf6ec', '美工刀', '标准型', '把', 8, 2, 1),
('88a90316-dda2-4d88-9a67-2f58f0cfd53c', '计算器', '12位', '个', 10, 2, 1),
('49fa02a5-7184-4295-bfd0-0bef38426dfd', '订书机', '标准型', '个', 15, 3, 1),
('076ca374-f952-414e-a0c8-ce1b74d84e3e', '订书钉', '24/6', '盒', 30, 10, 1),
('baf69b84-28e0-412b-858c-d01954f7306b', '透明胶带', '宽48mm', '卷', 20, 5, 1),
('d58f6d56-1d48-4dba-893b-e6a2dfd57499', '铅笔', '2B', '支', 60, 15, 1),
('e1c1bc3e-13f8-4b37-a14f-72b2b2c1b33a', '长尾夹', '25mm', '盒', 30, 10, 1);

-- ============================================================
-- 7. 审批模板（8个，保留实际 code 和关联）
-- ============================================================

DELETE FROM `approval_templates`;

INSERT INTO `approval_templates` (`id`, `code`, `name`, `description`, `category`, `icon`, `business_type`, `is_active`) VALUES
('c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'PROC_MKSAQYT6', '出差申请', '员工出差申请流程', '外出管理', '🚗', 'business_trip', 1),
('f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'PROC_MKTO1ET3', '请假申请', '员工请假申请流程', '外出管理', '🏖️', 'leave', 1),
('f3d8ecf0-c9ab-4b5b-914f-9f33aca068e3', 'PROC_MKUK42R1', '外出申请', '员工临时外出申请流程', '外出管理', '🚶', 'out', 1),
('fc88deee-015b-48e5-b924-dbafcb53ed3f', 'PROC_MKXVX9VE', '政府采购申请', '政府采购审批流程', '外出管理', '💰', 'purchase_request', 1),
('e38ce27b-4b5d-4c84-a76f-b3b6761b26bd', 'PROC_MKXWIEG6', '物品领用', '办公用品领用申请流程', '外出管理', '📦', 'supply_requisition', 1),
('d6ae9384-b46c-458f-902a-057c6b9a7ab1', 'PROC_MKYO60ON', '办公采购', '处室办公用品采购申请流程', '办公用品', '🛒', 'supply_purchase', 1),
('e7def11b-21a3-4fc8-b402-4107f0d17592', 'PROC_MKZ8U6G2', '测试1', '', '外出管理', '📋', 'absence', 1),
('4756de38-8ab1-494e-9f61-3c1b4d5f0266', 'PROC_MKZASQFS', '0129测试流程', '0129测试流程', '外出管理', '📋', 'absence', 1);

-- ============================================================
-- 8. 审批节点（关联到模板，核心流程配置）
-- ============================================================

DELETE FROM `approval_nodes`;

-- 出差申请流程节点
INSERT INTO `approval_nodes` (`id`, `template_id`, `node_name`, `node_type`, `approver_type`, `approver_ids`, `approval_mode`, `condition_expression`, `field_permissions`, `sort_order`) VALUES
('2d259397-e541-460d-8555-c88a975a0e0a', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '科室负责人', 'approver', 'specific', '["f734d35b-8388-4691-82a2-10a06ed27982"]', 'countersign', NULL, '{}', 10),
('98f6274f-5df8-4df7-bcea-9315c058b8d9', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '科长办公室领导', 'approver', 'specific', '["93c27e22-125f-4984-8123-c575e71fdeb4"]', 'countersign', NULL, '{}', 20),
('ac63c325-e8da-4fa8-8bc4-918ccdf27107', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '行政一科', 'approver', 'specific', '["7b59aa90-0e0f-4045-a54c-7d620587b458"]', 'countersign', NULL, '{}', 25),
('e2f4734b-3cf9-460f-b377-f40a7222ca7e', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '条件分支23', 'condition', 'specific', '[]', 'countersign', '{"branches":["4c8dc56e-b351-4655-8a24-90276618642c","87b98f8a-0ba2-4320-94b1-30a273a92ed1"],"layout":"left"}', '{}', 30),
('87b98f8a-0ba2-4320-94b1-30a273a92ed1', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '条件3', 'condition_branch', 'specific', '[]', 'countersign', '{"child_nodes":["3efad624-d33c-4dff-bce8-500238cd929e"],"condition_groups":[{"conditions":[{"field_name":"contact_id","id":"z5xmko0","operator":"not_equals","value":"f734d35b-8388-4691-82a2-10a06ed27982"}],"id":"v2c4pwb"}],"is_default":false,"parent_id":"e2f4734b-3cf9-460f-b377-f40a7222ca7e"}', '{}', 32),
('3efad624-d33c-4dff-bce8-500238cd929e', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '抄送人', 'cc', 'specific', '["8ccef7e7-9746-480e-96d2-c59c72e69263","7b59aa90-0e0f-4045-a54c-7d620587b458"]', 'countersign', NULL, '{"contact_id":"readonly","end_time":"readonly","notes":"readonly","reason":"readonly","start_time":"readonly"}', 37),
('4c8dc56e-b351-4655-8a24-90276618642c', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '条件1', 'condition_branch', 'specific', '[]', 'countersign', '{"child_nodes":["e10ded4f-8a60-4a6b-9055-e67b35ade17b","5b84b8b3-0c1e-4253-a5f7-a915290400fa","687fda27-5162-4be1-ba1a-667c91634015"],"condition_groups":[{"conditions":[{"field_name":"contact_id","id":"o0y0xpl","operator":"equals","value":"f734d35b-8388-4691-82a2-10a06ed27982"}],"id":"kx7ab27"}],"is_default":false,"parent_id":"e2f4734b-3cf9-460f-b377-f40a7222ca7e"}', '{}', 40),
('e10ded4f-8a60-4a6b-9055-e67b35ade17b', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '抄送人', 'cc', 'specific', '["f734d35b-8388-4691-82a2-10a06ed27982","93c27e22-125f-4984-8123-c575e71fdeb4"]', 'countersign', NULL, '{"contact_id":"readonly","end_time":"readonly","notes":"readonly","reason":"readonly","start_time":"readonly"}', 55),
('5b84b8b3-0c1e-4253-a5f7-a915290400fa', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '抄送人', 'cc', 'specific', '[]', 'countersign', NULL, '{}', 60),
('687fda27-5162-4be1-ba1a-667c91634015', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', '审批人', 'approver', 'specific', '[]', 'countersign', NULL, '{}', 65);

-- 办公采购流程节点
INSERT INTO `approval_nodes` (`id`, `template_id`, `node_name`, `node_type`, `approver_type`, `approver_ids`, `approval_mode`, `condition_expression`, `field_permissions`, `sort_order`) VALUES
('5b03b15e-1f27-44dc-8dfc-1c2390a49e4c', 'd6ae9384-b46c-458f-902a-057c6b9a7ab1', '科室负责人', 'approver', 'specific', '["f734d35b-8388-4691-82a2-10a06ed27982"]', 'countersign', NULL, '{}', 1),
('db041605-26dc-4f70-9c1c-860df6d638be', 'd6ae9384-b46c-458f-902a-057c6b9a7ab1', '办公室领导', 'approver', 'specific', '["93c27e22-125f-4984-8123-c575e71fdeb4"]', 'countersign', NULL, '{}', 2);

-- 请假申请流程节点
INSERT INTO `approval_nodes` (`id`, `template_id`, `node_name`, `node_type`, `approver_type`, `approver_ids`, `approval_mode`, `condition_expression`, `field_permissions`, `sort_order`) VALUES
('f97e7ea6-51d9-4ca9-8eb3-bbfd5a8d1c64', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', '科室负责人', 'approver', 'specific', '["f734d35b-8388-4691-82a2-10a06ed27982"]', 'countersign', NULL, '{}', 1),
('a8b8dc2f-e7b9-4a5b-8453-7ab37b5e74a1', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', '分管领导', 'approver', 'specific', '["93c27e22-125f-4984-8123-c575e71fdeb4"]', 'countersign', NULL, '{}', 2);

-- 外出申请流程节点
INSERT INTO `approval_nodes` (`id`, `template_id`, `node_name`, `node_type`, `approver_type`, `approver_ids`, `approval_mode`, `condition_expression`, `field_permissions`, `sort_order`) VALUES
('c4b3e85d-2a19-4f6c-9e7a-d81f32b4c5a9', 'f3d8ecf0-c9ab-4b5b-914f-9f33aca068e3', '科室负责人', 'approver', 'specific', '["f734d35b-8388-4691-82a2-10a06ed27982"]', 'countersign', NULL, '{}', 1);

-- 物品领用流程节点
INSERT INTO `approval_nodes` (`id`, `template_id`, `node_name`, `node_type`, `approver_type`, `approver_ids`, `approval_mode`, `condition_expression`, `field_permissions`, `sort_order`) VALUES
('d7e9f1a3-3b48-4d5c-a2e6-f94c71d38b07', 'e38ce27b-4b5d-4c84-a76f-b3b6761b26bd', '科室负责人', 'approver', 'specific', '["f734d35b-8388-4691-82a2-10a06ed27982"]', 'countersign', NULL, '{}', 1);

-- 政府采购流程节点
INSERT INTO `approval_nodes` (`id`, `template_id`, `node_name`, `node_type`, `approver_type`, `approver_ids`, `approval_mode`, `condition_expression`, `field_permissions`, `sort_order`) VALUES
('e8f0a2b4-4c59-4e6d-b3f7-095d82e49c18', 'fc88deee-015b-48e5-b924-dbafcb53ed3f', '科室负责人', 'approver', 'specific', '["f734d35b-8388-4691-82a2-10a06ed27982"]', 'countersign', NULL, '{}', 1),
('f901b3c5-5d6a-4f7e-c408-1a6e93f5ad29', 'fc88deee-015b-48e5-b924-dbafcb53ed3f', '分管领导', 'approver', 'specific', '["93c27e22-125f-4984-8123-c575e71fdeb4"]', 'countersign', NULL, '{}', 2);

-- ============================================================
-- 9. 审批表单字段（模板表单设计）
-- ============================================================

DELETE FROM `approval_form_fields`;

-- 出差申请表单字段
INSERT INTO `approval_form_fields` (`id`, `template_id`, `field_type`, `field_name`, `field_label`, `placeholder`, `is_required`, `field_options`, `sort_order`, `col_span`) VALUES
('ef66ca68-bd4e-4125-bdce-0a50f0c4be37', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'user', 'contact_id', '申请人', '自动获取当前用户', 1, NULL, 1, 2),
('1a04bbf2-b43b-4800-8422-19872b0a1893', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'textarea', 'destination', '出差目的地', '请输入出差目的地', 1, NULL, 2, 2),
('337f24dc-4ada-45d6-9325-6217407f36b0', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'textarea', 'reason', '事由', '请输入事由', 1, NULL, 3, 2),
('1a517968-9f81-4d84-8311-6dc2fa32d64b', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'datetime', 'start_time', '开始时间', '请输入开始时间', 1, NULL, 4, 1),
('c25b7f18-3846-4779-9b6b-ff441c384d4a', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'datetime', 'end_time', '结束时间', '请输入结束时间', 0, NULL, 5, 1),
('94ca213d-13b6-4e1a-b384-a660cd66d27d', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'number', 'duration_days', '出差天数', '请输入出差天数', 0, NULL, 6, 1),
('fd4d8f48-cf8d-4a9a-8682-931e4fb79017', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'textarea', 'transport_type', '交通方式', '请输入交通方式', 0, '["plane","train","car","other"]', 7, 2),
('a48a2a94-9d3e-4690-ac1d-34191f706a17', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'checkbox', 'companions', '同行人员', '请输入同行人员', 0, NULL, 8, 2),
('1ff3ad71-38c1-4316-ac45-52c8e890e01a', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'number', 'estimated_cost', '预计费用', '请输入预计费用', 0, NULL, 9, 1),
('a831d958-70fd-42ad-8aef-2b1861971985', 'c715eacd-1a67-4ed4-b4ff-a20164d3b270', 'textarea', 'notes', '备注', '请输入备注', 0, NULL, 10, 2);

-- 请假申请表单字段
INSERT INTO `approval_form_fields` (`id`, `template_id`, `field_type`, `field_name`, `field_label`, `placeholder`, `is_required`, `field_options`, `sort_order`, `col_span`) VALUES
('ef20b1bb-aa49-42c8-ba3a-2d606180af43', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'user', 'contact_id', '申请人', '自动获取当前用户', 1, NULL, 1, 2),
('b2c3d4e5-f6a7-48b9-c0d1-e2f3a4b5c6d7', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'select', 'leave_type', '请假类型', '请选择请假类型', 1, '["annual","sick","personal","paternity","bereavement","maternity","nursing","marriage","compensatory"]', 2, 2),
('c3d4e5f6-a7b8-49c0-d1e2-f3a4b5c6d7e8', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'textarea', 'reason', '请假事由', '请输入请假事由', 1, NULL, 3, 2),
('d4e5f6a7-b8c9-4ad0-e1f2-a3b4c5d6e7f8', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'datetime', 'start_time', '开始时间', '请选择开始时间', 1, NULL, 4, 1),
('e5f6a7b8-c9d0-4be1-f2a3-b4c5d6e7f8a9', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'datetime', 'end_time', '结束时间', '请选择结束时间', 0, NULL, 5, 1),
('f6a7b8c9-d0e1-4cf2-a3b4-c5d6e7f8a9b0', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'number', 'duration_days', '请假天数', '请输入请假天数', 0, NULL, 6, 1),
('a7b8c9d0-e1f2-4da3-b4c5-d6e7f8a9b0c1', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'number', 'duration_hours', '请假小时数', '请输入请假小时数', 0, NULL, 7, 1),
('b8c9d0e1-f2a3-4eb4-c5d6-e7f8a9b0c1d2', 'f10358da-16d3-491b-bfde-ce95fcd1b5bc', 'textarea', 'notes', '备注', '请输入备注', 0, NULL, 8, 2);

-- 外出申请表单字段
INSERT INTO `approval_form_fields` (`id`, `template_id`, `field_type`, `field_name`, `field_label`, `placeholder`, `is_required`, `field_options`, `sort_order`, `col_span`) VALUES
('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'f3d8ecf0-c9ab-4b5b-914f-9f33aca068e3', 'user', 'contact_id', '申请人', '自动获取当前用户', 1, NULL, 1, 2),
('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f3d8ecf0-c9ab-4b5b-914f-9f33aca068e3', 'textarea', 'reason', '外出事由', '请输入外出事由', 1, NULL, 2, 2),
('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'f3d8ecf0-c9ab-4b5b-914f-9f33aca068e3', 'textarea', 'out_location', '外出地点', '请输入外出地点', 1, NULL, 3, 2),
('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80', 'f3d8ecf0-c9ab-4b5b-914f-9f33aca068e3', 'datetime', 'start_time', '开始时间', '请选择开始时间', 1, NULL, 4, 1),
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8091', 'f3d8ecf0-c9ab-4b5b-914f-9f33aca068e3', 'datetime', 'end_time', '结束时间', '请选择结束时间', 0, NULL, 5, 1),
('f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8091a2', 'f3d8ecf0-c9ab-4b5b-914f-9f33aca068e3', 'textarea', 'notes', '备注', '请输入备注', 0, NULL, 6, 2);

-- 物品领用表单字段
INSERT INTO `approval_form_fields` (`id`, `template_id`, `field_type`, `field_name`, `field_label`, `placeholder`, `is_required`, `field_options`, `sort_order`, `col_span`) VALUES
('14df8961-129a-48ca-bca0-6a18d6a044f3', 'e38ce27b-4b5d-4c84-a76f-b3b6761b26bd', 'user', 'requisition_by', '申请人', '自动获取当前用户', 1, NULL, 1, 2),
('9f6a7f5b-fc01-40ac-9673-940fc7457e31', 'e38ce27b-4b5d-4c84-a76f-b3b6761b26bd', 'select', 'supply_id', '领用物品', '请输入领用物品', 1, NULL, 2, 1),
('e35df561-3f8d-4248-a07f-1dbeb7fbe63e', 'e38ce27b-4b5d-4c84-a76f-b3b6761b26bd', 'number', 'quantity', '领用数量', '请输入领用数量', 1, NULL, 3, 1);

-- ============================================================
-- 10. 食堂菜谱（周一至周五，day_of_week 0-4）
-- ============================================================

DELETE FROM `canteen_menus`;

INSERT INTO `canteen_menus` (`id`, `day_of_week`, `breakfast`, `lunch`, `dinner`) VALUES
('3648b5fa-3d38-4773-ac35-4b76061ccb0a', 0, '["豆浆","油条","包子","鸡蛋","小米粥"]', '["红烧排骨","清炒西兰花","番茄炒蛋","米饭","紫菜蛋花汤"]', '["炸酱面","凉拌黄瓜","卤鸡腿","绿豆粥"]'),
('67ebf815-b918-4961-9841-8a7d32126268', 1, '["牛奶","面包","煎蛋","玉米","八宝粥"]', '["糖醋里脊","蒜蓉油麦菜","宫保鸡丁","米饭","酸辣汤"]', '["牛肉面","拍黄瓜","红烧鱼块","小米粥"]'),
('41a326e5-dd2a-41d4-bbb8-d66a244fe378', 2, '["豆浆","油条","包子","鸡蛋","小米粥"]', '["红烧排骨","清炒西兰花","番茄炒蛋","米饭","紫菜蛋花汤"]', '["炸酱面","凉拌黄瓜","卤鸡腿","绿豆粥"]'),
('fcfb394a-4266-496b-ae17-658cfe5b1e08', 3, '["牛奶","馒头","咸菜","鸡蛋","南瓜粥"]', '["回锅肉","炒青菜","麻婆豆腐","米饭","西红柿汤"]', '["担担面","凉拌木耳","可乐鸡翅","玉米粥"]'),
('f424551b-80ba-42a5-b97a-95b8c9e13bc3', 4, '["豆浆","肉包","花卷","鸡蛋","燕麦粥"]', '["鱼香肉丝","蒜蓉菠菜","土豆丝","米饭","冬瓜汤"]', '["阳春面","凉拌海带","红烧肉","红豆粥"]');

-- ============================================================
-- 11. 假期余额（为所有人员初始化当年假期）
-- ============================================================

DELETE FROM `leave_balances`;

INSERT INTO `leave_balances` (`id`, `contact_id`, `year`, `annual_leave_total`, `annual_leave_used`, `sick_leave_total`, `sick_leave_used`, `personal_leave_total`, `personal_leave_used`) VALUES
('0b43cdc3-f116-4042-95c0-a98295b46621', 'f734d35b-8388-4691-82a2-10a06ed27982', 2026, 5, 0, 10, 0, 5, 0),
('c61c661c-3697-49d6-8cda-f0824e5dc1fb', '93c27e22-125f-4984-8123-c575e71fdeb4', 2026, 5, 0, 10, 0, 5, 0),
('9ddb11c4-a022-4e66-8c28-372d2e4ef4c1', '8ccef7e7-9746-480e-96d2-c59c72e69263', 2026, 5, 0, 10, 0, 5, 0),
('5d5424b2-54c6-406b-a669-c50c24f374c5', '7b59aa90-0e0f-4045-a54c-7d620587b458', 2026, 5, 0, 10, 0, 5, 0),
('e14e6ce8-191e-4e5e-bf81-6f531ce136e6', '9994c178-5351-48e3-b2cb-02c1f44070ec', 2026, 5, 0, 10, 0, 5, 0),
('a9fdf0bd-45fa-4a85-9567-066fe02edf51', '06ce77c1-dbab-44fb-857e-b3d16a381475', 2026, 5, 0, 10, 0, 5, 0),
('2f86c15d-71d4-4672-99da-671f98a1ad69', '23e2fbd2-b7a8-4527-b76a-f434fd13b554', 2026, 5, 0, 10, 0, 5, 0),
('6adfbc9c-008f-490a-b74d-f62eff614959', 'bc9e9efd-de26-4c40-988e-453cf8c109fc', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-444455556666', '342ba74d-a7dc-4e31-9310-dae66eacad17', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-444455557777', '4be38d0e-2943-46bc-ac3f-290bee7531ec', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-444455558888', '00a96fe3-f716-41e0-8b2e-16f51e3d578d', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-444455559999', '04ca79b1-64f6-4102-9f8a-ccbdda076ca1', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-44445555aaaa', '8881090f-8145-49c7-ad1e-edec6195e098', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-44445555bbbb', '7df23296-868d-4e52-870b-e9a2df816206', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-44445555cccc', 'f734d35b-8388-4691-82a2-10a06ed27982', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-44445555dddd', '60df0e23-5bd8-46e6-b033-6d1f42453990', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-44445555eeee', 'cd4f2dae-c5b3-45f3-ada7-92ea6c6a5a37', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-44445555ffff', 'a0d20ddd-1e4e-4c16-9e3a-fc2aa4c7af7a', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-555566667777', '4a637f4c-2c19-498e-a1b2-38f10e16b76b', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-555566668888', '3ec3d508-e4e7-4eee-b1bb-bb3a6e5daabd', 2026, 5, 0, 10, 0, 5, 0),
('a1b2c3d4-1111-4222-9333-555566669999', 'b08d9e09-e86e-45e7-b1a3-e39f54ddd13f', 2026, 5, 0, 10, 0, 5, 0);

-- ============================================================
-- 12. 领导日程查看权限
-- ============================================================

DELETE FROM `leader_schedule_permissions`;

INSERT INTO `leader_schedule_permissions` (`id`, `user_id`, `leader_id`, `can_view_all`) VALUES
('78d87453-dddc-4752-9030-15818e5238a9', '93c27e22-125f-4984-8123-c575e71fdeb4', '4be38d0e-2943-46bc-ac3f-290bee7531ec', 0),
('edf4274f-702a-4539-8a2d-83c3b9f48820', '93c27e22-125f-4984-8123-c575e71fdeb4', '7df23296-868d-4e52-870b-e9a2df816206', 0),
('a2c872c6-77fd-4971-a503-4ef5049e6a57', '93c27e22-125f-4984-8123-c575e71fdeb4', '342ba74d-a7dc-4e31-9310-dae66eacad17', 0);

-- ============================================================
-- 13. 通知公告（示例数据）
-- ============================================================

-- 通知公告数据较大且含 HTML 内容，建议通过后台管理界面录入
-- 如需导入，可在此添加 INSERT 语句

-- ============================================================
-- 14. 收发文（示例数据）
-- ============================================================

DELETE FROM `file_transfers`;

INSERT INTO `file_transfers` (`id`, `title`, `doc_number`, `send_unit`, `send_unit_id`, `security_level`, `urgency`, `status`, `file_type`, `notify_type`, `send_type`, `source_unit`, `confidential_period`, `contact_person`, `contact_phone`, `document_date`, `sign_date`, `copies`) VALUES
('8de2355e-7592-4476-814f-d57a9edb0e80', '2025年XX省义务教育优质均衡发展县评估认定工作实施方案', '大', '洲人民政府-信访办', '5d2085db-b4c2-4492-9dc8-7335be2f0794', '公开', '普通', '待签收', '中央文件', '不通知', '不限制份数', '州教务局', '1年', '林青青', '18290808933', '2026-01-29', '2026-01-29', 1);

-- ============================================================
-- 完成
-- ============================================================

SET FOREIGN_KEY_CHECKS = 1;

SELECT '基础数据导入完成!' AS message;
SELECT CONCAT('组织: ', COUNT(*)) AS info FROM organizations
UNION ALL
SELECT CONCAT('人员: ', COUNT(*)) FROM contacts
UNION ALL
SELECT CONCAT('角色: ', COUNT(*)) FROM roles
UNION ALL
SELECT CONCAT('角色权限: ', COUNT(*)) FROM role_permissions
UNION ALL
SELECT CONCAT('办公用品: ', COUNT(*)) FROM office_supplies
UNION ALL
SELECT CONCAT('审批模板: ', COUNT(*)) FROM approval_templates
UNION ALL
SELECT CONCAT('审批节点: ', COUNT(*)) FROM approval_nodes
UNION ALL
SELECT CONCAT('表单字段: ', COUNT(*)) FROM approval_form_fields
UNION ALL
SELECT CONCAT('食堂菜谱: ', COUNT(*)) FROM canteen_menus
UNION ALL
SELECT CONCAT('假期余额: ', COUNT(*)) FROM leave_balances;
