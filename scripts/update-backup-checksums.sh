#!/bin/bash
# Refresh SHA256SUMS.txt for files in one backup directory.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "用法：$0 <backup-dir>"
  exit 2
fi

BACKUP_DIR="$1"

(
  cd "$BACKUP_DIR"
  find . -maxdepth 1 -type f ! -name SHA256SUMS.txt -print0 \
    | sort -z \
    | xargs -0 shasum -a 256 > SHA256SUMS.txt
)
