#!/usr/bin/env bash
# 서버에서 실행: GitHub의 최신 내용을 받아 사이트에 반영합니다 (사이트를 고칠 때마다)
# 사용법:  bash ~/portalmaker/deploy/update.sh
set -euo pipefail

# 전체를 { } 로 감싸 두면 git pull 이 이 파일을 바꿔도 실행 중인 스크립트가 꼬이지 않습니다
{
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

# CSS·JS 주소 끝의 ?v=dev 를 커밋 번호로 바꿔, 브라우저·Cloudflare가 예전 파일을 쓰지 않게 함
VERSION="$(git -C "$REPO" rev-parse --short HEAD)"
find "$SITE_DIR" -name '*.html' -exec sed -i "s/?v=dev/?v=$VERSION/g" {} +
echo "업데이트 완료 (버전 $VERSION)"
exit
}
