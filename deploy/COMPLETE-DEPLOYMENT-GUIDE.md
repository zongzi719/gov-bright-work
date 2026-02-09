# 党政办公平台 - 完整部署指南

> **版本**: 2025-02-09 (最新)  
> **适用环境**: 麒麟 V10 SP1 (aarch64/ARM64) + 鲲鹏 920

---

## 📋 目录

1. [部署概览](#部署概览)
2. [第一步：环境准备](#第一步环境准备)
3. [第二步：数据库部署](#第二步数据库部署)
4. [第三步：后端 API 部署](#第三步后端-api-部署)
5. [第四步：前端部署](#第四步前端部署)
6. [第五步：Nginx 配置](#第五步nginx-配置)
7. [第六步：启动服务](#第六步启动服务)
8. [第七步：验证部署](#第七步验证部署)
9. [系统账户](#系统账户)
10. [数据库升级（增量更新）](#数据库升级增量更新)
11. [常见问题](#常见问题)
12. [日常运维](#日常运维)

---

## 部署概览

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端浏览器                             │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Nginx (端口 80/8080)                       │
│  ┌─────────────────────┬────────────────────────────────┐   │
│  │   /                 │   静态文件服务                   │   │
│  │   /api/*            │   反向代理 → Node.js API        │   │
│  │   /uploads/*        │   文件存储服务                   │   │
│  └─────────────────────┴────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐
│ Node.js API     │     │  MariaDB        │
│ (端口 3001)      │────▶│  (端口 3306)    │
└─────────────────┘     └─────────────────┘
```

### 目录结构

```
/opt/gov-platform/
├── api/                    # 后端 API
│   ├── src/
│   │   └── index.js        # API 主程序
│   ├── node_modules/       # 依赖包
│   ├── package.json
│   └── .env                # 环境配置
├── web/                    # 前端静态文件
│   ├── index.html
│   ├── config.js           # 运行时配置 ⚠️ 重要
│   ├── polyfills.js        # 浏览器兼容
│   └── assets/
├── uploads/                # 上传文件存储
│   ├── banners/
│   ├── file-transfers/
│   └── misc/
└── logs/                   # 日志文件
    └── api.log
```

---

## 第一步：环境准备

### 1.1 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | 麒麟 V10 SP1 (aarch64/ARM64) |
| 处理器 | 鲲鹏 920 或兼容 ARM64 |
| 内存 | 最低 4GB，建议 8GB+ |
| 硬盘 | 最低 20GB 可用空间 |
| Node.js | 18.x (ARM64 版本) |
| MariaDB | 10.3+ |
| Nginx | 1.18+ |

### 1.2 安装 Node.js

```bash
# 解压 ARM64 版本
tar -xf node-v18.20.4-linux-arm64.tar.xz

# 复制到系统目录
sudo cp -r node-v18.20.4-linux-arm64/* /usr/local/

# 验证安装
node -v   # 应显示 v18.20.4
npm -v    # 应显示 10.x
```

### 1.3 安装 MariaDB

```bash
# 麒麟系统安装
sudo dnf install mariadb-server mariadb -y

# 启动并设置开机自启
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 安全初始化
sudo mysql_secure_installation
```

### 1.4 安装 Nginx

详见 `deploy/README.md` 中的 Nginx 安装章节。

---

## 第二步：数据库部署

### 2.1 创建数据库

```bash
# 登录 MariaDB
mysql -u root -p

# 创建数据库（必须使用 utf8mb4）
CREATE DATABASE gov_platform 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

# 创建专用用户（可选）
CREATE USER 'govapp'@'localhost' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON gov_platform.* TO 'govapp'@'localhost';
FLUSH PRIVILEGES;

# 退出
EXIT;
```

### 2.2 初始化表结构和数据

```bash
# ⚠️ 必须指定 UTF-8 编码
mysql -u root -p --default-character-set=utf8mb4 gov_platform < deploy/database/init.sql
```

### 2.3 验证初始化

```bash
mysql -u root -p --default-character-set=utf8mb4 gov_platform

# 检查表是否创建成功
SHOW TABLES;

# 检查默认数据
SELECT name, mobile, account FROM contacts;
SELECT code, name FROM approval_templates;
SELECT name FROM office_supplies LIMIT 5;

# 退出
EXIT;
```

**预期输出**：
- 20+ 张数据表
- 1 个管理员账户（手机号 13800000001，账号 admin@gov.cn）
- 6 个默认审批模板
- 10 个办公用品
- 7 个食堂菜谱（周一至周日）

### 2.4 升级现有数据库（可选）

如果是升级部署，需要添加 account 字段：

```sql
-- 添加账号字段
ALTER TABLE contacts ADD COLUMN account VARCHAR(100) NULL AFTER mobile;
CREATE INDEX idx_contacts_account ON contacts(account);

-- 为管理员设置账号
UPDATE contacts SET account = 'admin@gov.cn' WHERE mobile = '13800000001';
```

> **注意**：更多增量更新请参考 [数据库升级（增量更新）](#数据库升级增量更新) 章节。

---

## 第三步：后端 API 部署

### 3.1 创建目录

```bash
sudo mkdir -p /opt/gov-platform/{api,web,uploads,logs}
sudo mkdir -p /opt/gov-platform/uploads/{banners,file-transfers,misc}
```

### 3.2 复制 API 文件

```bash
# 复制后端代码
sudo cp -r deploy/api/* /opt/gov-platform/api/

# 安装依赖（需在 ARM64 环境执行）
cd /opt/gov-platform/api
npm install --production
```

### 3.3 配置环境变量

```bash
# 创建配置文件
sudo cp /opt/gov-platform/api/.env.example /opt/gov-platform/api/.env

# 编辑配置
sudo vi /opt/gov-platform/api/.env
```

**.env 配置内容**：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=gov_platform

# API 服务配置
PORT=3001
NODE_ENV=production

# 文件上传配置
UPLOAD_DIR=/opt/gov-platform/uploads
MAX_FILE_SIZE=20971520
```

### 3.4 创建系统服务

```bash
sudo tee /etc/systemd/system/gov-api.service << 'EOF'
[Unit]
Description=Gov Platform API Service
After=network.target mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gov-platform/api
ExecStart=/usr/local/bin/node src/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 重新加载 systemd
sudo systemctl daemon-reload
```

---

## 第四步：前端部署

### 4.1 在开发机器构建

```bash
# 进入项目目录
cd /path/to/lovable-project

# 安装依赖
npm install

# 构建生产版本
npm run build

# 构建完成后检查
ls -la dist/
```

### 4.2 准备配置文件

确保 `dist/config.js` 内容正确：

```javascript
// ⚠️ 修改 API_BASE_URL 为实际服务器 IP
window.GOV_CONFIG = {
  API_BASE_URL: "http://83.10.82.240:3001",  // 修改为实际内网 IP
  APP_NAME: "昌吉州党政办公平台",
  VERSION: "1.0.0",
  OFFLINE_MODE: true
};
```

### 4.3 确保 index.html 引入配置

检查 `dist/index.html` 的 `<head>` 部分：

```html
<head>
  <!-- ... 其他内容 ... -->
  
  <!-- ⚠️ 必须按此顺序引入 -->
  <script src="/polyfills.js"></script>
  <script src="/config.js"></script>
</head>
```

### 4.4 上传到服务器

```bash
# 打包
tar -czvf dist.tar.gz dist/

# 上传到服务器
scp dist.tar.gz root@服务器IP:/tmp/

# 在服务器上解压
ssh root@服务器IP
cd /tmp
tar -xzvf dist.tar.gz
sudo cp -r dist/* /opt/gov-platform/web/

# 验证文件
ls -la /opt/gov-platform/web/
# 应包含: index.html, config.js, polyfills.js, assets/
```

---

## 第五步：Nginx 配置

### 5.1 创建配置文件

```bash
# 对于标准 Nginx 安装
sudo cp deploy/nginx/gov-platform.conf /etc/nginx/conf.d/

# 对于源码编译的 Nginx
sudo cp deploy/nginx/gov-platform.conf /usr/local/nginx/conf/conf.d/
```

### 5.2 配置内容

```nginx
# /etc/nginx/conf.d/gov-platform.conf

server {
    listen 8080;  # 或 80
    server_name localhost;

    # 前端静态文件
    location / {
        root /opt/gov-platform/web;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # 确保 config.js 正确加载
    location = /config.js {
        alias /opt/gov-platform/web/config.js;
        add_header Cache-Control "no-cache";
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }

    # 上传文件访问
    location /uploads/ {
        alias /opt/gov-platform/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

### 5.3 检查并重载

```bash
# 检查配置语法
nginx -t
# 或
/usr/local/nginx/sbin/nginx -t

# 重载配置
sudo systemctl reload nginx
# 或
/usr/local/nginx/sbin/nginx -s reload
```

---

## 第六步：启动服务

### 6.1 启动 API 服务

```bash
# 使用 systemd
sudo systemctl start gov-api
sudo systemctl enable gov-api

# 检查状态
sudo systemctl status gov-api
```

### 6.2 手动启动（调试用）

```bash
cd /opt/gov-platform/api
node src/index.js

# 或后台运行
nohup node src/index.js > /opt/gov-platform/logs/api.log 2>&1 &
```

### 6.3 启动 Nginx

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 第七步：验证部署

### 7.1 检查 API 健康状态

```bash
curl http://localhost:3001/api/health
# 应返回: {"status":"ok","timestamp":"...","database":"connected"}
```

### 7.2 检查审批模板

```bash
curl http://localhost:3001/api/approval-templates
# 应返回 6 个模板的 JSON 数据
```

### 7.3 浏览器访问

1. 访问 `http://服务器IP:8080`
2. 使用管理员账号登录

### 7.4 功能验证清单

- [ ] 首页正常加载，无 supabase.co 错误
- [ ] 管理员可正常登录
- [ ] 通讯录列表显示正常
- [ ] 审批设置页面显示 6 个模板
- [ ] 新增请假申请正常提交
- [ ] 流程设计节点可新增保存

---

## 系统账户

### 默认管理员

| 登录方式 | 账号 | 密码 |
|---------|------|------|
| 手机号 | 13800000001 | 123456 |
| 账号 | admin@gov.cn | 123456 |

### 登录说明

系统支持两种登录方式：
1. **手机号登录**：输入手机号 + 密码
2. **账号登录**：输入账号（account 字段）+ 密码

---

## 数据库升级（增量更新）

当系统有新功能需要更新数据库时，请按以下步骤执行增量更新。

### 最新更新：2025-02-08 ~ 2025-02-09

本次更新包含以下内容：

#### 1. leave_balances 表扩展
新增 6 种假期类型字段：
- `paternity_leave_total/used` - 陪产假（天）
- `bereavement_leave_total/used` - 丧假（天）
- `maternity_leave_total/used` - 产假（天）
- `nursing_leave_total/used` - 哺乳假（小时）
- `marriage_leave_total/used` - 婚假（天）
- `compensatory_leave_total/used` - 调休（小时）

#### 2. organizations 表扩展
新增动态审批人相关字段：
- `direct_supervisor_id` - 直接主管 ID
- `department_head_id` - 部门负责人 ID

#### 3. 假期扣减存储过程
新增 `deduct_leave_balance` 存储过程，支持自动扣减各类假期余额。

### 执行增量更新

```bash
# 1. 备份现有数据库
mysqldump -u root -p gov_platform > backup_before_update_$(date +%Y%m%d).sql

# 2. 执行增量更新脚本
mysql -u root -p --default-character-set=utf8mb4 gov_platform < deploy/database/recent-updates-2025-02-08-09.sql

# 3. 验证更新结果
mysql -u root -p gov_platform -e "SHOW COLUMNS FROM leave_balances LIKE '%leave%';"
mysql -u root -p gov_platform -e "SHOW COLUMNS FROM organizations LIKE '%supervisor%';"
mysql -u root -p gov_platform -e "SHOW PROCEDURE STATUS WHERE Db = 'gov_platform';"
```

### 后端 API 同步更新

数据库更新后，需同步更新后端 API 以支持新功能：

```bash
# 1. 备份现有 API
cp /opt/gov-platform/api/src/index.js /opt/gov-platform/api/src/index.js.bak

# 2. 上传新版本
scp deploy/api/src/index.js root@服务器IP:/opt/gov-platform/api/src/

# 3. 重启 API 服务
sudo systemctl restart gov-api

# 4. 验证
curl http://localhost:3001/api/health
```

### 前端同步更新

```bash
# 1. 在开发机构建最新版本
npm run build

# 2. 上传到服务器
scp -r dist/* root@服务器IP:/opt/gov-platform/web/

# 3. 确保 config.js 配置正确
cat /opt/gov-platform/web/config.js
# 应包含 OFFLINE_MODE: true
```

---

## 常见问题

### Q1: 页面显示 supabase.co 错误

**原因**：前端未使用离线模式
**解决**：
1. 确认 `/opt/gov-platform/web/config.js` 存在且 `OFFLINE_MODE: true`
2. 确认 `index.html` 引入了 `config.js`
3. 重新构建前端并部署

### Q2: 登录后跳回登录页

**原因**：离线模式未正确识别
**解决**：检查浏览器控制台是否加载了 `config.js`

### Q3: API 返回 500 错误

**原因**：数据库连接失败
**解决**：
```bash
# 检查 API 日志
tail -100 /opt/gov-platform/logs/api.log

# 检查数据库连接
mysql -u root -p -e "SELECT 1"

# 检查 .env 配置
cat /opt/gov-platform/api/.env
```

### Q4: 中文乱码

**原因**：MySQL 连接未使用 UTF-8
**解决**：确保导入数据时使用 `--default-character-set=utf8mb4`

### Q5: 日期格式错误

**原因**：ISO 8601 格式与 MySQL 不兼容
**解决**：已在后端 API 中添加 `formatDateForMySQL` 转换函数

### Q6: Nginx 403 Forbidden

**原因**：SELinux 限制
**解决**：
```bash
# 允许 Nginx 读取用户内容
sudo setsebool -P httpd_read_user_content 1

# 修复安全上下文
sudo restorecon -Rv /opt/gov-platform/
```

---

## 日常运维

### 服务管理

```bash
# API 服务
sudo systemctl start gov-api
sudo systemctl stop gov-api
sudo systemctl restart gov-api
sudo systemctl status gov-api

# Nginx 服务
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl reload nginx

# 数据库服务
sudo systemctl start mariadb
sudo systemctl stop mariadb
```

### 日志查看

```bash
# API 日志
tail -f /opt/gov-platform/logs/api.log

# Nginx 访问日志
tail -f /var/log/nginx/access.log
# 或
tail -f /usr/local/nginx/logs/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log
```

### 数据备份

```bash
# 备份数据库
mysqldump -u root -p gov_platform > backup_$(date +%Y%m%d).sql

# 备份上传文件
tar -czvf uploads_$(date +%Y%m%d).tar.gz /opt/gov-platform/uploads/
```

### 更新部署

```bash
# 1. 备份
cp -r /opt/gov-platform/api /opt/gov-platform/api.bak
cp -r /opt/gov-platform/web /opt/gov-platform/web.bak

# 2. 更新后端
cp -r 新版本/api/* /opt/gov-platform/api/
systemctl restart gov-api

# 3. 更新前端
cp -r 新版本/dist/* /opt/gov-platform/web/
# 确保 config.js 配置正确

# 4. 验证
curl http://localhost:3001/api/health
```

---

## 文件清单

| 服务器路径 | 源文件 | 说明 |
|------------|--------|------|
| `/opt/gov-platform/api/src/index.js` | `deploy/api/src/index.js` | 后端 API |
| `/opt/gov-platform/api/.env` | `deploy/api/.env.example` | 环境配置 |
| `/opt/gov-platform/web/*` | `dist/*` | 前端文件 |
| `/opt/gov-platform/web/config.js` | `deploy/web/config.js` | 运行时配置 |
| `/etc/nginx/conf.d/gov-platform.conf` | `deploy/nginx/gov-platform.conf` | Nginx 配置 |

---

## 更新历史

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2025-02-09 | v1.3 | 新增食堂菜谱删除功能、修复周0显示bug、新增增量更新章节 |
| 2025-02-08 | v1.2 | 扩展假期类型、添加组织主管字段、假期扣减存储过程 |
| 2025-02-04 | v1.1 | 新增账号登录、审批流版本管理 |
| 2025-01-21 | v1.0 | 初始版本 |

---

*文档更新时间: 2025-02-09*
