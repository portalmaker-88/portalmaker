// 페이지 전체 바탕 모션그래픽 "느린 해류"
// 원뿔에서 떨어져 나간 카드 부스러기들이 보이지 않는 해류(노이즈의 curl 장)를 따라 천천히 흘러가는 모습.
// 흐름 장은 시간에 따라 아주 천천히 바뀌고, 스크롤하면 입자들이 살짝 뒤처지며 따라옴(시차).
// 히어로가 화면을 다 덮고 있을 때와 다른 탭으로 갔을 때는 멈춤
(() => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  canvas.className = 'flow-bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.hero');

  // 시드 난수: 같은 시드면 같은 흐름이 나옴
  let seed = 20261020;
  function rand() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // 3차원 값 노이즈 (x, y, 시간)
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const h = (i, j, k) => perm[perm[perm[i & 255] + (j & 255)] + (k & 255)] / 255;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  function noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    return lerp(
      lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w);
  }
  // 두 겹(큰 물결 + 잔물결)
  const field = (x, y, z) => noise(x, y, z) + 0.35 * noise(x * 2.3 + 17, y * 2.3 + 31, z * 1.7);

  const SCALE = 1 / 380;      // 흐름 장의 크기 (px당 노이즈 단위). 작을수록 물결이 큼
  const SPEED = 0.7;          // 기본 흐름 속도 (60fps 기준 px/프레임)
  const TIME = 0.0011;        // 흐름 장이 변하는 빠르기
  const TRAIL = 24;           // 꼬리 길이 (점 개수)
  const PARALLAX = 0.25;      // 스크롤할 때 입자가 따라 움직이는 비율
  const LINE = 1.1;
  const BANDS = 6;            // 꼬리를 몇 단계 밝기로 나눠 그릴지

  // 원뿔과 같은 색: 따뜻한 흰색 위주, 드물게 빨강·초록
  const colors = [
    { c: '236,230,218', a: 0.46, w: 0.30 },
    { c: '221,213,196', a: 0.40, w: 0.28 },
    { c: '201,192,173', a: 0.34, w: 0.24 },
    { c: '179,170,152', a: 0.28, w: 0.14 },
    { c: '200,70,60',   a: 0.70, w: 0.025 },
    { c: '95,154,110',  a: 0.65, w: 0.015 },
  ];
  function pickColor() {
    let r = rand() * colors.reduce((s, c) => s + c.w, 0);
    for (let i = 0; i < colors.length; i++) { r -= colors[i].w; if (r <= 0) return i; }
    return 0;
  }

  let W = 0, H = 0, dpr = 1, N = 0, drawn = 0;
  let xs, ys, len, head, life, col, dying;
  function setup() {
    dpr = 1;  // 흐린 가는 선이라 고해상도로 그릴 필요가 없음 (큰 화면에서 가장 큰 부담)
    W = innerWidth; H = Math.max(innerHeight, screen.height || 0);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = H + 'px';
    const want = Math.round(Math.min(650, Math.max(220, (W * H) / 1300)));
    if (want !== N) {
      N = want; drawn = N;
      xs = new Float32Array(N * TRAIL); ys = new Float32Array(N * TRAIL);
      len = new Uint8Array(N); head = new Uint8Array(N);
      life = new Float32Array(N); col = new Uint8Array(N); dying = new Uint8Array(N);
      for (let i = 0; i < N; i++) spawn(i, true);
    }
  }
  function spawn(i, anyAge) {
    const b = i * TRAIL;
    xs[b] = rand() * W; ys[b] = rand() * H;
    head[i] = 0; len[i] = 1; dying[i] = 0;
    life[i] = 240 + rand() * 520;
    if (anyAge) life[i] *= rand();
    col[i] = pickColor();
  }

  let t = rand() * 100;
  let lastScroll = scrollY;
  function step(k) {
    // 스크롤 시차: 화면에 붙은 입자들을 스크롤 반대로 조금 밀어 줌
    const dy = (scrollY - lastScroll) * PARALLAX;
    lastScroll = scrollY;
    if (dy) for (let j = 0; j < xs.length; j++) ys[j] -= dy;

    t += TIME * k;
    const e = 0.6;
    for (let i = 0; i < drawn; i++) {
      const b = i * TRAIL;
      if (dying[i]) {
        // 새 점을 더하지 않고 꼬리만 줄여 자연스럽게 사라짐
        if (--len[i] <= 0) spawn(i, false);
        continue;
      }
      const hx = xs[b + head[i]], hy = ys[b + head[i]];
      const nx = hx * SCALE, ny = (hy + scrollY * (1 - PARALLAX)) * SCALE;
      // curl: 노이즈의 등고선을 따라 흐르게 해서 입자가 한곳에 뭉치지 않음
      const dX = (field(nx + e, ny, t) - field(nx - e, ny, t)) / (2 * e);
      const dY = (field(nx, ny + e, t) - field(nx, ny - e, t)) / (2 * e);
      let x = hx + dY * SPEED * 2.2 * k;
      let y = hy - dX * SPEED * 2.2 * k;
      // 전체적으로 아주 약하게 오른쪽 아래로 (원뿔이 날아가는 반대 방향의 잔해 느낌)
      x += 0.08 * k; y += 0.04 * k;
      head[i] = (head[i] + 1) % TRAIL;
      xs[b + head[i]] = x; ys[b + head[i]] = y;
      if (len[i] < TRAIL) len[i]++;
      life[i] -= k;
      if (life[i] <= 0 || x < -40 || x > W + 40 || y < -40 || y > H + 40) dying[i] = 1;
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = LINE;
    ctx.lineCap = 'round';
    // 같은 색·같은 꼬리 구간끼리 한 번에 그림 (색 6 × 구간 BANDS 번만 stroke)
    const per = (TRAIL - 1) / BANDS;
    for (let c = 0; c < colors.length; c++) {
      for (let band = 0; band < BANDS; band++) {
        const s0 = 1 + Math.round(band * per), s1 = 1 + Math.round((band + 1) * per);
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < drawn; i++) {
          if (col[i] !== c || len[i] <= s0) continue;
          // s=1은 머리 쪽 선분, 클수록 꼬리 쪽. 한 구간은 이어진 선 하나로 그림
          const b = i * TRAIL, end = Math.min(s1, len[i]);
          let p = (head[i] - s0 + 1 + TRAIL) % TRAIL;
          ctx.moveTo(xs[b + p], ys[b + p]);
          for (let s = s0; s < end; s++) {
            p = (head[i] - s + TRAIL) % TRAIL;
            ctx.lineTo(xs[b + p], ys[b + p]);
          }
          any = true;
        }
        if (!any) continue;
        const f = 1 - band / BANDS;
        ctx.strokeStyle = `rgba(${colors[c].c},${(colors[c].a * f * f).toFixed(3)})`;
        ctx.stroke();
      }
    }
  }

  // 히어로가 화면 대부분을 가리고 있으면 굳이 그리지 않음 (히어로 원뿔과 동시에 돌지 않게)
  function covered() {
    if (!hero) return false;
    return hero.getBoundingClientRect().bottom > innerHeight * 0.8;
  }

  let raf = 0, prev = 0, slow = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = prev ? Math.min(50, now - prev) : 16.7;
    prev = now;
    if (covered()) return;
    // 계속 느리면 그리는 입자 수를 줄임
    if (dt > 24) { if (++slow > 45 && drawn > 120) { drawn = Math.round(drawn * 0.85); slow = 0; } }
    else slow = Math.max(0, slow - 1);
    step(dt / 16.7);
    draw();
  }
  function play() { if (!raf && !reduceMotion) { prev = 0; raf = requestAnimationFrame(frame); } }
  function pause() { cancelAnimationFrame(raf); raf = 0; }

  setup();
  if (reduceMotion) {
    // 동작 줄이기: 꼬리가 다 자란 멈춘 한 장면만
    for (let n = 0; n < TRAIL; n++) step(1);
    draw();
  } else play();

  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { setup(); if (reduceMotion) draw(); }, 150);
  });
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : play());
})();
