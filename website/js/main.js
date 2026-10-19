// 모바일 메뉴 토글
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');

toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  toggle.setAttribute('aria-label', open ? '메뉴 열기' : '메뉴 닫기');
  nav.classList.toggle('is-open', !open);
});

// 메뉴 링크를 누르면 모바일 메뉴 닫기
nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '메뉴 열기');
    nav.classList.remove('is-open');
  });
});

// 푸터 연도
document.getElementById('year').textContent = new Date().getFullYear();

// 문의 폼: 아직 전송할 곳이 없으므로 제출만 막아 둡니다
document.getElementById('contact-form').addEventListener('submit', (e) => e.preventDefault());
