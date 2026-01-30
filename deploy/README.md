# 党政办公平台 - 离线部署手册

> **本文档面向运维人员**，详细说明如何在内网环境部署本系统。

---

## 目录

1. [系统要求](#系统要求)
2. [部署包清单](#部署包清单)
3. [第一步：安装 Node.js](#第一步安装-nodejs)
4. [第二步：配置 MariaDB 数据库](#第二步配置-mariadb-数据库)
5. [第三步：部署后端 API 服务](#第三步部署后端-api-服务)
6. [第四步：部署前端静态文件](#第四步部署前端静态文件)
7. [第五步：配置 Nginx](#第五步配置-nginx)
8. [第六步：启动服务](#第六步启动服务)
9. [验证部署](#验证部署)
10. [日常运维](#日常运维)
11. [故障排查](#故障排查)
12. [附录：API 接口列表](#附录api-接口列表)

---

## 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | 麒麟 V10 SP1 (aarch64/ARM64) |
| 处理器 | 鲲鹏 920 或兼容 ARM64 处理器 |
| 内存 | 最低 4GB，建议 8GB 以上 |
| 硬盘 | 最低 20GB 可用空间 |
| 数据库 | MariaDB 10.3+ (已确认支持 10.3.9) |
| Web服务器 | Nginx 1.18+ |
| 运行时 | Node.js 18.x (ARM64 版本) |

---

## 部署包清单

请确认已收到以下文件：

```
部署包/
├── node-v18.20.4-linux-arm64.tar.xz    # Node.js 运行时（约 25MB）
├── api/                                  # 后端 API 服务
│   ├── src/
│   │   └── index.js                     # API 主程序
│   ├── node_modules/                    # 依赖包（已打包）
│   ├── package.json
│   └── .env.example                     # 环境变量模板
├── database/
│   └── init.sql                         # 数据库初始化脚本
├── web/
│   ├── dist/                            # 前端静态文件
│   │   ├── index.html
│   │   ├── assets/
│   │   └── ...
│   └── config.js                        # 前端配置文件
├── nginx/
│   └── gov-platform.conf                # Nginx 配置文件
├── scripts/
│   ├── install.sh                       # 自动安装脚本
│   └── start-api.sh                     # API 启动脚本
└── README.md                            # 本文档
```

> **注意**：如果 `node_modules` 文件夹未包含在部署包中，请联系开发团队获取完整的离线依赖包。

---

## 第一步：安装 Node.js

### 1.1 解压 Node.js

```bash
# 进入部署包目录
cd /path/to/部署包

# 解压 Node.js
tar -xf node-v18.20.4-linux-arm64.tar.xz

# 复制到系统目录
sudo cp -r node-v18.20.4-linux-arm64/* /usr/local/
```

### 1.2 验证安装

```bash
# 检查 Node.js 版本
node -v
# 应显示: v18.20.4

# 检查 npm 版本
npm -v
# 应显示: 10.7.0 或类似版本
```

### 1.3 如果命令找不到

如果提示 `command not found`，需要添加环境变量：

```bash
# 编辑环境配置
sudo vi /etc/profile.d/nodejs.sh
```

添加以下内容：
```bash
export PATH=/usr/local/bin:$PATH
```

然后执行：
```bash
source /etc/profile.d/nodejs.sh
```

---

## 第二步：配置 MariaDB 数据库

### 2.1 登录数据库

```bash
mysql -u root -p
# 输入 root 密码
```

### 2.2 创建数据库和用户

在 MariaDB 命令行中执行：

```sql
-- 创建数据库
CREATE DATABASE gov_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（请修改密码）
CREATE USER 'gov_admin'@'localhost' IDENTIFIED BY '请修改为强密码';

-- 授予权限
GRANT ALL PRIVILEGES ON gov_platform.* TO 'gov_admin'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

> **重要**：请将 `'请修改为强密码'` 替换为实际的强密码，并妥善保管。

### 2.3 初始化数据库表结构

```bash
# 执行初始化脚本
mysql -u gov_admin -p gov_platform < /path/to/部署包/database/init.sql
# 输入上一步设置的密码
```

### 2.4 验证数据库

```bash
mysql -u gov_admin -p gov_platform -e "SHOW TABLES;"
```

应显示以下表：
```
+------------------------+
| Tables_in_gov_platform |
+------------------------+
| absence_records        |
| banners                |
| canteen_menus          |
| contacts               |
| file_transfers         |
| leader_schedules       |
| notices                |
| organizations          |
| roles                  |
| schedules              |
| ...                    |
+------------------------+
```

---

## 第三步：部署后端 API 服务

### 3.1 创建部署目录

```bash
# 创建应用目录
sudo mkdir -p /opt/gov-platform/{api,web,uploads,logs}

# 创建上传子目录
sudo mkdir -p /opt/gov-platform/uploads/{banners,file-transfers,avatars,misc}

# 设置目录权限
sudo chown -R $USER:$USER /opt/gov-platform
```

### 3.2 复制 API 文件

```bash
# 复制 API 服务文件
cp -r /path/to/部署包/api/* /opt/gov-platform/api/
```

### 3.3 配置环境变量

```bash
# 进入 API 目录
cd /opt/gov-platform/api

# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
vi .env
```

修改 `.env` 文件内容：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=gov_admin
DB_PASSWORD=你设置的数据库密码
DB_NAME=gov_platform

# API 服务配置
API_PORT=3001
API_BASE_URL=http://服务器内网IP:3001

# 文件上传配置
UPLOAD_DIR=/opt/gov-platform/uploads
MAX_FILE_SIZE=10485760

# 安全配置（请修改为随机字符串）
JWT_SECRET=请修改为32位以上的随机字符串
```

> **重要配置说明**：
> - `DB_PASSWORD`：填写第二步创建的数据库用户密码
> - `API_BASE_URL`：将 `服务器内网IP` 替换为本机实际内网 IP 地址
> - `JWT_SECRET`：用于加密登录令牌，请使用随机字符串

### 3.4 获取服务器内网 IP

```bash
# 查看网卡信息
ip addr show

# 或使用
hostname -I
```

记录显示的内网 IP 地址（如 `192.168.1.100`），用于后续配置。

---

## 第四步：部署前端静态文件

### 4.1 复制前端文件

```bash
# 复制前端静态文件
cp -r /path/to/部署包/web/dist/* /opt/gov-platform/web/

# 复制前端配置文件
cp /path/to/部署包/web/config.js /opt/gov-platform/web/
```

### 4.2 修改前端配置

```bash
vi /opt/gov-platform/web/config.js
```

修改内容：

```javascript
window.GOV_PLATFORM_CONFIG = {
  // 将下面的 IP 地址改为服务器实际内网 IP
  API_BASE_URL: 'http://192.168.1.100:3001',
  
  // 上传文件大小限制（字节）
  MAX_UPLOAD_SIZE: 10485760,
  
  // 系统名称
  SYSTEM_NAME: '党政办公平台'
};
```

---

## 第五步：配置 Nginx

### 5.1 复制 Nginx 配置

```bash
# 复制配置文件
sudo cp /path/to/部署包/nginx/gov-platform.conf /etc/nginx/conf.d/
```

### 5.2 修改 Nginx 配置

```bash
sudo vi /etc/nginx/conf.d/gov-platform.conf
```

需要修改的内容：

```nginx
server {
    listen 80;
    server_name 192.168.1.100;  # 改为服务器内网 IP 或域名

    # 前端静态文件
    root /opt/gov-platform/web;
    index index.html;

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;  # API 服务地址
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 文件上传大小限制
        client_max_body_size 20M;
    }

    # 上传文件访问
    location /uploads/ {
        alias /opt/gov-platform/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # 前端路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 日志配置
    access_log /var/log/nginx/gov-platform-access.log;
    error_log /var/log/nginx/gov-platform-error.log;
}
```

### 5.3 测试并重载 Nginx

```bash
# 测试配置是否正确
sudo nginx -t

# 如果显示 "syntax is ok" 和 "test is successful"，则重载配置
sudo systemctl reload nginx
```

---

## 第六步：启动服务

### 方式一：直接启动（测试用）

```bash
cd /opt/gov-platform/api
node src/index.js
```

> 此方式适合测试，关闭终端后服务会停止。

### 方式二：使用 PM2 管理（推荐生产环境）

#### 6.1 安装 PM2（如果部署包中包含）

```bash
# 如果部署包中有 pm2
sudo npm install -g pm2 --offline
```

#### 6.2 启动服务

```bash
cd /opt/gov-platform/api

# 启动 API 服务
pm2 start src/index.js --name "gov-api"

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
# 按照提示执行显示的命令
```

#### 6.3 PM2 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs gov-api

# 重启服务
pm2 restart gov-api

# 停止服务
pm2 stop gov-api
```

### 方式三：使用 systemd 服务（推荐）

#### 6.1 创建服务文件

```bash
sudo vi /etc/systemd/system/gov-api.service
```

添加以下内容：

```ini
[Unit]
Description=党政办公平台 API 服务
After=network.target mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gov-platform/api
ExecStart=/usr/local/bin/node src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/opt/gov-platform/logs/api.log
StandardError=append:/opt/gov-platform/logs/api-error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### 6.2 启用并启动服务

```bash
# 重载 systemd 配置
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable gov-api

# 启动服务
sudo systemctl start gov-api

# 查看服务状态
sudo systemctl status gov-api
```

---

## 验证部署

### 7.1 检查 API 服务

```bash
# 测试 API 健康检查接口
curl http://localhost:3001/api/health
```

正常响应：
```json
{"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

### 7.2 检查 Nginx

```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 测试通过 Nginx 访问 API
curl http://服务器IP/api/health
```

### 7.3 浏览器访问

在内网其他电脑上，打开浏览器访问：

```
http://服务器内网IP/
```

应显示系统登录页面。

### 7.4 测试登录

默认测试账户（如果执行了完整的初始化脚本）：
- 用户名（手机号）：`13800000001`
- 密码：`123456`

> **重要**：首次登录后请立即修改密码！

---

## 日常运维

### 8.1 日志位置

| 日志类型 | 位置 |
|---------|------|
| API 服务日志 | `/opt/gov-platform/logs/api.log` |
| API 错误日志 | `/opt/gov-platform/logs/api-error.log` |
| Nginx 访问日志 | `/var/log/nginx/gov-platform-access.log` |
| Nginx 错误日志 | `/var/log/nginx/gov-platform-error.log` |

### 8.2 查看日志

```bash
# 实时查看 API 日志
tail -f /opt/gov-platform/logs/api.log

# 查看最近的错误
tail -100 /opt/gov-platform/logs/api-error.log
```

### 8.3 服务管理命令

```bash
# 重启 API 服务
sudo systemctl restart gov-api

# 重启 Nginx
sudo systemctl restart nginx

# 查看服务状态
sudo systemctl status gov-api nginx
```

### 8.4 数据库备份

```bash
# 备份数据库
mysqldump -u gov_admin -p gov_platform > /backup/gov_platform_$(date +%Y%m%d).sql

# 恢复数据库
mysql -u gov_admin -p gov_platform < /backup/gov_platform_20240115.sql
```

### 8.5 清理上传文件

```bash
# 查看上传目录大小
du -sh /opt/gov-platform/uploads/*

# 清理 30 天前的临时文件（谨慎操作）
find /opt/gov-platform/uploads/misc -mtime +30 -delete
```

---

## 故障排查

### 问题1：API 服务无法启动

**检查步骤：**

```bash
# 1. 检查端口是否被占用
netstat -tlnp | grep 3001

# 2. 检查 Node.js 是否安装正确
node -v

# 3. 检查环境变量配置
cat /opt/gov-platform/api/.env

# 4. 手动运行查看错误信息
cd /opt/gov-platform/api
node src/index.js
```

### 问题2：数据库连接失败

**检查步骤：**

```bash
# 1. 检查 MariaDB 服务状态
sudo systemctl status mariadb

# 2. 测试数据库连接
mysql -u gov_admin -p gov_platform -e "SELECT 1"

# 3. 检查 .env 中的数据库配置是否正确
cat /opt/gov-platform/api/.env | grep DB_
```

### 问题3：Nginx 502 Bad Gateway

**检查步骤：**

```bash
# 1. 检查 API 服务是否运行
curl http://localhost:3001/api/health

# 2. 检查 Nginx 错误日志
tail -50 /var/log/nginx/gov-platform-error.log

# 3. 检查 SELinux（如果启用）
sudo setsebool -P httpd_can_network_connect 1
```

### 问题4：页面显示空白

**检查步骤：**

```bash
# 1. 检查前端文件是否存在
ls -la /opt/gov-platform/web/

# 2. 检查 Nginx 配置中的 root 路径是否正确
grep "root" /etc/nginx/conf.d/gov-platform.conf

# 3. 检查文件权限
sudo chmod -R 755 /opt/gov-platform/web/
```

### 问题5：文件上传失败

**检查步骤：**

```bash
# 1. 检查上传目录权限
ls -la /opt/gov-platform/uploads/

# 2. 修复权限
sudo chown -R $USER:$USER /opt/gov-platform/uploads/
sudo chmod -R 755 /opt/gov-platform/uploads/

# 3. 检查 Nginx 上传大小限制
grep "client_max_body_size" /etc/nginx/conf.d/gov-platform.conf
```

---

## 附录：API 接口列表

### 认证接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/auth/change-password` | POST | 修改密码 |

### 基础数据接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/organizations` | GET | 获取组织架构 |
| `/api/contacts` | GET | 获取通讯录 |
| `/api/contacts/:id` | GET | 获取联系人详情 |
| `/api/notices` | GET | 获取公告列表 |
| `/api/banners` | GET | 获取轮播图 |
| `/api/canteen-menus` | GET | 获取食堂菜单 |

### 业务接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/absence-records` | GET/POST | 请假/外出/出差记录 |
| `/api/absence-records/:id` | GET/PUT/DELETE | 记录详情操作 |
| `/api/todo-items` | GET | 获取待办事项 |
| `/api/leader-schedules` | GET | 获取领导日程 |
| `/api/file-transfers` | GET/POST | 公文收发 |

### 文件上传接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/upload/banners` | POST | 上传轮播图 |
| `/api/upload/file-transfers` | POST | 上传公文附件 |
| `/api/upload/avatars` | POST | 上传头像 |
| `/api/upload/misc` | POST | 上传其他文件 |

---

## 技术支持

如遇到本文档无法解决的问题，请联系开发团队并提供以下信息：

1. 问题描述
2. 相关日志截图
3. 执行的操作步骤
4. 服务器环境信息（`uname -a` 输出）

---

**文档版本**：v1.0  
**更新日期**：2024年1月
