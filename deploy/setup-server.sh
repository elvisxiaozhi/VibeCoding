#!/bin/bash
# 服务器端初始化脚本（只需运行一次）
set -e

echo "=== 1. 安装 Nginx ==="
apt update && apt install -y nginx

echo "=== 2. 创建部署目录 ==="
mkdir -p /opt/asset-dashboard/dist

echo "=== 3. 复制 Nginx 配置 ==="
cp /opt/asset-dashboard/deploy/nginx.conf /etc/nginx/sites-available/asset-dashboard
ln -sf /etc/nginx/sites-available/asset-dashboard /etc/nginx/sites-enabled/asset-dashboard
rm -f /etc/nginx/sites-enabled/default

echo "=== 4. 测试 Nginx 配置 ==="
nginx -t

echo "=== 5. 复制 systemd 服务文件 ==="
cp /opt/asset-dashboard/deploy/asset-dashboard.service /etc/systemd/system/
systemctl daemon-reload

echo "=== 6. 设置目录权限 ==="
chown -R www-data:www-data /opt/asset-dashboard

echo "=== 7. 启动服务 ==="
systemctl enable --now asset-dashboard
systemctl restart nginx

echo ""
echo "=== 部署完成 ==="
echo "访问 http://$(curl -s ifconfig.me) 查看效果"
