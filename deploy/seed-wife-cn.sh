#!/bin/bash
# 重置 owner='wife' 的全部资产，从 deploy/seed-wife-cn.json 重导
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_PATH="${VIBECODING_ACTIVE_BACKUP_PATH:-}"
if [ "${SKIP_REAL_DATA_BACKUP:-0}" != "1" ]; then
  BACKUP_OUTPUT="$("$SCRIPT_DIR/../scripts/backup-real-data.sh" "before-seed-wife-cn")"
  echo "$BACKUP_OUTPUT"
  BACKUP_PATH="$(printf '%s\n' "$BACKUP_OUTPUT" | sed -n 's/^备份已创建：//p')"
fi
DATA_FILE="$SCRIPT_DIR/seed-wife-cn.json"
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
echo "=== 2. 删除现有 owner=wife 资产 ==="
EXISTING=$(curl -s -b "$COOKIE_FILE" "$API_BASE/api/assets?owner=wife")
if [ -n "$BACKUP_PATH" ]; then
  printf '%s\n' "$EXISTING" > "$BACKUP_PATH/remote-assets-before-seed-wife-cn.json"
  "$SCRIPT_DIR/../scripts/update-backup-checksums.sh" "$BACKUP_PATH"
fi
WIFE_IDS=$(echo "$EXISTING" | python3 -c "
import sys, json
assets = json.load(sys.stdin)
for a in assets:
    print(a['id'])
")
WIFE_COUNT=$(echo "$WIFE_IDS" | grep -c . || true)
echo "找到 $WIFE_COUNT 条 owner=wife 资产，开始删除..."
for ID in $WIFE_IDS; do
  curl -s -b "$COOKIE_FILE" -X DELETE "$API_BASE/api/assets/$ID" > /dev/null
done
echo "已删除 $WIFE_COUNT 条"

echo ""
echo "=== 3. 导入老婆的资产 ==="
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
echo "=== 完成，共导入 $TOTAL 条 ==="
