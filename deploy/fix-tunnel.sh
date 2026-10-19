#!/usr/bin/env bash
# Cloudflare 터널(cloudflared)이 서버의 http://localhost:80 으로 연결할 때 쓰는 설정.
# certbot 이 넣은 "http → https 전환" 때문에 생기는 무한 리디렉션(ERR_TOO_MANY_REDIRECTS)을 없앱니다.
# 80 과 443 둘 다 전환 없이 사이트를 그대로 보여 줍니다. (외부 https 는 Cloudflare 가 처리)
# 사용법:  sudo bash ~/portalmaker/deploy/fix-tunnel.sh button.backtohome.kr
set -euo pipefail

DOMAIN="${1:?사용법: sudo bash fix-tunnel.sh 도메인}"
CONF=/etc/nginx/sites-available/website
CERT_DIR=/etc/letsencrypt/live/$DOMAIN

if [ "$(id -u)" -ne 0 ]; then
  echo "sudo 로 실행해 주세요: sudo bash $0 $*" >&2
  exit 1
fi

cp "$CONF" "$CONF.bak.$(date +%Y%m%d%H%M%S)"

SSL_BLOCK=""
if [ -f "$CERT_DIR/fullchain.pem" ]; then
  SSL_BLOCK="
    listen 443 ssl;
    listen [::]:443 ssl;
    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;"
  [ -f /etc/letsencrypt/options-ssl-nginx.conf ] && SSL_BLOCK="$SSL_BLOCK
    include /etc/letsencrypt/options-ssl-nginx.conf;"
fi

cat > "$CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;$SSL_BLOCK
    server_name $DOMAIN;

    root /var/www/website;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?)\$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # 인증서 갱신용 경로는 열어 두고, 나머지 숨김 파일은 차단
    location ^~ /.well-known/acme-challenge/ { allow all; }
    location ~ /\. { deny all; }

    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
NGINX

nginx -t
systemctl reload nginx
echo "==> 확인"
curl -sI http://localhost -H "Host: $DOMAIN" | head -1
echo "완료: https://$DOMAIN 을 새로고침해 보세요"
