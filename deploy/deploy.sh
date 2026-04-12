#!/bin/bash
# 本地执行：构建 + 上传 + 重启
set -e

echo "=== 1. 构建前端 ==="
npm run build

echo "=== 2. 交叉编译 Go 后端 ==="
cd server
GOOS=linux GOARCH=amd64 GOPROXY=https://proxy.golang.org,direct go build -o asset-dashboard .
cd ..

echo "=== 3. 上传文件到服务器 ==="
scp -r dist/ vps:/opt/asset-dashboard/
scp server/asset-dashboard vps:/opt/asset-dashboard/
scp deploy/nginx.conf deploy/asset-dashboard.service deploy/setup-server.sh vps:/opt/asset-dashboard/deploy/

echo "=== 4. 设置权限并重启服务 ==="
ssh vps "chown -R www-data:www-data /opt/asset-dashboard && systemctl restart asset-dashboard"

echo ""
echo "=== 部署完成 ==="
