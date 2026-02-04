# 党政办公平台 - 2025年2月4日问题修复部署指南

本文档整理了2025年2月4日发现的所有问题及完整修复步骤。

---

## 问题清单

| 序号 | 问题描述 | 影响模块 | 根本原因 |
|------|----------|----------|----------|
| 1 | 日程管理-创建记录失败 | 日程管理 | API参数不匹配(start_date/end_date vs schedule_date) |
| 2 | 出差申请/请假申请/外出申请-创建记录失败 | 考勤模块 | absence_records表字段不完整 |
| 3 | 采购申请/办公采购-创建采购申请失败 | 采购模块 | purchase_date字段缺失 |
| 4 | admin@gov.cn管理员登录不上 | 管理后台 | 管理员认证逻辑不支持email登录 |
| 5 | 领用申请中办公用品下拉无内容 | 领用模块 | is_active字段类型匹配问题+无初始数据 |
| 6 | 日程添加后日历不显示 | 日程管理 | 返回数据格式不匹配前端期望结构 |

---

## 一、服务器端部署步骤

### 步骤1：初始化/更新数据库

登录MariaDB并执行以下SQL：

```bash
mysql -u root -p
```

```sql
USE gov_platform;

-- ==================== 1. 创建缺失的表 ====================

-- 日程表
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

-- 领用申请表
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

-- 领用申请明细表
CREATE TABLE IF NOT EXISTS `supply_requisition_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `requisition_id` CHAR(36) NOT NULL,
  `supply_id` CHAR(36) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_requisition_id` (`requisition_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 采购申请表
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

-- 采购申请明细表
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

-- 办公采购表
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

-- 办公采购明细表
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

-- 库存变动记录表
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

-- 审批流程版本表
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

-- 领导日程查看权限表
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

-- ==================== 2. 修复管理员账户 ====================

-- 检查是否已有管理员，如果有则更新email
UPDATE contacts SET email = 'admin@gov.cn' WHERE mobile = '13800000001';

-- 如果没有管理员账户，插入一个
INSERT IGNORE INTO contacts (id, name, mobile, email, position, department, organization_id, is_leader, is_active, security_level, password_hash)
SELECT UUID(), '系统管理员', '13800000001', 'admin@gov.cn', '管理员', '信息中心', 
       (SELECT id FROM organizations LIMIT 1), 1, 1, '机密', '123456'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE mobile = '13800000001');

-- 确保管理员有admin角色
INSERT IGNORE INTO user_roles (id, user_id, role)
SELECT UUID(), c.id, 'admin' FROM contacts c WHERE c.mobile = '13800000001'
AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = c.id AND role = 'admin');

-- ==================== 3. 初始化办公用品数据 ====================

-- 检查是否已有办公用品，如果没有则插入
INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '中性笔', '0.5mm黑色', '支', 100, 20, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '中性笔');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), 'A4复印纸', '70g 500张/包', '包', 50, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = 'A4复印纸');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '订书机', '小号', '个', 20, 5, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '订书机');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '订书钉', '24/6', '盒', 100, 20, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '订书钉');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '文件夹', 'A4单夹', '个', 80, 15, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '文件夹');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '档案盒', 'A4厚型', '个', 50, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '档案盒');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '回形针', '29mm', '盒', 60, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '回形针');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '便签纸', '76x76mm', '本', 40, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '便签纸');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '笔记本', 'A5软皮', '本', 30, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '笔记本');

INSERT INTO office_supplies (id, name, specification, unit, current_stock, min_stock, is_active)
SELECT UUID(), '胶带', '透明48mm', '卷', 40, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM office_supplies WHERE name = '胶带');

-- ==================== 4. 验证数据 ====================

-- 查看办公用品是否有数据
SELECT COUNT(*) as '办公用品数量' FROM office_supplies WHERE is_active = 1;

-- 查看管理员账户
SELECT id, name, mobile, email, is_leader FROM contacts WHERE mobile = '13800000001' OR email = 'admin@gov.cn';

-- 完成
SELECT '数据库更新完成!' as message;
```

### 步骤2：更新后端API

将最新的 `deploy/api/src/index.js` 文件复制到服务器：

```bash
# 备份原文件
cp /opt/gov-platform/api/src/index.js /opt/gov-platform/api/src/index.js.bak.$(date +%Y%m%d)

# 复制新文件（从本地部署包复制）
cp deploy/api/src/index.js /opt/gov-platform/api/src/
```

### 步骤3：重启API服务

```bash
# 方式1：使用PM2（推荐）
pm2 restart gov-api

# 方式2：手动重启
cd /opt/gov-platform/api
pkill -f "node src/index.js"
nohup node src/index.js > ../logs/api.log 2>&1 &

# 验证服务状态
curl http://localhost:3001/api/health
```

---

## 二、前端部署步骤

### 步骤1：构建前端

在有网络的开发环境执行：

```bash
# 进入项目根目录
cd /path/to/project

# 安装依赖（如有更新）
npm install

# 构建生产版本
npm run build
```

### 步骤2：准备部署文件

构建完成后，`dist/` 目录包含所有前端文件。需要额外添加配置文件：

```bash
# 复制运行时配置
cp deploy/web/config.js dist/

# 复制polyfills（旧浏览器兼容）
cp public/polyfills.js dist/
```

### 步骤3：修改dist/index.html

**重要！** 在 `dist/index.html` 的 `<head>` 中添加以下脚本引用（在所有其他脚本之前）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>党政办公平台</title>
    
    <!-- 关键：必须在最前面加载 -->
    <script src="/polyfills.js"></script>
    <script src="/config.js"></script>
    
    <!-- 后面是Vite生成的脚本 -->
    ...
  </head>
```

### 步骤4：部署到服务器

```bash
# 打包dist目录
tar -czvf dist.tar.gz dist/

# 传输到服务器
scp dist.tar.gz user@server:/tmp/

# 在服务器上解压并部署
ssh user@server
cd /tmp
tar -xzvf dist.tar.gz
rm -rf /opt/gov-platform/web/*
cp -r dist/* /opt/gov-platform/web/
```

### 步骤5：配置运行时参数

编辑 `/opt/gov-platform/web/config.js`，确保API地址正确：

```javascript
window.GOV_CONFIG = {
  // 修改为实际服务器内网IP
  API_BASE_URL: "http://你的服务器IP:3001",
  APP_NAME: "昌吉州党政办公平台",
  VERSION: "1.0.0",
  OFFLINE_MODE: true
};
```

---

## 三、Nginx配置检查

确保Nginx配置正确处理config.js：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /opt/gov-platform/web;
    index index.html;

    # 关键：确保config.js可访问
    location = /config.js {
        alias /opt/gov-platform/web/config.js;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API代理（可选）
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

重载Nginx：

```bash
# 检查配置
nginx -t

# 重载配置
systemctl reload nginx
# 或
/usr/local/nginx/sbin/nginx -s reload
```

---

## 四、验证清单

部署完成后，逐项验证：

| 功能 | 验证方法 | 预期结果 |
|------|----------|----------|
| 管理员登录 | 访问 `/admin-login`，使用 `admin@gov.cn` / `admin123456` | 成功进入管理后台 |
| 普通用户登录 | 使用 `13800000001` / `123456` | 成功进入首页 |
| 办公用品下拉 | 进入"采购领用" → "领用申请" | 下拉框显示10个办公用品 |
| 日程添加 | 首页日程面板点击"+"添加日程 | 日历上显示日程标记 |
| 请假申请 | 提交请假申请 | 显示"提交成功" |
| 外出申请 | 提交外出申请 | 显示"提交成功" |
| 出差申请 | 提交出差申请 | 显示"提交成功" |
| 采购申请 | 提交采购申请 | 显示"提交成功" |
| 办公采购 | 提交办公采购 | 显示"提交成功" |

---

## 五、问题排查

### 问题1：API无法访问

```bash
# 检查API进程
ps aux | grep "node src/index.js"

# 检查端口监听
netstat -tlnp | grep 3001

# 查看API日志
tail -100 /opt/gov-platform/logs/api.log
```

### 问题2：数据库连接失败

```bash
# 检查.env配置
cat /opt/gov-platform/api/.env

# 测试数据库连接
mysql -h localhost -u root -p gov_platform -e "SELECT 1"
```

### 问题3：前端白屏

1. 检查浏览器控制台错误
2. 确认 `config.js` 和 `polyfills.js` 正确加载
3. 确认 `index.html` 中脚本引入顺序正确

---

## 六、核心API修复摘要

本次更新的 `deploy/api/src/index.js` 主要修复：

1. **管理员登录** (`/api/admin/login`)
   - 新增硬编码超级管理员支持 (`admin@gov.cn`)
   - 支持通过 `email` 或 `mobile` 字段登录
   - 支持 `is_leader` 用户作为管理员

2. **日程管理** (`/api/schedules`)
   - 支持 `start_date` 和 `end_date` 日期范围查询
   - 返回嵌套的 `contact` 对象结构

3. **请假/外出/出差** (`/api/absence-records`)
   - 动态字段处理，支持所有表单字段
   - 包含 `status` 和 `notes` 字段

4. **办公用品** (`/api/office-supplies`)
   - 修复 `is_active` 类型匹配问题

5. **采购申请** (`/api/purchase-requests`, `/api/supply-purchases`)
   - 自动填充 `purchase_date` 字段

---

## 七、文件清单

需要部署的文件：

```
服务器 /opt/gov-platform/
├── api/
│   ├── src/
│   │   └── index.js          ← 更新
│   ├── .env                  ← 检查配置
│   └── package.json
├── web/
│   ├── index.html            ← 确保包含polyfills和config引用
│   ├── config.js             ← 更新API地址
│   ├── polyfills.js          ← 确保存在
│   └── assets/               ← npm run build生成
└── logs/
    └── api.log
```

---

**部署完成后，请按验证清单逐项测试功能。如有问题，查看API日志和浏览器控制台错误信息。**
