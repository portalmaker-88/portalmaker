// 글자 외곽선을 따라 선이 그려지는 애니메이션 (React 컴포넌트 path-drawing-portfolio-hero 를 순수 JS로 옮김)
// 사용법: <div data-path-draw data-text="이름" data-from="#색" data-to="#색"></div>
// 기본은 한 번 그리고 멈춤. 계속 반복하려면 data-loop 를 붙임
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let uid = 0;

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('svg raster failed'));
      img.src = url;
    });
  }

  function countOpaque(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 12) n += 1;
    return n;
  }

  // SVG를 복제해 캔버스에 그려 보고, 칠해진 픽셀 수를 셈
  async function rasterInk(source, apply) {
    const clone = source.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    const text = clone.querySelector('text');
    if (!text) return 0;
    apply(text);
    text.setAttribute('stroke', '#ffffff');
    text.style.stroke = '#ffffff';

    const vb = source.viewBox.baseVal;
    const w = Math.max(1, Math.round(vb.width || 800));
    const h = Math.max(1, Math.round(vb.height || 160));
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.style.visibility = 'visible';

    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await loadImage(url);
      const cw = Math.max(1, Math.round(w * 0.45));
      const ch = Math.max(1, Math.round(h * 0.45));
      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 0;
      ctx.drawImage(img, 0, 0, cw, ch);
      return countOpaque(ctx, cw, ch);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // 완성된 글자와 같은 모양이 되는 가장 짧은 선 길이 (이진 탐색)
  async function measureExactDashLength(svg) {
    const full = await rasterInk(svg, (t) => { t.style.strokeDasharray = 'none'; t.style.strokeDashoffset = '0'; });
    if (full <= 0) throw new Error('empty ink');
    const covered = async (dash) => {
      const ink = await rasterInk(svg, (t) => { t.style.strokeDasharray = `${dash} 100000`; t.style.strokeDashoffset = '0'; });
      return ink >= full * 0.994;
    };
    let hi = 64;
    while (hi < 24000 && !(await covered(hi))) hi *= 2;
    let lo = 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (await covered(mid)) hi = mid; else lo = mid + 1;
    }
    return Math.max(1, lo);
  }

  function mount(host) {
    const display = (host.dataset.text || '').trim();
    if (!display) return;
    const fromColor = host.dataset.from || '#f093fb';
    const toColor = host.dataset.to || '#f5576c';
    const durationSec = Number(host.dataset.duration) || 5.5;
    const strokeWidth = Number(host.dataset.stroke) || 2.4;
    const loop = 'loop' in host.dataset;
    // 글자 수에 따라 크기와 viewBox를 고름 (원본 컴포넌트와 같은 규칙)
    const n = display.length;
    const fontSize = n > 12 ? 72 : n > 8 ? 96 : 148;
    const vbW = n > 8 ? 1100 : 860;
    const vbH = n > 8 ? 200 : 240;
    const gradientId = `pathGradient-${++uid}`;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.visibility = 'hidden';
    svg.innerHTML = `
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${fromColor}"></stop>
          <stop offset="100%" stop-color="${toColor}"></stop>
        </linearGradient>
      </defs>
      <text x="${strokeWidth * 2}" y="50%" text-anchor="start" dominant-baseline="middle"
        fill="none" stroke="url(#${gradientId})" stroke-width="${strokeWidth}"
        stroke-linejoin="round" stroke-linecap="round" font-size="${fontSize}"
        font-weight="bold" font-family="Arial, Helvetica, sans-serif" letter-spacing="0.02em"></text>`;
    const textEl = svg.querySelector('text');
    textEl.textContent = display;
    host.appendChild(svg);

    if (reduceMotion) { svg.style.visibility = 'visible'; return; }

    let raf = 0, running = false, done = false, dashLength = 0, offset = 0, last = 0;
    const tick = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      offset -= (dashLength / (Math.max(0.8, durationSec) * 1000)) * dt;
      if (offset <= 0) {
        if (!loop) {                          // 다 그려지면 완성된 글자로 남김
          textEl.style.strokeDasharray = 'none';
          textEl.style.strokeDashoffset = '0';
          done = true; running = false;
          return;
        }
        offset = dashLength;                  // 반복: 다 그려지는 순간 처음부터 다시
      }
      textEl.style.strokeDashoffset = String(offset);
      raf = requestAnimationFrame(tick);
    };
    const play = () => { if (running || done || !dashLength) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); };
    const pause = () => { running = false; cancelAnimationFrame(raf); };

    const start = (dash) => {
      dashLength = dash;
      offset = dash;
      textEl.style.strokeDasharray = `${dash} ${dash}`;
      textEl.style.strokeDashoffset = String(dash);
      svg.style.visibility = 'visible';
      play();
    };

    (async () => {
      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        start(await measureExactDashLength(svg));
      } catch {
        const width = textEl.getComputedTextLength() || n * fontSize * 0.62;
        start(Math.max(1, Math.ceil(width * 1.15)));
      }
    })();

    // 화면 밖이거나 다른 탭이면 멈춤
    document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
    new IntersectionObserver(([e]) => (e.isIntersecting ? play() : pause())).observe(host);
  }

  document.querySelectorAll('[data-path-draw]').forEach(mount);
})();
