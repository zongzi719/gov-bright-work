# 离线部署更新指南 (2025-02-04 V2)

> 本次更新包含：6个默认审批模板 + 完整的 Supabase 调用修复 + 审批记录创建修复 + **表单设计修复**

## 🔥 重要修复 (2025-02-04 最新)

### ⭐ 审批流程表单设计为空问题修复

**问题现象**：管理员配置审批流程时，"表单设计" 标签页内容为空

**原因分析**：
1. 数据库缺少 `approval_form_fields` 表
2. 后端 API 缺少表单字段的 CRUD 端点
3. 前端组件直接调用 Supabase 而非 dataAdapter

**修复内容**：
1. **数据库** (`deploy/database/init.sql`):
   - 新增 `approval_form_fields` 表

2. **后端 API** (`deploy/api/src/index.js`):
   - 新增 `GET /api/approval-form-fields` - 获取表单字段
   - 新增 `POST /api/approval-form-fields` - 创建字段
   - 新增 `PUT /api/approval-form-fields/:id` - 更新字段
   - 新增 `DELETE /api/approval-form-fields/:id` - 删除字段
   - 新增 `POST /api/approval-form-fields/batch` - 批量创建字段

3. **前端** (`src/components/admin/approval/ApprovalFormDesign.tsx`):
   - 使用 dataAdapter 替代直接 Supabase 调用

**部署步骤**：
```bash
# 1. 在数据库中执行建表语句
mysql -u root -p gov_platform < deploy/database/init.sql

# 或手动执行：
mysql -u root -p gov_platform -e "
CREATE TABLE IF NOT EXISTS approval_form_fields (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  template_id CHAR(36) NOT NULL,
  field_type VARCHAR(50) NOT NULL DEFAULT 'text',
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(100) NOT NULL,
  placeholder VARCHAR(255) DEFAULT NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  field_options JSON DEFAULT NULL,
  col_span INT NOT NULL DEFAULT 2,
  default_value VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_template_id (template_id),
  KEY idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

# 2. 更新后端 API
cp deploy/api/src/index.js /opt/gov-platform/api/src/
systemctl restart gov-api

# 3. 重新构建前端
npm run build
# 同步 dist 目录到服务器
```

---

### 请假/外出/出差申请创建报错修复

**问题现象**：创建请假申请时报错"创建审批记录失败"

**修复内容**：
1. 后端 API (`deploy/api/src/index.js`):
   - 增加 `instance_id`、`approver_id`、`node_name` 必填验证
   - 增加详细日志输出便于排查
   - 修复空值处理 (`node_type` 和 `comment` 字段)

2. 前端 (`src/hooks/useApprovalWorkflow.ts`):
   - 优化空审批人列表处理（不再阻塞流程）
   - 跳过无效的 `approver_id`
   - 增加详细日志

---

## 📋 更新概览

| 更新项 | 说明 |
|--------|------|
| 审批模板 | 请假、外出、出差、物品领用、办公采购、政府采购 |
| 管理模块 | 轮播图、通知公告、通讯录、领导日程权限 |
| 适配器 | dataAdapter.ts 完整离线化 |

---

## 🔧 第一步：更新后端 API

### 1.1 替换 API 文件

```bash
# 备份原文件
cp /opt/gov-platform/api/src/index.js /opt/gov-platform/api/src/index.js.bak

# 上传新的 index.js 到服务器
# 将项目中的 deploy/api/src/index.js 复制到服务器
scp deploy/api/src/index.js root@服务器IP:/opt/gov-platform/api/src/
```

### 1.2 重启 API 服务

```bash
# 使用 systemctl（如果已配置服务）
systemctl restart gov-api

# 或手动重启
cd /opt/gov-platform/api
pkill -f "node src/index.js"
nohup node src/index.js > /opt/gov-platform/logs/api.log 2>&1 &

# 验证服务状态
curl http://localhost:3001/api/health
# 应返回: {"status":"ok","timestamp":"..."}
```

---

## 🗄️ 第二步：初始化审批模板数据

### 2.1 连接数据库（必须指定 UTF-8 编码）

```bash
# ⚠️ 关键：必须使用 --default-character-set=utf8mb4 参数
mysql -u root -p --default-character-set=utf8mb4 gov_platform
```

### 2.2 设置会话编码（重要！）

连接后，先执行以下命令确保编码正确：

```sql
-- 设置会话编码为 UTF-8
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 验证编码设置
SHOW VARIABLES LIKE 'character%';
-- 应该看到 utf8mb4 相关的值
```

### 2.3 执行以下 SQL 语句

```sql
-- ============================================
-- 插入6个默认审批模板
-- ============================================

-- 1. 请假申请
INSERT INTO `approval_templates` (
  `id`, `code`, `name`, `category`, `business_type`, 
  `description`, `icon`, `is_active`, `allow_withdraw`, 
  `allow_transfer`, `notify_initiator`, `notify_approver`,
  `created_at`, `updated_at`
) SELECT 
  UUID(), 'PROC_LEAVE', '请假申请', '外出管理', 'leave',
  '员工请假审批流程', 'Calendar', 1, 1, 1, 1, 1,
  NOW(), NOW()
FROM dual WHERE NOT EXISTS (
  SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_LEAVE'
);

-- 2. 外出申请
INSERT INTO `approval_templates` (
  `id`, `code`, `name`, `category`, `business_type`, 
  `description`, `icon`, `is_active`, `allow_withdraw`, 
  `allow_transfer`, `notify_initiator`, `notify_approver`,
  `created_at`, `updated_at`
) SELECT 
  UUID(), 'PROC_OUT', '外出申请', '外出管理', 'out',
  '短时外出审批流程', 'MapPin', 1, 1, 1, 1, 1,
  NOW(), NOW()
FROM dual WHERE NOT EXISTS (
  SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_OUT'
);

-- 3. 出差申请
INSERT INTO `approval_templates` (
  `id`, `code`, `name`, `category`, `business_type`, 
  `description`, `icon`, `is_active`, `allow_withdraw`, 
  `allow_transfer`, `notify_initiator`, `notify_approver`,
  `created_at`, `updated_at`
) SELECT 
  UUID(), 'PROC_TRIP', '出差申请', '外出管理', 'business_trip',
  '出差申请审批流程', 'Briefcase', 1, 1, 1, 1, 1,
  NOW(), NOW()
FROM dual WHERE NOT EXISTS (
  SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_TRIP'
);

-- 4. 物品领用
INSERT INTO `approval_templates` (
  `id`, `code`, `name`, `category`, `business_type`, 
  `description`, `icon`, `is_active`, `allow_withdraw`, 
  `allow_transfer`, `notify_initiator`, `notify_approver`,
  `created_at`, `updated_at`
) SELECT 
  UUID(), 'PROC_REQ', '物品领用', '办公用品', 'supply_requisition',
  '办公用品领用审批', 'Package', 1, 1, 1, 1, 1,
  NOW(), NOW()
FROM dual WHERE NOT EXISTS (
  SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_REQ'
);

-- 5. 办公采购
INSERT INTO `approval_templates` (
  `id`, `code`, `name`, `category`, `business_type`, 
  `description`, `icon`, `is_active`, `allow_withdraw`, 
  `allow_transfer`, `notify_initiator`, `notify_approver`,
  `created_at`, `updated_at`
) SELECT 
  UUID(), 'PROC_PURCHASE', '办公采购', '办公用品', 'supply_purchase',
  '办公用品采购审批', 'ShoppingCart', 1, 1, 1, 1, 1,
  NOW(), NOW()
FROM dual WHERE NOT EXISTS (
  SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_PURCHASE'
);

-- 6. 政府采购申请
INSERT INTO `approval_templates` (
  `id`, `code`, `name`, `category`, `business_type`, 
  `description`, `icon`, `is_active`, `allow_withdraw`, 
  `allow_transfer`, `notify_initiator`, `notify_approver`,
  `created_at`, `updated_at`
) SELECT 
  UUID(), 'PROC_GOV', '政府采购申请', '采购管理', 'purchase_request',
  '政府采购项目申请审批', 'FileText', 1, 1, 1, 1, 1,
  NOW(), NOW()
FROM dual WHERE NOT EXISTS (
  SELECT 1 FROM `approval_templates` WHERE `code` = 'PROC_GOV'
);

-- 验证插入结果
SELECT id, code, name, category, is_active FROM approval_templates;
```

### 2.3 验证数据

```sql
-- 应该看到6条记录
SELECT COUNT(*) FROM approval_templates;

-- 查看详情
SELECT code, name, category, business_type, is_active 
FROM approval_templates 
ORDER BY category, name;
```

预期输出：
```
+---------------+----------------+----------+-------------------+-----------+
| code          | name           | category | business_type     | is_active |
+---------------+----------------+----------+-------------------+-----------+
| PROC_GOV      | 政府采购申请   | 采购管理 | purchase_request  | 1         |
| PROC_LEAVE    | 请假申请       | 外出管理 | leave             | 1         |
| PROC_OUT      | 外出申请       | 外出管理 | out               | 1         |
| PROC_TRIP     | 出差申请       | 外出管理 | business_trip     | 1         |
| PROC_PURCHASE | 办公采购       | 办公用品 | supply_purchase   | 1         |
| PROC_REQ      | 物品领用       | 办公用品 | supply_requisition| 1         |
+---------------+----------------+----------+-------------------+-----------+
```

---

## 🌐 第三步：构建前端

### 3.1 在开发机器上构建

```bash
# 进入项目目录
cd /path/to/lovable-project

# 安装依赖（如未安装）
npm install

# 构建生产版本
npm run build

# 构建完成后，dist/ 目录包含所有前端文件
ls -la dist/
```

### 3.2 ⚠️ 关键步骤：配置离线模式

构建后 **必须** 修改 `dist/config.js` 文件启用离线模式：

```bash
# ⚠️ 关键：替换 config.js 为实际配置（必须执行！）
cat > dist/config.js << 'EOF'
window.GOV_CONFIG = {
  // ⚠️ 修改为实际服务器IP
  API_BASE_URL: "http://83.10.82.240:3001",
  APP_NAME: "昌吉州党政办公平台",
  VERSION: "1.0.0",
  OFFLINE_MODE: true
};
EOF

# 验证 config.js 内容
cat dist/config.js
# 应该看到 window.GOV_CONFIG = { ... } 内容
```

> ⚠️ **重要**：如果不执行此步骤，前端将尝试连接 Supabase 云服务导致报错！

### 3.3 上传到服务器

```bash
# 打包 dist 目录
tar -czvf dist.tar.gz dist/

# 上传到服务器
scp dist.tar.gz root@服务器IP:/tmp/

# 在服务器上执行
ssh root@服务器IP

# 备份旧文件
mv /opt/gov-platform/web /opt/gov-platform/web.bak.$(date +%Y%m%d)

# 解压新文件
cd /tmp
tar -xzvf dist.tar.gz
mv dist /opt/gov-platform/web

# ⚠️ 再次验证 config.js 内容正确
cat /opt/gov-platform/web/config.js
# 必须看到 window.GOV_CONFIG 配置，且 OFFLINE_MODE: true

# 验证文件
ls -la /opt/gov-platform/web/
# 应包含: index.html, config.js, polyfills.js, assets/
```

---

## 🔍 第四步：验证部署

### 4.1 检查 API 服务

```bash
# 健康检查
curl http://localhost:3001/api/health

# 检查审批模板接口
curl http://localhost:3001/api/approval-templates
# 应返回6个模板的JSON数据
```

### 4.2 检查 Nginx 配置

```bash
# 确保 Nginx 配置正确
cat /usr/local/nginx/conf/nginx.conf | grep -A 20 "gov-platform"

# 重载 Nginx
/usr/local/nginx/sbin/nginx -t
/usr/local/nginx/sbin/nginx -s reload
```

### 4.3 浏览器测试

1. 访问 `http://服务器IP:8080`
2. 使用管理员账号登录：
   - 账号：`admin@gov.cn`
   - 密码：`admin123456`
3. 进入"审批设置"页面
4. **验证**：应看到6个默认审批模板

---

## 📁 更新文件清单

| 服务器路径 | 源文件 | 说明 |
|------------|--------|------|
| `/opt/gov-platform/api/src/index.js` | `deploy/api/src/index.js` | 后端 API 主文件 |
| `/opt/gov-platform/web/` | `dist/` 目录内容 | 前端全部文件 |
| `/opt/gov-platform/web/config.js` | `deploy/web/config.js` | 运行时配置 |

---

## ⚠️ 常见问题

### Q1: 审批模板页面空白
**原因**: API 未返回数据或连接失败
**解决**:
```bash
# 检查 API 日志
tail -100 /opt/gov-platform/logs/api.log

# 检查数据库连接
mysql -u root -p -e "SELECT COUNT(*) FROM gov_platform.approval_templates"
```

### Q2: 登录后跳回登录页
**原因**: 离线模式未正确识别
**解决**: 确保 `config.js` 中 `OFFLINE_MODE: true` 且文件已正确加载

### Q3: 页面显示 supabase.co 错误
**原因**: 前端未使用最新构建版本
**解决**: 重新执行 `npm run build` 并部署

---

## ✅ 部署检查清单

- [ ] 后端 API 已更新并重启
- [ ] 6个审批模板 SQL 已执行
- [ ] 前端已构建 (`npm run build`)
- [ ] `config.js` API 地址已配置正确
- [ ] 前端文件已上传至 `/opt/gov-platform/web/`
- [ ] Nginx 已重载
- [ ] 管理员可正常登录
- [ ] 审批设置页面显示6个模板
- [ ] 无 supabase.co 相关错误

---

*更新时间: 2025-02-04*
*版本: V2*
