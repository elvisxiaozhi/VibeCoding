#!/bin/bash
# Create a timestamped backup of local real data before any data-changing action.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_ROOT="${VIBECODING_BACKUP_DIR:-$HOME/Desktop/VibeCoding-backups}"
LABEL="${1:-before-change}"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -c 'A-Za-z0-9._-' '-')"
STAMP="$(date '+%Y-%m-%d_%H%M%S')"
DEST="$BACKUP_ROOT/${STAMP}_${SAFE_LABEL}"

mkdir -p "$DEST"

if [ -f "$ROOT_DIR/server/data.db" ]; then
  cp -p "$ROOT_DIR/server/data.db" "$DEST/data.db"
fi

PATHS=(
  "deploy"
  "public/cleared-assets.json"
  "scripts/process-mywife-cny.py"
  "scripts/generate-tlt-report.mjs"
  "scripts/process-vbrokers-tlt.mjs"
)

EXISTING_PATHS=()
for path in "${PATHS[@]}"; do
  if [ -e "$ROOT_DIR/$path" ]; then
    EXISTING_PATHS+=("$path")
  fi
done

if [ "${#EXISTING_PATHS[@]}" -gt 0 ]; then
  tar -czf "$DEST/real-data-files.tar.gz" -C "$ROOT_DIR" "${EXISTING_PATHS[@]}"
fi

{
  echo "created_at=$(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "project_root=$ROOT_DIR"
  echo "backup_label=$LABEL"
  echo "backup_path=$DEST"
  echo ""
  echo "included_paths:"
  for path in "${EXISTING_PATHS[@]}"; do
    echo "$path"
  done
  if [ -f "$ROOT_DIR/server/data.db" ]; then
    echo "server/data.db"
  fi
} > "$DEST/manifest.txt"

"$ROOT_DIR/scripts/update-backup-checksums.sh" "$DEST"

echo "备份已创建：$DEST"
