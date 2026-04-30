#!/bin/bash
# 仅追加录入 seed-misc.json 中的资产，不删除任何现有数据
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_PATH="${VIBECODING_ACTIVE_BACKUP_PATH:-}"
if [ "${SKIP_REAL_DATA_BACKUP:-0}" != "1" ]; then
  BACKUP_OUTPUT="$("$SCRIPT_DIR/../scripts/backup-real-data.sh" "before-seed-misc")"
  echo "$BACKUP_OUTPUT"
  BACKUP_PATH="$(printf '%s\n' "$BACKUP_OUTPUT" | sed -n 's/^备份已创建：//p')"
fi
DATA_FILE="$SCRIPT_DIR/seed-misc.json"
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
echo "=== 2. 导入杂项资产（仅追加，不删除现有） ==="
if [ -n "$BACKUP_PATH" ]; then
  EXISTING=$(curl -s -b "$COOKIE_FILE" "$API_BASE/api/assets")
  printf '%s\n' "$EXISTING" > "$BACKUP_PATH/remote-assets-before-seed-misc.json"
  "$SCRIPT_DIR/../scripts/update-backup-checksums.sh" "$BACKUP_PATH"
fi
TOTAL=$(python3 -c "import json; print(len(json.load(open('$DATA_FILE'))))")
FAIL=0
python3 -c "
import json
for a in json.load(open('$DATA_FILE')):
    print(json.dumps(a, ensure_ascii=False))
" | while read -r LINE; do
  SYMBOL=$(echo "$LINE" | python3 -c "import sys,json; print(json.load(sys.stdin)['symbol'])" 2>/dev/null || echo "?")
  RESP=$(curl -s -b "$COOKIE_FILE" -X POST "$API_BASE/api/assets" \
    -H "Content-Type: application/json" \
    -d "$LINE")
  if echo "$RESP" | grep -q '"error"'; then
    echo "  失败 $SYMBOL: $RESP"
  else
    echo "  OK  $SYMBOL"
  fi
done

rm -f "$COOKIE_FILE"
echo ""
echo "=== 完成，共处理 $TOTAL 条 ==="
