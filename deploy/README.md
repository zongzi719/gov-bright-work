# 党政办公平台 - 离线部署指南

## 环境要求

- **操作系统**: 麒麟V10 SP1 (aarch64/ARM64)
- **处理器**: 鲲鹏920
- **数据库**: MariaDB 10.3+
- **运行时**: Node.js 18.x (ARM64)
- **Web服务器**: Nginx

## 目录结构

```
deploy/
├── api/                    # Node.js后端API
│   ├── src/
│   │   └── index.js       # API主入口
│   ├── package.json       # 依赖配置
│   └── .env.example       # 环境变量模板
├── database/
│   └── init.sql           # 数据库初始化脚本
├── nginx/
│   └── gov-platform.conf  # Nginx配置
├── web/
│   └── config.js          # 前端配置
├── scripts/
│   ├── install.sh         # 安装脚本
│   └── start-api.sh       # 启动脚本
└── README.md              # 本文档
```

## 部署步骤

### 1. 安装Node.js (ARM64)

```bash
# 从离线包安装
tar -xf node-v18.20.4-linux-arm64.tar.xz
cp -r node-v18.20.4-linux-arm64/* /usr/local/

# 验证安装
node -v  # 应显示 v18.20.4
npm -v
```

### 2. 初始化数据库

```bash
# 登录MariaDB
mysql -u root -p

# 创建数据库
CREATE DATABASE gov_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 退出后执行初始化脚本
mysql -u root -p gov_platform < deploy/database/init.sql
```

### 3. 配置API服务

```bash
# 复制文件到部署目录
mkdir -p /opt/gov-platform
cp -r deploy/api /opt/gov-platform/

# 安装依赖(离线环境需提前准备node_modules)
cd /opt/gov-platform/api
npm install --production

# 配置环境变量
cp .env.example .env
vi .env
```

**.env配置示例:**
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=gov_platform
API_PORT=3001
API_BASE_URL=http://192.168.1.100:3001
```

### 4. 启动API服务

```bash
# 方式一: 直接启动
cd /opt/gov-platform/api
node src/index.js

# 方式二: 使用PM2(推荐)
npm install -g pm2
pm2 start src/index.js --name gov-api
pm2 startup
pm2 save
```

### 5. 构建前端

在开发机器上:
```bash
# 修改前端配置指向本地API
npm run build
```

将`dist/`目录内容复制到服务器:
```bash
cp -r dist/* /opt/gov-platform/web/
```

### 6. 配置Nginx

```bash
# 复制配置文件
cp deploy/nginx/gov-platform.conf /etc/nginx/conf.d/

# 修改配置中的服务器IP
vi /etc/nginx/conf.d/gov-platform.conf

# 测试并重载
nginx -t
systemctl reload nginx
```

### 7. 创建上传目录

```bash
mkdir -p /opt/gov-platform/uploads/{banners,file-transfers,misc}
chown -R nginx:nginx /opt/gov-platform/uploads
chmod -R 755 /opt/gov-platform/uploads
```

## API接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/change-password` | POST | 修改密码 |
| `/api/upload/:type` | POST | 文件上传 |
| `/api/organizations` | GET | 组织架构 |
| `/api/contacts` | GET | 通讯录列表 |
| `/api/notices` | GET | 公告列表 |
| `/api/banners` | GET/POST | 导航背景 |
| `/api/canteen-menus` | GET | 食堂菜单 |
| `/api/todo-items` | GET | 待办事项 |
| `/api/absence-records` | GET/POST | 请假记录 |
| `/api/file-transfers` | GET/POST | 文件收发 |

## 前端适配

前端需要创建一个API适配层替换Supabase调用。参考`src/lib/api-client.ts`。

## 故障排查

### API无法启动
```bash
# 检查端口占用
netstat -tlnp | grep 3001

# 检查日志
tail -f /opt/gov-platform/logs/api.log
```

### 数据库连接失败
```bash
# 测试连接
mysql -u root -p -h localhost gov_platform -e "SELECT 1"
```

### Nginx 502错误
```bash
# 检查API是否运行
curl http://localhost:3001/api/health

# 检查Nginx错误日志
tail -f /var/log/nginx/error.log
```

## 默认账户

初始化后，通讯录中的用户默认密码为: `123456`

首次登录后请修改密码。
