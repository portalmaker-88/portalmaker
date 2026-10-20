// 푸터 연도
document.getElementById('year').textContent = new Date().getFullYear();

// 풀페이지 스크롤: 마우스 휠 한 번에 한 화면씩 넘김 (터치 화면은 CSS scroll-snap이 처리)
(() => {
  const pages = [...document.querySelectorAll('.hero, .button-page')];
  if (!pages.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const headerH = () => document.querySelector('.site-header').offsetHeight;
  let lockedUntil = 0;

  addEventListener('wheel', (e) => {
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

// 버튼 배열: 한 화면 30개를 가로로 넓은 버튼(가로:세로 약 3:1)이 되게 열 수를 고름
(() => {
  const pages = [...document.querySelectorAll('.button-page')];
  if (!pages.length) return;
  const RATIO = 3, MIN_H = 36, MAX_H = 96;
  function fit() {
    const page = pages[0], grid = page.querySelector('.button-grid');
    const n = grid.children.length;
    const cs = getComputedStyle(page), gs = getComputedStyle(grid);
    const W = page.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const gap = parseFloat(gs.rowGap) || 0;
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      if (rows * cols - n >= cols) continue;  // 빈 줄이 생기는 배열은 건너뜀
      const w = (W - gap * (cols - 1)) / cols;
      const h = Math.min(MAX_H, (H - gap * (rows - 1)) / rows);
      if (w < 72) break;
      const score = Math.abs(Math.log(w / h / RATIO)) + (h < MIN_H ? 10 : 0);
      if (!best || score < best.score) best = { cols, rows, h, score };
    }
    if (!best) return;
    pages.forEach((p) => {
      p.style.setProperty('--cols', best.cols);
      p.style.setProperty('--rows', best.rows);
      p.style.setProperty('--tile-h', Math.floor(best.h) + 'px');
      p.classList.add('is-fitted');
    });
  }
  fit();
  addEventListener('resize', fit);
})();
