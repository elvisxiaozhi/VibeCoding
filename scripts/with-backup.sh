#!/bin/bash
# Run a command only after creating a real-data backup.
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "用法：$0 <backup-label> <command> [args...]"
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="$1"
shift

BACKUP_OUTPUT="$("$ROOT_DIR/scripts/backup-real-data.sh" "$LABEL")"
echo "$BACKUP_OUTPUT"
BACKUP_PATH="$(printf '%s\n' "$BACKUP_OUTPUT" | sed -n 's/^备份已创建：//p')"

VIBECODING_ACTIVE_BACKUP_PATH="$BACKUP_PATH" SKIP_REAL_DATA_BACKUP=1 "$@"
