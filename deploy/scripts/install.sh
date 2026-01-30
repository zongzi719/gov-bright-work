#!/bin/bash
# 党政办公平台 - 一键安装脚本
# 适用于麒麟V10 ARM64环境

set -e

echo "=========================================="
echo "  党政办公平台 - 离线部署安装脚本"
echo "=========================================="

# 配置变量
INSTALL_DIR="/opt/gov-platform"
NODE_VERSION="18.20.4"

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
  echo "请使用root用户运行此脚本"
  exit 1
fi

# 创建目录结构
echo "[1/6] 创建目录结构..."
mkdir -p $INSTALL_DIR/{api,web,uploads,logs}
mkdir -p $INSTALL_DIR/uploads/{banners,file-transfers,misc}

# 检查Node.js
echo "[2/6] 检查Node.js..."
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  echo "Node.js已安装: $NODE_VER"
else
  echo "Node.js未安装，请先安装Node.js ARM64版本"
  echo ""
  echo "安装步骤："
  echo "1. 下载: https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz"
  echo "2. 解压: tar -xf node-v${NODE_VERSION}-linux-arm64.tar.xz"
  echo "3. 安装: cp -r node-v${NODE_VERSION}-linux-arm64/* /usr/local/"
  echo "4. 验证: node -v"
  exit 1
fi

# 检查MariaDB
echo "[3/6] 检查MariaDB..."
if command -v mysql &> /dev/null; then
  MYSQL_VER=$(mysql --version)
  echo "MariaDB已安装: $MYSQL_VER"
else
  echo "MariaDB未安装，请先安装MariaDB"
  exit 1
fi

# 复制文件
echo "[4/6] 复制应用文件..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

cp -r $DEPLOY_DIR/api/* $INSTALL_DIR/api/
cp -r $DEPLOY_DIR/web/* $INSTALL_DIR/web/ 2>/dev/null || echo "前端文件稍后手动复制"

# 安装依赖
echo "[5/6] 安装Node.js依赖..."
cd $INSTALL_DIR/api
if [ -f "package.json" ]; then
  npm install --production
fi

# 配置环境变量
echo "[6/6] 配置环境变量..."
if [ ! -f "$INSTALL_DIR/api/.env" ]; then
  cp $INSTALL_DIR/api/.env.example $INSTALL_DIR/api/.env
  echo "请编辑 $INSTALL_DIR/api/.env 配置数据库连接"
fi

echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "后续步骤："
echo "1. 初始化数据库:"
echo "   mysql -u root -p < $DEPLOY_DIR/database/init.sql"
echo ""
echo "2. 编辑配置文件:"
echo "   vi $INSTALL_DIR/api/.env"
echo ""
echo "3. 启动API服务:"
echo "   cd $INSTALL_DIR/api && node src/index.js"
echo "   或使用PM2: pm2 start src/index.js --name gov-api"
echo ""
echo "4. 配置Nginx:"
echo "   cp $DEPLOY_DIR/nginx/gov-platform.conf /etc/nginx/conf.d/"
echo "   nginx -t && systemctl reload nginx"
echo ""
echo "5. 构建前端并复制到 $INSTALL_DIR/web/"
echo ""
