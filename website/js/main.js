// 푸터 연도
document.getElementById('year').textContent = new Date().getFullYear();

// 풀페이지 스크롤: 마우스 휠 한 번에 한 화면씩 넘김 (터치 화면은 CSS scroll-snap이 처리)
(() => {
  const pages = [...document.querySelectorAll('.hero, .button-page')];
  if (!pages.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const headerH = () => document.querySelector('.site-header').offsetHeight;
  let lockedUntil = 0;

  addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('.side-panel')) return; // 사이드바 위에서는 사이드바만 스크롤
    if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX) || Math.abs(e.deltaY) < 4) return;
    const top = headerH();
    const dir = e.deltaY > 0 ? 1 : -1;
    // 지금 화면에 걸쳐 있는 페이지 (헤더 바로 아래 줄 기준)
    let i = pages.findIndex((p) => p.getBoundingClientRect().bottom > top + 2);
    if (i < 0) i = pages.length - 1;
    const r = pages[i].getBoundingClientRect();
    // 화면보다 긴 페이지(작은 화면의 히어로 등)는 끝까지 보통 스크롤
    if (dir > 0 && r.bottom > innerHeight + 2) return;
    if (dir < 0 && r.top < top - 2) return;
    e.preventDefault();
    if (performance.now() < lockedUntil) return;
    const next = pages[i + dir];
    if (!next) return;
    lockedUntil = performance.now() + 800;
    scrollTo({ top: next.getBoundingClientRect().top + scrollY - top, behavior: 'smooth' });
  }, { passive: false });
})();

// 버튼 배열: 한 화면 30개를 가로로 넓은 버튼(가로:세로 약 3:1)이 되게 열 수를 고르고,
// 버튼 너비는 그 칸 너비의 WIDTH_SCALE(2/3)로 줄여 가운데 정렬
(() => {
  const pages = [...document.querySelectorAll('.button-page')];
  if (!pages.length) return;
  const RATIO = 3, MIN_H = 36, MAX_H = 96, WIDTH_SCALE = 2 / 3, PHONE_WIDTH_SCALE = 0.8;
  function fit() {
    const page = pages[0], grid = page.querySelector('.button-grid');
    const n = grid.children.length;
    const cs = getComputedStyle(page), gs = getComputedStyle(grid);
    const label = page.querySelector('.page-label');
    const labelH = label ? label.offsetHeight + parseFloat(getComputedStyle(label).marginBottom) : 0;
    const W = page.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - labelH;
    const gap = parseFloat(gs.rowGap) || 0;
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      if (rows * cols - n >= cols) continue;  // 빈 줄이 생기는 배열은 건너뜀
      const w = (W - gap * (cols - 1)) / cols;
      const h = Math.min(MAX_H, (H - gap * (rows - 1)) / rows);
      if (w < 72) break;
      const score = Math.abs(Math.log(w / h / RATIO)) + (h < MIN_H ? 10 : 0);
      if (!best || score < best.score) best = { cols, rows, w, h, score };
    }
    if (!best) return;
    pages.forEach((p) => {
      p.style.setProperty('--cols', best.cols);
      p.style.setProperty('--rows', best.rows);
      // 휴대폰은 화면이 좁아 버튼 이름이 잘리지 않게 조금 더 넓게
      const scale = W < 600 ? PHONE_WIDTH_SCALE : WIDTH_SCALE;
      p.style.setProperty('--tile-w', Math.floor(best.w * scale) + 'px');
      p.style.setProperty('--tile-h', Math.floor(best.h) + 'px');
      p.classList.add('is-fitted');
    });
  }
  fit();
  addEventListener('resize', fit);
})();

// 오른쪽 위치 표시: 버튼 화면이 보일 때만 나타나고, 지금 화면의 번호를 강조
(() => {
  const dots = document.querySelector('.page-dots');
  if (!dots) return;
  const links = [...dots.querySelectorAll('a')];
  const pages = links.map((a) => document.querySelector(a.getAttribute('href')));
  function update() {
    const mid = innerHeight / 2;
    let cur = -1;
    pages.forEach((p, i) => { const r = p.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) cur = i; });
    dots.classList.toggle('show', cur >= 0);
    links.forEach((a, i) => a.setAttribute('aria-current', String(i === cur)));
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
