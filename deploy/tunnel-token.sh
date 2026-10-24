#!/usr/bin/env bash
# 지금 서버(노트북)에서 실행: Cloudflare 터널 토큰을 보여 줍니다.
# 새 서버에서 이 토큰으로 "같은 터널"에 붙으면, 주소·DNS를 바꾸지 않고 서버를 옮길 수 있습니다.
# 사용법:  bash ~/portalmaker/deploy/tunnel-token.sh
set -euo pipefail

TOKEN="$( { systemctl cat cloudflared 2>/dev/null; ps -eo args; } \
  | grep -oE -- '--token[ =][A-Za-z0-9_=.-]+' | head -1 | sed -E 's/--token[ =]//' || true)"

if [ -n "$TOKEN" ]; then
  echo "아래 한 줄이 터널 토큰입니다. 통째로 복사해 두세요. (비밀번호처럼 남에게 보여 주지 마세요)"
  echo
  echo "$TOKEN"
else
  echo "토큰을 찾지 못했습니다. 터널이 설정 파일(config.yml) 방식으로 만들어진 경우입니다."
  echo "Cloudflare 대시보드 → Zero Trust → Networks → Tunnels 에서 이 터널을 열고"
  echo "'Migrate'(대시보드 관리로 전환) 를 누른 뒤, 설치 명령에 나오는 eyJ... 로 시작하는 토큰을 쓰세요."
fi
