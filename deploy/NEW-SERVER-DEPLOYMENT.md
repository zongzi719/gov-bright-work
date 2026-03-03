# 党政办公平台 - 前后端一体部署指南（完整版）

> **部署架构**：前后端一体部署（单台服务器，Nginx 统一代理）  
> **目标服务器**：鲲鹏920 CPU / 128GB 内存 / 麒麟 V10 操作系统  
> **数据库**：MariaDB  
> **本指南覆盖**：MariaDB 安装 → 数据库初始化 → 后端 API 部署 → 前端部署 → Nginx 配置 → 信任体系接口 → 增量更新

---

## 🏗️ 架构总览

```
                    ┌─────────────────────────────────────────┐
                    │          鲲鹏 920 服务器                  │
                    │                                         │
  浏览器访问         │  ┌──────────┐     ┌──────────────────┐  │
  http://IP ───────►│  │  Nginx   │────►│  前端静态文件      │  │
                    │  │  :80     │     │  /opt/.../web/    │  │
                    │  │          │     └──────────────────┘  │
  信任体系测试工具    │  │          │     ┌──────────────────┐  │
  http://IP/api/ ──►│  │  /api/* ─┼────►│  Node.js API     │  │
                    │  └──────────┘     │  :3001            │  │
                    │                   │  ┌──────────────┐ │  │
                    │                   │  │  MariaDB     │ │  │
                    │                   │  │  :3306       │ │  │
                    │                   │  └──────────────┘ │  │
                    │                   └──────────────────┘  │
                    └─────────────────────────────────────────┘
```

**访问地址汇总：**

| 功能 | 地址 |
|------|------|
| 前端网页 | `http://服务器IP/` |
| 管理后台 | `http://服务器IP/admin-login` |
| API 健康检查 | `http://服务器IP/api/health` |
| 信任体系消息订阅 | `http://服务器IP/api/cjgov/message-subscription` |

---

## 📋 部署前准备

### 需要准备的文件（在有网络的机器上下载）

| 文件 | 用途 | 下载地址 |
|------|------|----------|
| `node-v18.20.4-linux-arm64.tar.xz` | Node.js 运行时 | https://nodejs.org/dist/v18.20.4/ |
| MariaDB RPM 包 | 数据库 | 麒麟软件源或离线 RPM |
| Nginx RPM 包或源码 | Web 服务器 | 麒麟软件源或 https://nginx.org/download/ |
| 本项目 `deploy/` 目录 | 应用程序 | 项目源码 |
| 前端构建产物 `dist/` | 前端静态文件 | `npm run build` 生成 |

### 打包部署包（在有网络的开发机上执行）

```bash
# 1. 克隆或拉取最新代码
cd /path/to/project

# 2. 构建前端
npm install
npm run build

# 3. 准备后端依赖（需在 ARM64 机器上执行，或交叉编译）
cd deploy/api
npm install --production
cd ../..

# 4. 打包整个部署包
tar -czvf gov-platform-deploy.tar.gz \
  deploy/ \
  dist/ \
  public/config.js \
  public/polyfills.js
```

> ⚠️ **重要**：`node_modules` 必须在 ARM64 架构的机器上安装，以确保原生模块兼容。如果开发机是 x86，需要在鲲鹏服务器上执行 `npm install`。

---

## 第一步：安装 Node.js

```bash
# 以 root 用户操作
su - root

# 1. 上传并解压 Node.js
cd /root
tar -xf node-v18.20.4-linux-arm64.tar.xz

# 2. 复制到系统目录
cp -r node-v18.20.4-linux-arm64/* /usr/local/

# 3. 配置环境变量（如果 node 命令找不到）
tee /etc/profile.d/nodejs.sh << 'EOF'
export PATH=/usr/local/bin:$PATH
EOF
source /etc/profile.d/nodejs.sh

# 4. 验证
node -v    # 应显示 v18.20.4
npm -v     # 应显示 10.x
```

---

## 第二步：安装 MariaDB

### 方式一：使用麒麟系统包管理器

```bash
# 如果已配置本地软件源（光盘/ISO 源）
dnf install mariadb-server mariadb -y

# 或
yum install mariadb-server mariadb -y
```

### 方式二：离线 RPM 安装

如果系统无软件源，在有网络的同架构机器上下载 RPM：

```bash
# --- 在有网络的 ARM64 机器上 ---
mkdir mariadb-rpms && cd mariadb-rpms
dnf download mariadb-server mariadb --resolve --destdir=./
tar -czvf mariadb-rpms.tar.gz *.rpm

# --- 传输到目标服务器后 ---
tar -xzvf mariadb-rpms.tar.gz
rpm -ivh *.rpm --nodeps --force
# 或
dnf localinstall *.rpm -y
```

### 方式三：使用麒麟V10安装光盘/ISO离线安装（推荐无网络环境）

麒麟V10系统ISO镜像通常自带 MariaDB 的 RPM 包，无需联网：

```bash
# 1. 挂载麒麟V10安装ISO（U盘或光盘）
mkdir -p /mnt/cdrom
mount -o loop /path/to/KylinV10.iso /mnt/cdrom
# 如果是光驱：mount /dev/cdrom /mnt/cdrom

# 2. 配置本地yum源
tee /etc/yum.repos.d/local.repo << 'EOF'
[local]
name=Kylin V10 Local Repo
baseurl=file:///mnt/cdrom
enabled=1
gpgcheck=0
EOF

# 3. 安装 MariaDB
dnf --disablerepo="*" --enablerepo="local" install mariadb-server mariadb -y

# 4. 安装完成后可卸载ISO
umount /mnt/cdrom
```

> ⚠️ 如果ISO中没有 MariaDB 包，则必须使用**方式二**，在一台能联网的 ARM64 机器上下载 RPM 包后通过U盘传输。

### 启动 MariaDB

```bash
# 启动服务
systemctl start mariadb

# 设置开机自启
systemctl enable mariadb

# 检查状态
systemctl status mariadb
```

### 安全初始化

```bash
mysql_secure_installation
```

按提示操作：
1. 输入当前 root 密码（首次直接回车）
2. **设置新的 root 密码** → 记录此密码，后续配置需要
3. 移除匿名用户 → Y
4. 禁止 root 远程登录 → Y
5. 移除测试数据库 → Y
6. 重新加载权限表 → Y

### 验证 MariaDB

```bash
mysql -u root -p -e "SELECT VERSION();"
# 应显示 MariaDB 版本号
```

---

## 第三步：初始化数据库

```bash
# 1. 创建数据库
mysql -u root -p --default-character-set=utf8mb4 -e "
  CREATE DATABASE IF NOT EXISTS gov_platform 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;
"

# 2. 执行初始化脚本（创建所有表结构和初始数据）
mysql -u root -p --default-character-set=utf8mb4 gov_platform < /path/to/deploy/database/init.sql

# 3. 验证表创建成功
mysql -u root -p gov_platform -e "SHOW TABLES;"
```

应显示约 25+ 张表，包括：
```
absence_records, approval_form_fields, approval_instances, approval_nodes,
approval_process_versions, approval_records, approval_templates, banners,
canteen_menus, contacts, file_transfers, leader_schedule_permissions,
leader_schedules, leave_balances, notice_images, notices, office_supplies,
organizations, profiles, purchase_request_items, purchase_requests,
role_permissions, roles, schedules, stock_movements, supply_purchase_items,
supply_purchases, supply_requisition_items, supply_requisitions,
todo_items, user_roles
```

### 验证默认管理员账号

```bash
mysql -u root -p gov_platform -e "
  SELECT c.name, c.mobile, c.account, c.password_hash, ur.role
  FROM contacts c 
  LEFT JOIN user_roles ur ON ur.user_id = c.id 
  WHERE c.account = 'admin@gov.cn';
"
```

默认管理员：
- **账号**：`admin@gov.cn` 或手机号 `13800000001`
- **密码**：`123456`（部署后请立即修改）

---

## 第四步：部署后端 API

```bash
# 1. 创建应用目录
mkdir -p /opt/gov-platform/{api,web,uploads,logs}
mkdir -p /opt/gov-platform/uploads/{banners,file-transfers,misc}

# 2. 复制后端代码
cp -r /path/to/deploy/api/* /opt/gov-platform/api/

# 3. 安装依赖（必须在服务器上执行以确保 ARM64 兼容）
cd /opt/gov-platform/api
npm install --production

# 4. 创建环境配置
cp .env.example .env

# 5. 编辑配置文件
vi .env
```

### 编辑 .env 文件

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你在第二步设置的MariaDB密码
DB_NAME=gov_platform

# API配置
API_PORT=3001
# 修改为服务器实际IP地址
API_BASE_URL=http://服务器IP:3001
```

### 验证后端启动

```bash
cd /opt/gov-platform/api
node src/index.js &

# 测试健康检查
curl http://localhost:3001/api/health
# 应返回 {"status":"ok"}

# 测试登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"admin@gov.cn","password":"123456"}'
# 应返回用户信息

# 先停止测试进程
kill %1
```

---

## 第五步：部署前端

```bash
# 1. 复制前端构建产物
cp -r /path/to/dist/* /opt/gov-platform/web/

# 2. 创建/修改前端运行时配置（⚠️ 关键步骤！）
cat > /opt/gov-platform/web/config.js << 'EOF'
window.GOV_CONFIG = {
  // ⚠️ 修改为服务器实际IP地址
  API_BASE_URL: "http://服务器实际IP:3001",
  APP_NAME: "昌吉州党政办公平台",
  VERSION: "1.0.0",
  OFFLINE_MODE: true
};
EOF

# 3. 确保 polyfills.js 存在
ls -la /opt/gov-platform/web/polyfills.js
# 如果不存在，从源码复制
cp /path/to/public/polyfills.js /opt/gov-platform/web/
```

> ⚠️ **每次重新构建前端（`npm run build`）后**，都必须重新创建 `config.js` 文件！构建过程会覆盖它。

---

## 第六步：安装并配置 Nginx

### 安装 Nginx

参考 [deploy/README.md](./README.md) 中的三种安装方式（RPM/源码编译/包管理器）。

### 配置 Nginx

```bash
# 根据安装方式，配置目录可能不同：
# RPM 安装: /etc/nginx/conf.d/
# 源码编译: /usr/local/nginx/conf/conf.d/  (需要在 nginx.conf 中 include)

# 1. 复制配置文件
cp /path/to/deploy/nginx/gov-platform.conf /etc/nginx/conf.d/
# 或（源码编译安装时）
mkdir -p /usr/local/nginx/conf/conf.d/
cp /path/to/deploy/nginx/gov-platform.conf /usr/local/nginx/conf/conf.d/
```

### 检查/修改 Nginx 配置

```bash
vi /etc/nginx/conf.d/gov-platform.conf
```

确认以下内容正确：

```nginx
server {
    listen 80;
    server_name _;  # 或指定域名/IP

    # 前端静态文件
    root /opt/gov-platform/web;
    index index.html;

    # config.js 显式映射
    location = /config.js {
        alias /opt/gov-platform/web/config.js;
        add_header Cache-Control "no-cache";
    }

    # polyfills.js
    location = /polyfills.js {
        alias /opt/gov-platform/web/polyfills.js;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 上传文件访问
    location /uploads/ {
        alias /opt/gov-platform/uploads/;
    }

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 如果是源码编译安装

需要在主配置文件中添加 include：

```bash
vi /usr/local/nginx/conf/nginx.conf
```

在 `http {}` 块的末尾添加：

```nginx
include /usr/local/nginx/conf/conf.d/*.conf;
```

### 启动 Nginx

```bash
# 测试配置语法
nginx -t
# 或
/usr/local/nginx/sbin/nginx -t

# 启动
systemctl start nginx
systemctl enable nginx

# 或源码安装
/usr/local/nginx/sbin/nginx
```

---

## 第七步：启动 API 服务（生产模式）

### 方式一：使用 systemd（推荐）

```bash
# 创建 systemd 服务文件
tee /etc/systemd/system/gov-api.service << 'EOF'
[Unit]
Description=Gov Platform API Service
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gov-platform/api
ExecStart=/usr/local/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 重载 systemd
systemctl daemon-reload

# 启动服务
systemctl start gov-api

# 设置开机自启
systemctl enable gov-api

# 查看状态
systemctl status gov-api
```

### 方式二：使用 PM2

```bash
# 安装 PM2（如果网络可用）
npm install -g pm2

# 启动
cd /opt/gov-platform/api
pm2 start src/index.js --name gov-api
pm2 save
pm2 startup
```

### 方式三：后台运行（临时方案）

```bash
cd /opt/gov-platform/api
nohup node src/index.js > /opt/gov-platform/logs/api.log 2>&1 &
echo $!  # 记录 PID
```

---

## 第八步：验证部署

### 1. 检查服务状态

```bash
# API 服务
systemctl status gov-api
# 或
curl http://localhost:3001/api/health

# Nginx
systemctl status nginx
# 或
curl -I http://localhost

# MariaDB
systemctl status mariadb
```

### 2. 浏览器访问测试

打开浏览器访问 `http://服务器IP/`

- 应看到登录页面
- 使用 `admin@gov.cn` / `123456` 登录
- 登录后应能看到首页、通讯录、公告等功能

### 3. 功能检查清单

| 功能 | 验证方法 | 预期结果 |
|------|----------|----------|
| 登录 | 输入 admin@gov.cn / 123456 | 成功进入首页 |
| 通讯录 | 点击通讯录菜单 | 显示组织架构和联系人 |
| 公告列表 | 查看首页公告区域 | 显示公告列表 |
| 管理后台 | 访问 /admin-login | 管理员可登录后台 |
| 文件上传 | 在后台上传轮播图 | 图片上传成功 |
| 审批流程 | 提交请假申请 | 流程正常创建 |

---

## 📌 重要注意事项

### config.js 维护

每次通过 `npm run build` 重新构建前端并替换 `/opt/gov-platform/web/` 后，**必须重新创建 `config.js`**：

```bash
cat > /opt/gov-platform/web/config.js << 'EOF'
window.GOV_CONFIG = {
  API_BASE_URL: "http://服务器实际IP:3001",
  APP_NAME: "昌吉州党政办公平台",
  VERSION: "1.0.0",
  OFFLINE_MODE: true
};
EOF
```

### 防火墙配置

```bash
# 开放 80 端口（HTTP）
firewall-cmd --permanent --add-port=80/tcp

# 如果需要从外部直接访问 API（通常不需要，Nginx 已代理）
# firewall-cmd --permanent --add-port=3001/tcp

firewall-cmd --reload
```

### 日志查看

```bash
# API 日志
journalctl -u gov-api -f
# 或
tail -f /opt/gov-platform/logs/api.log

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
# 或（源码安装）
tail -f /usr/local/nginx/logs/error.log
```

### 服务管理速查

```bash
# 重启 API
systemctl restart gov-api

# 重启 Nginx
systemctl restart nginx
# 或
/usr/local/nginx/sbin/nginx -s reload

# 重启 MariaDB
systemctl restart mariadb
```

---

## 🔧 故障排查

### 问题 1：前端页面空白

```bash
# 检查 config.js 是否存在且内容正确
cat /opt/gov-platform/web/config.js

# 检查 Nginx 配置是否正确
nginx -t

# 检查浏览器控制台是否有 JS 错误
```

### 问题 2：API 连接失败

```bash
# 检查 API 是否运行
curl http://localhost:3001/api/health

# 检查 .env 数据库配置
cat /opt/gov-platform/api/.env

# 检查 MariaDB 连接
mysql -u root -p -e "SELECT 1;"
```

### 问题 3：登录失败

```bash
# 验证管理员账号是否存在
mysql -u root -p gov_platform -e "
  SELECT id, name, mobile, account, password_hash 
  FROM contacts WHERE account = 'admin@gov.cn';
"

# 如果不存在，手动插入
mysql -u root -p --default-character-set=utf8mb4 gov_platform -e "
  SET @org_id = (SELECT id FROM organizations LIMIT 1);
  SET @admin_id = UUID();
  INSERT INTO contacts (id, name, mobile, account, email, position, department, 
    organization_id, is_leader, is_active, security_level, password_hash) 
  VALUES (@admin_id, '系统管理员', '13800000001', 'admin@gov.cn', 'admin@gov.cn', 
    '管理员', '信息中心', @org_id, 1, 1, '机密', '123456');
  INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), @admin_id, 'admin');
"
```

### 问题 4：中文乱码

```bash
# 确认数据库字符集
mysql -u root -p -e "
  SHOW VARIABLES LIKE 'character_set%';
  SHOW VARIABLES LIKE 'collation%';
"

# 所有应显示 utf8mb4
# 如果不是，修改 MariaDB 配置
vi /etc/my.cnf.d/server.cnf
# 在 [mysqld] 下添加：
# character-set-server=utf8mb4
# collation-server=utf8mb4_unicode_ci

systemctl restart mariadb
```

---

## 📁 最终目录结构

```
/opt/gov-platform/
├── api/                          # 后端 API 服务
│   ├── src/index.js              # 主程序（3600+ 行，覆盖全部业务接口）
│   ├── node_modules/             # 依赖包
│   ├── .env                      # 环境配置（数据库密码等）
│   └── package.json
├── web/                          # 前端静态文件
│   ├── index.html                # 入口 HTML
│   ├── config.js                 # ⚠️ 运行时配置（每次构建后需恢复）
│   ├── polyfills.js              # 旧浏览器兼容
│   └── assets/                   # JS/CSS/图片资源
├── uploads/                      # 文件上传存储
│   ├── banners/                  # 轮播图
│   ├── file-transfers/           # 文件收发附件
│   └── misc/                     # 其他文件
└── logs/                         # 日志
    └── api.log
```

---

## ⏱ 预计部署时间

| 步骤 | 预计时间 |
|------|----------|
| Node.js 安装 | 5 分钟 |
| MariaDB 安装 | 10-20 分钟 |
| 数据库初始化 | 2 分钟 |
| 后端部署 | 5-10 分钟 |
| 前端部署 | 5 分钟 |
| Nginx 配置 | 10-15 分钟 |
| 验证测试 | 10 分钟 |
| **总计** | **约 50-70 分钟** |
