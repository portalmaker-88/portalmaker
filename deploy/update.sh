#!/usr/bin/env bash
# 서버에서 실행: GitHub의 최신 내용을 받아 사이트에 반영합니다 (사이트를 고칠 때마다)
# 사용법:  bash ~/portalmaker/deploy/update.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
SITE_DIR=/var/www/website

echo "==> GitHub에서 최신 내용 받기"
git -C "$REPO" pull --ff-only

echo "==> 사이트 파일 반영: $SITE_DIR"
if command -v rsync >/dev/null; then
  rsync -a --delete --exclude '.gitkeep' "$REPO/website/" "$SITE_DIR/"
else
  rm -rf "${SITE_DIR:?}"/*
  cp -r "$REPO/website/." "$SITE_DIR/"
fi
echo "업데이트 완료"
