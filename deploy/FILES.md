# 部署包文件清单

> 本文档列出部署包中所有文件及其用途说明

## 📁 目录结构概览

```
deploy/
├── api/                    # 后端 API 服务
│   ├── src/
│   │   └── index.js        # API 主程序入口
│   ├── .env.example        # 环境变量配置模板
│   └── package.json        # Node.js 依赖配置
├── database/               # 数据库相关
│   └── init.sql            # 数据库初始化脚本
├── nginx/                  # Web 服务器配置
│   └── gov-platform.conf   # Nginx 配置文件
├── scripts/                # 自动化脚本
│   ├── install.sh          # 一键安装脚本
│   └── start-api.sh        # API 启动脚本
├── web/                    # 前端配置
│   └── config.js           # 前端运行时配置
├── README.md               # 部署手册（详细）
└── FILES.md                # 本文件清单
```

---

## 📄 文件详细说明

### 根目录

| 文件 | 说明 | 是否需要修改 |
|------|------|:------------:|
| `README.md` | 完整的部署手册，包含安装步骤和故障排查 | ❌ 只读 |
| `FILES.md` | 本文件，部署包文件清单 | ❌ 只读 |

---

### 📂 api/ - 后端 API 服务

| 文件路径 | 说明 | 是否需要修改 |
|----------|------|:------------:|
| `api/src/index.js` | Express.js API 服务主程序，包含所有接口实现 | ❌ 一般不需要 |
| `api/.env.example` | 环境变量配置模板 | ⚠️ 复制为 `.env` 后修改 |
| `api/package.json` | Node.js 项目配置，定义依赖包 | ❌ 只读 |

#### .env.example 配置项说明

```bash
# 数据库配置
DB_HOST=localhost       # 数据库地址
DB_PORT=3306           # 数据库端口
DB_USER=root           # 数据库用户名
DB_PASSWORD=           # ⚠️ 必须修改：数据库密码
DB_NAME=gov_platform   # 数据库名

# API 配置
API_PORT=3001          # API 服务端口
API_BASE_URL=          # ⚠️ 必须修改：API 访问地址
```

---

### 📂 database/ - 数据库脚本

| 文件路径 | 说明 | 是否需要修改 |
|----------|------|:------------:|
| `database/init.sql` | 数据库初始化脚本，创建所有表结构和初始数据 | ❌ 只读 |

#### 使用方法

```bash
mysql -u root -p < database/init.sql
```

---

### 📂 nginx/ - Web 服务器配置

| 文件路径 | 说明 | 是否需要修改 |
|----------|------|:------------:|
| `nginx/gov-platform.conf` | Nginx 站点配置文件 | ⚠️ 可选：修改域名/IP |

#### 配置说明

- 监听 80 端口
- 静态文件服务：`/opt/gov-platform/web/`
- API 代理：`/api/` → `http://127.0.0.1:3001`
- 上传文件：`/uploads/` → `/opt/gov-platform/uploads/`

---

### 📂 scripts/ - 自动化脚本

| 文件路径 | 说明 | 是否需要修改 |
|----------|------|:------------:|
| `scripts/install.sh` | 一键安装脚本，自动创建目录结构并安装依赖 | ❌ 只读 |
| `scripts/start-api.sh` | API 服务启动脚本，支持 PM2 或后台运行 | ❌ 只读 |

#### 使用方法

```bash
# 给脚本执行权限
chmod +x scripts/*.sh

# 运行安装
sudo ./scripts/install.sh

# 启动 API
./scripts/start-api.sh
```

---

### 📂 web/ - 前端配置

| 文件路径 | 说明 | 是否需要修改 |
|----------|------|:------------:|
| `web/config.js` | 前端运行时配置，设置 API 地址（启用离线模式） | ✅ 必须修改 |
| `web/index.html` | 离线部署专用的 index.html 模板 | ⚠️ 可选参考 |

#### config.js 配置项说明

```javascript
window.GOV_CONFIG = {
  // API服务地址 - ⚠️ 必须修改为实际服务器IP
  API_BASE_URL: 'http://192.168.1.100:3001',
  
  // 应用名称 - 可选修改
  APP_NAME: 'xx州党政办公平台',
  
  // 版本号
  VERSION: '1.0.0',
  
  // 离线模式标识（此配置存在即表示启用离线模式）
  OFFLINE_MODE: true
};
```

#### 离线模式说明

当 `window.GOV_CONFIG` 存在时，前端会自动切换到离线模式：
- 登录验证使用本地 API（`/api/auth/login`）
- 数据查询使用本地 API（如 `/api/notices`、`/api/contacts` 等）
- 不再尝试连接 Supabase 云服务

---

## 🔧 部署后的目录结构

安装完成后，服务器上的目录结构：

```
/opt/gov-platform/
├── api/                    # 后端代码
│   ├── src/index.js
│   ├── node_modules/       # 依赖包（自动安装）
│   ├── .env                # 环境配置（从模板复制）
│   └── package.json
├── web/                    # 前端静态文件
│   ├── index.html
│   ├── assets/             # JS/CSS 资源
│   └── config.js           # 运行时配置
├── uploads/                # 上传文件存储
│   ├── banners/
│   ├── file-transfers/
│   └── misc/
└── logs/                   # 日志目录
    └── api.log
```

---

## ⚠️ 必须修改的文件

| 文件 | 修改项 | 说明 |
|------|--------|------|
| `/opt/gov-platform/api/.env` | `DB_PASSWORD` | 数据库密码 |
| `/opt/gov-platform/api/.env` | `API_BASE_URL` | API 访问地址 |
| `/opt/gov-platform/web/config.js` | `API_BASE_URL` | 前端调用的 API 地址 |

---

## 📋 快速检查清单

部署完成后，请确认以下事项：

- [ ] 数据库已初始化（`init.sql` 已执行）
- [ ] `.env` 文件已创建并配置正确
- [ ] `config.js` 中的 API 地址已修改
- [ ] Nginx 配置已复制并重载
- [ ] API 服务已启动（端口 3001）
- [ ] 可以访问 `http://服务器IP/api/health` 返回 `{"status":"ok"}`
