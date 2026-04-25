#!/bin/bash
# 只重置 market='crypto' 的资产：从 deploy/seed-crypto.json 导入
# 用法：bash deploy/seed-crypto.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_FILE="$SCRIPT_DIR/seed-crypto.json"
API_BASE="http://62.234.19.227"

[ -f "$DATA_FILE" ] || { echo "错误：找不到 $DATA_FILE"; exit 1; }

echo "=== 1. 登录 ==="
COOKIE_FILE=$(mktemp)
LOGIN_RESP=$(curl -s -c "$COOKIE_FILE" -X POST "$API_BASE/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
if echo "$LOGIN_RESP" | grep -q '"error"'; then
  echo "登录失败：$LOGIN_RESP"; rm -f "$COOKIE_FILE"; exit 1
fi
echo "登录成功"

echo ""
echo "=== 2. 删除现有 market=crypto 资产 ==="
EXISTING=$(curl -s -b "$COOKIE_FILE" "$API_BASE/api/assets")
CRYPTO_IDS=$(echo "$EXISTING" | python3 -c "
import sys, json
for a in json.load(sys.stdin):
    if a.get('market') == 'crypto':
        print(a['id'])
")
CRYPTO_COUNT=$(echo "$CRYPTO_IDS" | grep -c . || true)
echo "找到 $CRYPTO_COUNT 条 market=crypto 资产，开始删除..."
for ID in $CRYPTO_IDS; do
  curl -s -b "$COOKIE_FILE" -X DELETE "$API_BASE/api/assets/$ID" > /dev/null
done
echo "已删除 $CRYPTO_COUNT 条"

echo ""
echo "=== 3. 导入新 Crypto 数据 ==="
TOTAL=$(python3 -c "import json; print(len(json.load(open('$DATA_FILE'))))")

python3 -c "
import json
for asset in json.load(open('$DATA_FILE')):
    print(json.dumps(asset))
" | while read -r LINE; do
  RESP=$(curl -s -b "$COOKIE_FILE" -X POST "$API_BASE/api/assets" \
    -H "Content-Type: application/json" \
    -d "$LINE")
  if echo "$RESP" | grep -q '"error"'; then
    SYMBOL=$(echo "$LINE" | python3 -c "import sys,json; print(json.load(sys.stdin)['symbol'])")
    echo "  失败 $SYMBOL: $RESP"
  fi
done

rm -f "$COOKIE_FILE"
echo ""
echo "=== 完成 ==="
