# 党政办公平台 - 离线部署手册

> **本文档面向运维人员**，详细说明如何在内网环境从零开始部署本系统。

---

## 目录

1. [系统要求](#系统要求)
2. [部署包清单](#部署包清单)
3. [环境准备](#环境准备)
   - [安装 Node.js](#安装-nodejs)
   - [安装 MariaDB](#安装-mariadb)
   - [安装 Nginx](#安装-nginx)
4. [数据库配置](#数据库配置)
5. [部署后端 API](#部署后端-api)
6. [部署前端](#部署前端)
7. [配置 Nginx](#配置-nginx)
8. [启动服务](#启动服务)
9. [验证部署](#验证部署)
10. [日常运维](#日常运维)
11. [故障排查](#故障排查)
12. [附录](#附录)

---

## 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | 麒麟 V10 SP1 (aarch64/ARM64) |
| 处理器 | 鲲鹏 920 或兼容 ARM64 处理器 |
| 内存 | 最低 4GB，建议 8GB 以上 |
| 硬盘 | 最低 20GB 可用空间 |
| 数据库 | MariaDB 10.3+ |
| Web服务器 | Nginx 1.18+ |
| 运行时 | Node.js 18.x (ARM64 版本) |

---

## 部署包清单

请确认已收到以下文件：

```
部署包/
├── node-v18.20.4-linux-arm64.tar.xz    # Node.js 运行时（约 25MB）
├── rpm-packages/                        # 离线 RPM 安装包（可选）
│   ├── mariadb-*.rpm
│   └── nginx-*.rpm
├── api/                                  # 后端 API 服务
│   ├── src/
│   │   └── index.js                     # API 主程序
│   ├── node_modules/                    # 依赖包（已打包）
│   ├── package.json
│   └── .env.example                     # 环境变量模板
├── database/
│   └── init.sql                         # 数据库初始化脚本
├── web/                                  # 前端静态文件
│   ├── index.html
│   ├── assets/
│   ├── config.js                        # 前端配置文件
│   └── ...
├── nginx/
│   └── gov-platform.conf                # Nginx 配置文件
├── scripts/
│   ├── install.sh                       # 自动安装脚本
│   └── start-api.sh                     # API 启动脚本
└── README.md                            # 本文档
```

> **重要**：如部署包缺少某些文件，请联系开发团队获取完整包。

---

## 环境准备

### 安装 Node.js

#### 方式一：使用预编译包（推荐）

```bash
# 1. 进入部署包目录
cd /path/to/部署包

# 2. 解压 Node.js ARM64 版本
tar -xf node-v18.20.4-linux-arm64.tar.xz

# 3. 复制到系统目录
sudo cp -r node-v18.20.4-linux-arm64/* /usr/local/

# 4. 验证安装
node -v
# 应显示: v18.20.4

npm -v
# 应显示: 10.7.0 或类似版本
```

#### 如果提示 command not found

```bash
# 创建环境变量配置
sudo tee /etc/profile.d/nodejs.sh << 'EOF'
export PATH=/usr/local/bin:$PATH
EOF

# 加载环境变量
source /etc/profile.d/nodejs.sh

# 再次验证
node -v
```

---

### 安装 MariaDB

#### 方式一：使用系统包管理器（需要配置本地源）

```bash
# 麒麟 V10 使用 dnf/yum
sudo dnf install mariadb-server mariadb -y

# 或者使用 yum
sudo yum install mariadb-server mariadb -y
```

#### 方式二：使用离线 RPM 包

如果部署包中包含 `rpm-packages/` 目录：

```bash
cd /path/to/部署包/rpm-packages

# 安装所有 MariaDB 相关包
sudo rpm -ivh mariadb-*.rpm --nodeps --force

# 如果有依赖问题，可以尝试
sudo dnf localinstall mariadb-*.rpm -y
```

#### 方式三：从麒麟软件源安装

```bash
# 配置麒麟官方软件源（如果尚未配置）
sudo tee /etc/yum.repos.d/kylin.repo << 'EOF'
[kylin]
name=Kylin Linux Advanced Server 10 - Os
baseurl=file:///mnt/cdrom/
enabled=1
gpgcheck=0
EOF

# 挂载安装光盘（如果使用光盘源）
sudo mount /dev/cdrom /mnt/cdrom

# 安装
sudo dnf install mariadb-server mariadb -y
```

#### 启动 MariaDB 服务

```bash
# 启动服务
sudo systemctl start mariadb

# 设置开机自启
sudo systemctl enable mariadb

# 检查状态
sudo systemctl status mariadb
```

#### 初始化 MariaDB 安全设置

```bash
# 运行安全初始化向导
sudo mysql_secure_installation
```

按提示操作：
1. 输入当前 root 密码（首次安装直接回车）
2. 设置新的 root 密码：**请设置强密码并记录**
3. 移除匿名用户：输入 `Y`
4. 禁止 root 远程登录：输入 `Y`
5. 移除测试数据库：输入 `Y`
6. 重新加载权限表：输入 `Y`

---

### 安装 Nginx

#### 方式一：使用系统包管理器

```bash
# 麒麟 V10
sudo dnf install nginx -y

# 或使用 yum
sudo yum install nginx -y
```

#### 方式二：使用离线 RPM 包

```bash
cd /path/to/部署包/rpm-packages

# 安装 Nginx
sudo rpm -ivh nginx-*.rpm --nodeps --force

# 或使用 dnf 安装本地包
sudo dnf localinstall nginx-*.rpm -y
```

#### 方式三：从源码编译（高级）

如果以上方式都不可用，可以从源码编译：

```bash
# 安装编译依赖
sudo dnf install gcc pcre-devel zlib-devel openssl-devel -y

# 下载 Nginx 源码（需要提前下载并放入部署包）
tar -xzf nginx-1.24.0.tar.gz
cd nginx-1.24.0

# 配置
./configure --prefix=/usr/local/nginx \
  --with-http_ssl_module \
  --with-http_realip_module \
  --with-http_gzip_static_module

# 编译安装
make && sudo make install

# 创建软链接
sudo ln -s /usr/local/nginx/sbin/nginx /usr/local/bin/nginx
```

#### 启动 Nginx 服务

```bash
# 启动服务
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx

# 检查状态
sudo systemctl status nginx

# 测试配置
sudo nginx -t
```

#### 验证 Nginx 安装

```bash
# 检查版本
nginx -v

# 浏览器访问服务器 IP，应显示 Nginx 欢迎页
curl http://localhost
```

---

## 数据库配置

### 创建数据库和用户

```bash
# 登录 MariaDB
mysql -u root -p
# 输入 root 密码
```

在 MariaDB 命令行中执行：

```sql
-- 创建数据库
CREATE DATABASE gov_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（请修改密码为强密码）
CREATE USER 'gov_admin'@'localhost' IDENTIFIED BY '请修改为强密码';

-- 授予权限
GRANT ALL PRIVILEGES ON gov_platform.* TO 'gov_admin'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

> **重要**：请将 `'请修改为强密码'` 替换为实际的强密码，并妥善保管。

### 初始化数据库表结构

```bash
# 执行初始化脚本
mysql -u gov_admin -p gov_platform < /path/to/部署包/database/init.sql
# 输入上一步设置的密码
```

### 验证数据库

```bash
mysql -u gov_admin -p gov_platform -e "SHOW TABLES;"
```

应显示类似以下表列表：
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

## 部署后端 API

### 创建目录结构

```bash
# 创建应用主目录
sudo mkdir -p /opt/gov-platform/{api,web,uploads,logs}

# 创建上传子目录
sudo mkdir -p /opt/gov-platform/uploads/{banners,file-transfers,avatars,misc}

# 设置目录权限（替换 $USER 为实际运行用户）
sudo chown -R $USER:$USER /opt/gov-platform
```

### 复制 API 文件

```bash
# 复制整个 api 目录
cp -r /path/to/部署包/api/* /opt/gov-platform/api/

# 确认文件已复制
ls -la /opt/gov-platform/api/
```

应显示：
```
drwxr-xr-x  src/
drwxr-xr-x  node_modules/
-rw-r--r--  package.json
-rw-r--r--  .env.example
```

### 配置环境变量

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
# ========================================
# 数据库配置
# ========================================
DB_HOST=localhost
DB_PORT=3306
DB_USER=gov_admin
DB_PASSWORD=你设置的数据库密码    # ← 修改为实际密码
DB_NAME=gov_platform

# ========================================
# API 服务配置
# ========================================
API_PORT=3001
API_BASE_URL=http://192.168.1.100:3001    # ← 修改为服务器内网IP

# ========================================
# 文件上传配置
# ========================================
UPLOAD_DIR=/opt/gov-platform/uploads
MAX_FILE_SIZE=10485760

# ========================================
# 安全配置
# ========================================
JWT_SECRET=请修改为32位以上的随机字符串    # ← 修改为随机字符串
```

### 获取服务器内网 IP

```bash
# 方法1：使用 ip 命令
ip addr show | grep "inet " | grep -v 127.0.0.1

# 方法2：使用 hostname
hostname -I

# 记录显示的内网 IP 地址（如 192.168.1.100）
```

---

## 部署前端

### 复制前端文件

```bash
# 复制前端静态文件
cp -r /path/to/部署包/web/* /opt/gov-platform/web/

# 确认文件已复制
ls -la /opt/gov-platform/web/
```

应显示：
```
-rw-r--r--  index.html
drwxr-xr-x  assets/
-rw-r--r--  config.js
...
```

### 修改前端配置

```bash
vi /opt/gov-platform/web/config.js
```

修改内容：

```javascript
// 党政办公平台 - 前端运行时配置
// 此文件在部署时由运维人员修改，无需重新构建前端

window.GOV_PLATFORM_CONFIG = {
  // API 服务地址 - 修改为服务器实际内网 IP
  API_BASE_URL: 'http://192.168.1.100:3001',    // ← 修改为实际IP
  
  // 上传文件大小限制（字节），10MB = 10485760
  MAX_UPLOAD_SIZE: 10485760,
  
  // 系统名称（可自定义）
  SYSTEM_NAME: '党政办公平台'
};
```

---

## 配置 Nginx

### 复制 Nginx 配置文件

```bash
# 复制配置文件到 Nginx 配置目录
sudo cp /path/to/部署包/nginx/gov-platform.conf /etc/nginx/conf.d/
```

### 修改 Nginx 配置

```bash
sudo vi /etc/nginx/conf.d/gov-platform.conf
```

需要修改的内容（已标注）：

```nginx
server {
    listen 80;
    server_name 192.168.1.100;    # ← 修改为服务器内网 IP 或域名

    # 前端静态文件根目录
    root /opt/gov-platform/web;
    index index.html;

    # 日志配置
    access_log /var/log/nginx/gov-platform-access.log;
    error_log /var/log/nginx/gov-platform-error.log;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 文件上传大小限制
        client_max_body_size 20M;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 上传文件静态访问
    location /uploads/ {
        alias /opt/gov-platform/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # 前端路由支持（SPA 单页应用）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 测试并重载 Nginx

```bash
# 测试配置语法
sudo nginx -t

# 如果显示以下内容表示配置正确：
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# 重载配置
sudo systemctl reload nginx
```

### 常见 Nginx 配置问题

**问题1：权限不足**
```bash
# 确保 Nginx 用户可以访问前端目录
sudo chmod -R 755 /opt/gov-platform/web
sudo chmod -R 755 /opt/gov-platform/uploads
```

**问题2：SELinux 阻止访问**
```bash
# 如果启用了 SELinux，需要设置上下文
sudo chcon -R -t httpd_sys_content_t /opt/gov-platform/web
sudo chcon -R -t httpd_sys_rw_content_t /opt/gov-platform/uploads

# 或者允许 Nginx 网络连接
sudo setsebool -P httpd_can_network_connect 1
```

---

## 启动服务

### 方式一：直接启动（测试用）

```bash
cd /opt/gov-platform/api
node src/index.js
```

> 此方式适合测试，关闭终端后服务会停止。按 `Ctrl+C` 可停止服务。

### 方式二：使用 systemd 服务（推荐生产环境）

#### 创建服务文件

```bash
sudo vi /etc/systemd/system/gov-api.service
```

添加以下内容：

```ini
[Unit]
Description=党政办公平台 API 服务
Documentation=https://your-docs-url
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

# 安全加固
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/gov-platform

[Install]
WantedBy=multi-user.target
```

#### 启用并启动服务

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

#### 服务管理常用命令

```bash
# 启动服务
sudo systemctl start gov-api

# 停止服务
sudo systemctl stop gov-api

# 重启服务
sudo systemctl restart gov-api

# 查看状态
sudo systemctl status gov-api

# 查看日志
sudo journalctl -u gov-api -f
```

### 方式三：使用 PM2（可选）

如果部署包中包含 PM2：

```bash
# 全局安装 PM2（需要 npm）
sudo npm install -g pm2

cd /opt/gov-platform/api

# 启动服务
pm2 start src/index.js --name "gov-api"

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
# 按照提示执行显示的命令
```

PM2 常用命令：
```bash
pm2 status          # 查看状态
pm2 logs gov-api    # 查看日志
pm2 restart gov-api # 重启
pm2 stop gov-api    # 停止
```

---

## 验证部署

### 检查 API 服务

```bash
# 测试 API 健康检查接口
curl http://localhost:3001/api/health
```

正常响应：
```json
{"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

### 检查 Nginx

```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 测试通过 Nginx 访问 API
curl http://服务器IP/api/health
```

### 浏览器访问

在内网其他电脑上，打开浏览器访问：

```
http://服务器内网IP/
```

应显示系统登录页面。

### 测试登录

默认测试账户（如果执行了完整的初始化脚本）：
- 用户名（手机号）：`13800000001`
- 密码：`123456`

> **重要**：首次登录后请立即修改密码！

---

## 日常运维

### 日志位置

| 日志类型 | 位置 |
|---------|------|
| API 服务日志 | `/opt/gov-platform/logs/api.log` |
| API 错误日志 | `/opt/gov-platform/logs/api-error.log` |
| Nginx 访问日志 | `/var/log/nginx/gov-platform-access.log` |
| Nginx 错误日志 | `/var/log/nginx/gov-platform-error.log` |
| MariaDB 日志 | `/var/log/mariadb/mariadb.log` |

### 查看日志

```bash
# 实时查看 API 日志
tail -f /opt/gov-platform/logs/api.log

# 查看最近的错误
tail -100 /opt/gov-platform/logs/api-error.log

# 查看 Nginx 错误日志
tail -100 /var/log/nginx/gov-platform-error.log
```

### 服务管理

```bash
# 重启所有服务
sudo systemctl restart gov-api nginx mariadb

# 查看所有服务状态
sudo systemctl status gov-api nginx mariadb
```

### 数据库备份

```bash
# 备份数据库
mysqldump -u gov_admin -p gov_platform > /backup/gov_platform_$(date +%Y%m%d).sql

# 恢复数据库
mysql -u gov_admin -p gov_platform < /backup/gov_platform_20240115.sql
```

### 定时备份（可选）

```bash
# 创建备份脚本
sudo vi /opt/gov-platform/scripts/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u gov_admin -p'你的密码' gov_platform > $BACKUP_DIR/db_$DATE.sql

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/gov-platform/uploads

# 保留最近 7 天的备份
find $BACKUP_DIR -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# 添加定时任务（每天凌晨 2 点执行）
sudo crontab -e
# 添加以下行：
0 2 * * * /opt/gov-platform/scripts/backup.sh >> /opt/gov-platform/logs/backup.log 2>&1
```

---

## 故障排查

### 问题1：Node.js 命令找不到

**症状**：执行 `node -v` 提示 `command not found`

**解决方案**：
```bash
# 检查 Node.js 是否已解压
ls /usr/local/bin/node

# 如果文件存在，添加环境变量
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 验证
node -v
```

### 问题2：MariaDB 无法启动

**症状**：`systemctl start mariadb` 失败

**解决方案**：
```bash
# 查看详细错误
sudo journalctl -u mariadb -n 50

# 常见原因1：端口被占用
sudo netstat -tlnp | grep 3306

# 常见原因2：数据目录权限问题
sudo chown -R mysql:mysql /var/lib/mysql
sudo systemctl start mariadb
```

### 问题3：API 服务无法启动

**症状**：服务启动后立即停止

**解决方案**：
```bash
# 手动运行查看错误信息
cd /opt/gov-platform/api
node src/index.js

# 常见错误1：端口被占用
netstat -tlnp | grep 3001

# 常见错误2：数据库连接失败 - 检查 .env 配置
cat /opt/gov-platform/api/.env

# 测试数据库连接
mysql -u gov_admin -p gov_platform -e "SELECT 1"
```

### 问题4：Nginx 502 Bad Gateway

**症状**：浏览器访问显示 502 错误

**解决方案**：
```bash
# 检查 API 服务是否运行
curl http://localhost:3001/api/health

# 如果 API 没有运行，启动它
sudo systemctl start gov-api

# 检查 Nginx 错误日志
tail -50 /var/log/nginx/gov-platform-error.log

# SELinux 问题（麒麟系统可能启用）
sudo setsebool -P httpd_can_network_connect 1
```

### 问题5：页面显示空白

**症状**：浏览器访问显示白屏

**解决方案**：
```bash
# 检查前端文件是否存在
ls -la /opt/gov-platform/web/

# 检查 index.html 是否存在
cat /opt/gov-platform/web/index.html | head -20

# 检查文件权限
sudo chmod -R 755 /opt/gov-platform/web/

# 检查 Nginx 配置中的 root 路径
grep "root" /etc/nginx/conf.d/gov-platform.conf
```

### 问题6：文件上传失败

**症状**：上传文件时报错

**解决方案**：
```bash
# 检查上传目录权限
ls -la /opt/gov-platform/uploads/

# 修复权限
sudo chown -R $USER:$USER /opt/gov-platform/uploads/
sudo chmod -R 755 /opt/gov-platform/uploads/

# 检查 Nginx 上传限制
grep "client_max_body_size" /etc/nginx/conf.d/gov-platform.conf
# 如果没有或太小，添加/修改为：client_max_body_size 20M;
```

### 问题7：防火墙阻止访问

**症状**：本地能访问，其他机器不能访问

**解决方案**：
```bash
# 检查防火墙状态
sudo firewall-cmd --state

# 开放 80 端口
sudo firewall-cmd --permanent --add-port=80/tcp

# 开放 3001 端口（如果需要直接访问 API）
sudo firewall-cmd --permanent --add-port=3001/tcp

# 重载防火墙
sudo firewall-cmd --reload

# 查看已开放端口
sudo firewall-cmd --list-ports
```

---

## 附录

### 附录A：快速检查清单

部署完成后，按以下清单逐项检查：

- [ ] Node.js 已安装：`node -v` 显示版本
- [ ] MariaDB 已运行：`systemctl status mariadb` 显示 active
- [ ] 数据库已初始化：`mysql -u gov_admin -p gov_platform -e "SHOW TABLES;"` 显示表列表
- [ ] Nginx 已运行：`systemctl status nginx` 显示 active
- [ ] API 服务已运行：`curl http://localhost:3001/api/health` 返回 ok
- [ ] 前端可访问：浏览器打开 `http://服务器IP/` 显示登录页
- [ ] 可以正常登录：使用测试账户登录成功

### 附录B：API 接口列表

#### 认证接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/auth/change-password` | POST | 修改密码 |

#### 基础数据接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/organizations` | GET | 获取组织架构 |
| `/api/contacts` | GET | 获取通讯录 |
| `/api/contacts/:id` | GET | 获取联系人详情 |
| `/api/notices` | GET | 获取公告列表 |
| `/api/banners` | GET | 获取轮播图 |
| `/api/canteen-menus` | GET | 获取食堂菜单 |

#### 业务接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/absence-records` | GET/POST | 请假/外出/出差记录 |
| `/api/absence-records/:id` | GET/PUT/DELETE | 记录详情操作 |
| `/api/todo-items` | GET | 获取待办事项 |
| `/api/leader-schedules` | GET | 获取领导日程 |
| `/api/file-transfers` | GET/POST | 公文收发 |

#### 文件上传接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/upload/banners` | POST | 上传轮播图 |
| `/api/upload/file-transfers` | POST | 上传公文附件 |
| `/api/upload/avatars` | POST | 上传头像 |
| `/api/upload/misc` | POST | 上传其他文件 |

### 附录C：目录结构说明

```
/opt/gov-platform/
├── api/                    # API 服务
│   ├── src/
│   │   └── index.js       # 主程序入口
│   ├── node_modules/      # 依赖包
│   ├── package.json       # 项目配置
│   └── .env               # 环境变量（包含敏感信息）
├── web/                    # 前端文件
│   ├── index.html         # 入口页面
│   ├── assets/            # 静态资源
│   └── config.js          # 运行时配置
├── uploads/                # 上传文件存储
│   ├── banners/           # 轮播图
│   ├── file-transfers/    # 公文附件
│   ├── avatars/           # 用户头像
│   └── misc/              # 其他文件
└── logs/                   # 日志文件
    ├── api.log            # API 运行日志
    └── api-error.log      # API 错误日志
```

### 附录D：配置文件说明

#### .env 配置项

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| DB_HOST | 数据库地址 | localhost |
| DB_PORT | 数据库端口 | 3306 |
| DB_USER | 数据库用户 | gov_admin |
| DB_PASSWORD | 数据库密码 | ******** |
| DB_NAME | 数据库名 | gov_platform |
| API_PORT | API 端口 | 3001 |
| UPLOAD_DIR | 上传目录 | /opt/gov-platform/uploads |
| JWT_SECRET | JWT 密钥 | 随机字符串 |

#### config.js 配置项

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| API_BASE_URL | API 地址 | http://192.168.1.100:3001 |
| MAX_UPLOAD_SIZE | 上传限制(字节) | 10485760 |
| SYSTEM_NAME | 系统名称 | 党政办公平台 |

---

## 技术支持

如遇到本文档无法解决的问题，请联系开发团队并提供以下信息：

1. **问题描述**：详细说明遇到的问题
2. **错误信息**：相关日志截图或文本
3. **操作步骤**：导致问题的操作过程
4. **环境信息**：执行 `uname -a` 的输出

---

**文档版本**：v2.0  
**更新日期**：2024年1月  
**适用环境**：麒麟 V10 SP1 / 鲲鹏 920
