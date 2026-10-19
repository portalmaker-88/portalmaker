#!/usr/bin/env bash
# 우분투 서버에서 한 번 실행: Nginx 설치 + 사이트 설정 + (도메인이 있으면) HTTPS
# 사용법:
#   sudo bash setup-server.sh                      # 도메인 없이 IP로 접속
#   sudo bash setup-server.sh example.com you@mail  # 도메인 + Let's Encrypt HTTPS
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
SITE_DIR=/var/www/website
CONF=/etc/nginx/sites-available/website
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "sudo 로 실행해 주세요: sudo bash $0 $*" >&2
  exit 1
fi

echo "==> Nginx 설치"
apt-get update -y
apt-get install -y nginx

echo "==> 사이트 폴더 준비: $SITE_DIR"
mkdir -p "$SITE_DIR"
# 업로드한 사용자(sudo 를 부른 계정)가 sudo 없이 파일을 올릴 수 있게
OWNER="${SUDO_USER:-root}"
chown -R "$OWNER":www-data "$SITE_DIR"
chmod -R 755 "$SITE_DIR"

# 웹사이트 파일이 이 스크립트 옆(../website)에 같이 올라와 있으면 복사
if [ -f "$HERE/../website/index.html" ]; then
  echo "==> 웹사이트 파일 복사"
  cp -r "$HERE/../website/." "$SITE_DIR/"
  chown -R "$OWNER":www-data "$SITE_DIR"
fi

echo "==> Nginx 설정 설치"
sed "s/__DOMAIN__/${DOMAIN:-_}/" "$HERE/nginx-site.conf" > "$CONF"
ln -sf "$CONF" /etc/nginx/sites-enabled/website
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  echo "==> 방화벽(ufw)에서 80/443 열기"
  ufw allow 'Nginx Full'
fi

if [ -n "$DOMAIN" ]; then
  echo "==> Let's Encrypt HTTPS 적용: $DOMAIN"
  apt-get install -y certbot python3-certbot-nginx
  if [ -n "$EMAIL" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
  else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
  fi
  echo "완료: https://$DOMAIN"
else
  IP="$(hostname -I | awk '{print $1}')"
  echo "완료: http://$IP  (공인 IP 로 접속하세요)"
fi
