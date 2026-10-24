#!/usr/bin/env bash
# 새 서버(서피스 프로 3)에서 한 번 실행: 웹서버 + 24시간 켜 두기 + Cloudflare 터널 연결
# 사용법:  sudo bash ~/portalmaker/deploy/migrate-server.sh 터널토큰
#   터널토큰: 지금 서버에서  bash ~/portalmaker/deploy/tunnel-token.sh  로 확인
# 끝나면 Cloudflare 가 옛 서버와 새 서버로 나눠 보내므로 사이트가 끊기지 않습니다.
# 새 서버가 잘 되는 걸 확인한 뒤 옛 서버의 터널을 끄면 이전 완료입니다.
set -euo pipefail

TOKEN="${1:?사용법: sudo bash migrate-server.sh 터널토큰}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OWNER="${SUDO_USER:-root}"

if [ "$(id -u)" -ne 0 ]; then
  echo "sudo 로 실행해 주세요: sudo bash $0 토큰" >&2
  exit 1
fi

# 터널이 앞에서 HTTPS 를 처리하므로 인증서(certbot)는 필요 없습니다. 도메인 없이 설치합니다.
echo "==> 웹서버(Nginx) 설치"
bash "$HERE/setup-server.sh"
apt-get install -y rsync curl
sudo -u "$OWNER" bash "$HERE/update.sh"

echo "==> 24시간 켜 두기: 절전·최대 절전 끄기, 키보드 커버를 덮어도 계속 동작"
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
mkdir -p /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/server.conf <<CONF
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
CONF
systemctl restart systemd-logind || true
if [ -d /etc/NetworkManager/conf.d ]; then
  # 서피스 Wi-Fi 는 절전 모드에서 연결이 자주 끊겨서 끕니다
  printf '[connection]\nwifi.powersave = 2\n' > /etc/NetworkManager/conf.d/wifi-powersave-off.conf
  systemctl reload NetworkManager || true
fi

echo "==> Cloudflare 터널 프로그램(cloudflared) 설치"
ARCH="$(dpkg --print-architecture)"
curl -fsSL -o /tmp/cloudflared.deb \
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH.deb"
dpkg -i /tmp/cloudflared.deb
rm -f /tmp/cloudflared.deb

echo "==> 같은 터널에 연결"
if [ -f /etc/systemd/system/cloudflared.service ]; then
  cloudflared service uninstall || true
fi
cloudflared service install "$TOKEN"
sleep 5

echo "==> 확인"
echo -n "  웹서버: "; curl -s -o /dev/null -w '%{http_code}\n' http://localhost/
echo -n "  터널:   "; systemctl is-active cloudflared
echo
echo "완료. Cloudflare 대시보드 → Networks → Tunnels 에서 이 터널의 연결(Connector)이 2개로 보이면 성공입니다."
echo "그다음 옛 서버(노트북)에서:  sudo systemctl disable --now cloudflared"
