#!/usr/bin/env bash
# 지금 서버(노트북)에서 실행: 우분투 설치 USB를 만듭니다. 사이트는 계속 켜져 있습니다.
# 사용법: USB를 노트북에 꽂고  bash ~/portalmaker/deploy/make-usb.sh
# - 우분투 24.04 LTS 데스크톱 ISO(약 6GB)를 내려받아 검증한 뒤 USB에 씁니다.
# - 다운로드가 끊기면 같은 명령을 다시 실행하면 이어서 받습니다.
# - USB 안의 내용은 모두 지워집니다.
set -euo pipefail

BASE=https://releases.ubuntu.com/noble
ISO_DIR="$HOME/iso"
mkdir -p "$ISO_DIR"
cd "$ISO_DIR"

echo "==> 최신 우분투 24.04 데스크톱 ISO 찾기"
curl -fsSL "$BASE/SHA256SUMS" -o SHA256SUMS
ISO="$(grep -oE 'ubuntu-24\.04(\.[0-9]+)?-desktop-amd64\.iso' SHA256SUMS | sort -uV | tail -1)"
echo "    $ISO"

echo "==> 내려받기 (몇 분~수십 분)"
wget -c -q --show-progress "$BASE/$ISO"

echo "==> 파일 검증"
grep " \*\?$ISO\$" SHA256SUMS | sha256sum -c -

echo "==> USB 찾기"
mapfile -t USBS < <(lsblk -dno NAME,TRAN | awk '$2=="usb"{print $1}')
if [ "${#USBS[@]}" -eq 0 ]; then
  echo "USB가 안 보입니다. USB를 꽂고 다시 실행해 주세요." >&2
  exit 1
fi
lsblk -dno NAME,SIZE,MODEL "${USBS[@]/#//dev/}"
if [ "${#USBS[@]}" -eq 1 ]; then
  DEV="${USBS[0]}"
else
  read -rp "위 목록에서 쓸 USB 이름(예: sdb): " DEV
  printf '%s\n' "${USBS[@]}" | grep -qx "$DEV" || { echo "목록에 없는 이름입니다." >&2; exit 1; }
fi

read -rp "/dev/$DEV 의 내용을 모두 지우고 설치 USB로 만들까요? (YES 입력): " OK
[ "$OK" = "YES" ] || { echo "취소했습니다."; exit 1; }

echo "==> USB에 쓰기 (5~15분, 비밀번호를 물으면 입력)"
for p in $(lsblk -lno NAME "/dev/$DEV" | tail -n +2); do sudo umount "/dev/$p" 2>/dev/null || true; done
sudo dd if="$ISO" of="/dev/$DEV" bs=4M status=progress conv=fsync
sync
echo "완료: USB를 뽑아 서피스에 꽂으세요. (ISO는 $ISO_DIR 에 있고, 지워도 됩니다)"
