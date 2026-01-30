#!/bin/bash
# 启动API服务

cd /opt/gov-platform/api

# 检查PM2是否安装
if command -v pm2 &> /dev/null; then
  pm2 start src/index.js --name gov-api --watch
  pm2 save
  echo "API服务已通过PM2启动"
  pm2 status
else
  # 直接启动
  nohup node src/index.js > /opt/gov-platform/logs/api.log 2>&1 &
  echo "API服务已启动，PID: $!"
  echo "日志文件: /opt/gov-platform/logs/api.log"
fi
