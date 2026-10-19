# 우분투 서버에 웹사이트 올리기 (button.backtohome.kr)

Nginx가 `/var/www/website` 의 정적 파일을 서빙하고, Let's Encrypt로 HTTPS를 붙입니다.

## 0. 먼저 확인할 것
- **DNS**: 도메인 관리 화면에서 `button` 레코드를 **A 레코드 → 서버 공인 IP** 로 설정하세요.
  서버에서 `ping button.backtohome.kr` 했을 때 서버 IP가 나오면 됩니다. (HTTPS 발급에 꼭 필요)
- **포트**: 클라우드 서버라면 보안 그룹/방화벽에서 **80, 443** 포트를 열어 두세요.
- 서버에 SSH로 접속할 수 있고 `sudo` 권한이 있어야 합니다.

## 1. 서버에서 GitHub 저장소 받기
저장소 `portalmaker-88/portalmaker` 는 비공개라서 서버가 받아 갈 수 있게 **배포 키**를 한 번 등록합니다.
휴대폰 SSH 앱(Termius 등)으로 서버에 접속한 뒤:
```bash
sudo apt-get install -y git
ssh-keygen -t ed25519 -N "" -f ~/.ssh/portalmaker_deploy
cat ~/.ssh/portalmaker_deploy.pub
```
마지막 줄에 나온 `ssh-ed25519 ...` 한 줄을 복사해서, GitHub 저장소 **Settings → Deploy keys → Add deploy key** 에 붙여 넣고 저장합니다(쓰기 권한은 체크하지 않음).
그다음 서버에서:
```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/portalmaker_deploy -o StrictHostKeyChecking=accept-new" \
  git clone git@github.com:portalmaker-88/portalmaker.git ~/portalmaker
git -C ~/portalmaker config core.sshCommand "ssh -i ~/.ssh/portalmaker_deploy"
```

> 더 간단하게 하려면 저장소를 공개(public)로 바꾸세요(Settings → Danger Zone → Change visibility). 그러면 배포 키 없이
> `git clone https://github.com/portalmaker-88/portalmaker.git ~/portalmaker` 한 줄이면 됩니다. 사이트 파일은 어차피 누구나 볼 수 있습니다.

## 2. 서버에서 한 번만 실행
```bash
sudo bash ~/portalmaker/deploy/setup-server.sh button.backtohome.kr 내이메일@example.com
```
Nginx 설치 → 사이트 파일 복사 → 설정 적용 → HTTPS 인증서 발급(자동 갱신 포함) → http를 https로 리다이렉트까지 처리합니다.
끝나면 https://button.backtohome.kr/ 로 접속해 보세요.

> DNS가 아직 안 잡혔다면 인증서 단계에서 실패합니다. 그땐 DNS 설정 후 같은 명령을 다시 실행하면 됩니다.

## 3. 사이트를 고친 뒤 다시 올릴 때
고친 내용이 GitHub 저장소에 올라가면, 서버에서 한 줄만 실행하면 됩니다.
```bash
bash ~/portalmaker/deploy/update.sh
```
`git pull` 로 최신 내용을 받고 `/var/www/website` 에 반영합니다. Nginx 재시작은 필요 없습니다.

## 파일 설명
- `nginx-site.conf`: Nginx 사이트 설정 (캐시, gzip, 숨김 파일 차단 포함)
- `setup-server.sh`: 서버 최초 설정 스크립트
- `update.sh`: 서버에서 git pull 후 사이트에 반영하는 스크립트

## 문제가 생기면
- 설정 검사: `sudo nginx -t`
- 에러 로그: `sudo tail -n 50 /var/log/nginx/error.log`
- 인증서 상태: `sudo certbot certificates`
