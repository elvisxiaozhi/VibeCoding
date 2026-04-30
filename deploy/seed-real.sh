#!/bin/bash
# 从 deploy/seed-real.json 批量导入真实资产到服务器
# 用法：bash deploy/seed-real.sh [--clear]
#   --clear  导入前先删除服务器上已有的全部资产
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_PATH="${VIBECODING_ACTIVE_BACKUP_PATH:-}"
if [ "${SKIP_REAL_DATA_BACKUP:-0}" != "1" ]; then
  BACKUP_OUTPUT="$("$SCRIPT_DIR/../scripts/backup-real-data.sh" "before-seed-real")"
  echo "$BACKUP_OUTPUT"
  BACKUP_PATH="$(printf '%s\n' "$BACKUP_OUTPUT" | sed -n 's/^备份已创建：//p')"
fi
DATA_FILE="$SCRIPT_DIR/seed-real.json"
API_BASE="http://62.234.19.227"

if [ ! -f "$DATA_FILE" ]; then
  echo "错误：找不到 $DATA_FILE"
  echo "请先编辑 deploy/seed-real.json 填入你的真实资产数据"
  exit 1
fi

# 登录获取 session cookie
echo "=== 1. 登录 ==="
COOKIE_FILE=$(mktemp)
LOGIN_RESP=$(curl -s -c "$COOKIE_FILE" -X POST "$API_BASE/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if echo "$LOGIN_RESP" | grep -q '"error"'; then
  echo "登录失败：$LOGIN_RESP"
  rm -f "$COOKIE_FILE"
  exit 1
fi
echo "登录成功"

EXISTING_BEFORE=""
if [ -n "$BACKUP_PATH" ]; then
  EXISTING_BEFORE=$(curl -s -b "$COOKIE_FILE" "$API_BASE/api/assets")
  printf '%s\n' "$EXISTING_BEFORE" > "$BACKUP_PATH/remote-assets-before-seed-real.json"
  "$SCRIPT_DIR/../scripts/update-backup-checksums.sh" "$BACKUP_PATH"
fi

# 可选：清空已有资产
if [ "$1" = "--clear" ]; then
  echo "=== 清空已有资产 ==="
  EXISTING="${EXISTING_BEFORE:-$(curl -s -b "$COOKIE_FILE" "$API_BASE/api/assets")}"
  IDS=$(echo "$EXISTING" | python3 -c "import sys,json; [print(a['id']) for a in json.load(sys.stdin)]" 2>/dev/null || true)
  COUNT=0
  for ID in $IDS; do
    curl -s -b "$COOKIE_FILE" -X DELETE "$API_BASE/api/assets/$ID" > /dev/null
    COUNT=$((COUNT + 1))
  done
  echo "已删除 $COUNT 条资产"
fi

# 逐条创建资产
echo "=== 2. 导入资产 ==="
TOTAL=$(python3 -c "import json; print(len(json.load(open('$DATA_FILE'))))")
INDEX=0

python3 -c "
import json, sys
for asset in json.load(open('$DATA_FILE')):
    print(json.dumps(asset))
" | while read -r LINE; do
  INDEX=$((INDEX + 1))
  SYMBOL=$(echo "$LINE" | python3 -c "import sys,json; print(json.load(sys.stdin)['symbol'])")
  RESP=$(curl -s -b "$COOKIE_FILE" -X POST "$API_BASE/api/assets" \
    -H "Content-Type: application/json" \
    -d "$LINE")

  if echo "$RESP" | grep -q '"error"'; then
    echo "  [$INDEX/$TOTAL] 失败 $SYMBOL: $RESP"
  else
    echo "  [$INDEX/$TOTAL] 成功 $SYMBOL"
  fi
done

rm -f "$COOKIE_FILE"
echo ""
echo "=== 导入完成 ==="
