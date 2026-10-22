// 메인화면 원뿔 모션그래픽
// 작은 카드들이 촘촘한 고리로 원뿔을 이루어 매끈하게 돌고, 꼭지 앞 혜성을 따라 날아가는 것처럼 보임.
// 카메라는 옆모습과 입구를 들여다보는 시점 사이를 천천히 오감
(() => {
  const canvas = document.getElementById('hero-cone');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 원뿔 치수 (월드 단위). 꼭지는 오른쪽(약간 아래), 넓은 입구는 왼쪽
  // 꼭지 앞의 별똥별을 따라 날아가는 것처럼 보이지만 원뿔 자체는 제자리
  // 길이 L은 화면 비율에 따라 바뀜: 가로로 넓은 PC 화면에서는 더 길게
  let L = 2.0;
  const R = 1.25, R0 = 0.04;
  let RINGS = 36;              // 꼭지에서 입구까지 촘촘히 쌓인 고리 수 (길이에 비례)
  const CARD_W = 0.015, CARD_H = 0.021;
  // 카메라: 옆에서 보다가 천천히 돌아 입구 안쪽을 들여다보고 다시 돌아옴
  const CAM_PERIOD = 36;      // 한 번 오가는 데 걸리는 초
  let camDist = 5, camYaw = 0, camPitch = 0;
  const rAt = (a) => R0 + (R - R0) * ((a + L / 2) / L);
  const LOOSE = 0.13;         // 원뿔에 붙지 않고 떠다니는 비율
  let LOOSE_LO = -0.3, LOOSE_HI = L / 2 + 1.6;

  const isPhone = Math.min(innerWidth, innerHeight) < 700;
  const state = {
    count: isPhone ? 4000 : 5500,
    turn: 32,                 // 한 바퀴 초
    tilt: 8,                  // 꼭지가 수평에서 아래로 기운 각도
    drawn: 0,                 // 실제로 그리는 수 (성능에 따라 줄어듦)
  };

  // 따뜻한 흰색 위주, 드물게 빨강·초록
  // 카드에는 색 번호를 저장 (COLORS의 순서)
  const COLORS = ['#ece6da', '#ddd5c4', '#c9c0ad', '#b3aa98', '#c8463c', '#5f9a6e'];
  function pickColor() {
    const r = Math.random();
    if (r < 0.025) return 4;
    if (r < 0.04) return 5;
    return (Math.random() * 4) | 0;
  }
  const ALPHA_STEPS = 12;
  const buckets = Array.from({ length: COLORS.length * ALPHA_STEPS }, () => []);

  let cards = [];
  function build() {
    const nLoose = Math.round(state.count * LOOSE);
    const nCone = state.count - nLoose;
    cards = [];
    // 고리마다 둘레에 비례해 카드를 고르게 늘어놓음 (넓은 입구 쪽 고리일수록 많이)
    let sum = 0;
    for (let i = 0; i < RINGS; i++) sum += rAt(-L / 2 + L * (i + 0.5) / RINGS);
    for (let i = 0; i < RINGS; i++) {
      const u = (i + 0.5) / RINGS;
      const a = -L / 2 + L * u;
      const n = Math.max(6, Math.round(nCone * rAt(a) / sum));
      const phase = Math.random() * Math.PI * 2;
      for (let j = 0; j < n; j++) {
        cards.push(makeCard({ a, u, ring: i, phi: phase + (j + (Math.random() - 0.5) * 0.3) / n * Math.PI * 2 }));
      }
    }
    for (let k = 0; k < nLoose; k++) {
      // 넓은 입구 쪽(왼쪽) 바깥에 구름처럼 떠 있는 카드
      // 비행 반대쪽(입구 뒤)으로 계속 흘러가며 떨어져 나가는 카드
      cards.push(makeCard({
        loose: true,
        a: LOOSE_LO + Math.random() * (LOOSE_HI - LOOSE_LO),
        k: 0.35 + Math.random() * 1.1,
        v: 0.06 + Math.random() * 0.22,
        phi: Math.random() * Math.PI * 2,
        seed: Math.random() * 100,
      }));
    }
    // 섞어 두면 앞에서부터 일부만 그려도 고르게 줄어듦
    for (let i = cards.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    state.drawn = cards.length;
  }
  function makeCard(o) {
    o.color = pickColor();
    o.sx = (Math.random() - 0.5) * 6;
    o.sy = (Math.random() - 0.5) * 6;
    o.sz = -2 + Math.random() * 3.2;
    const ringOrder = o.loose ? Math.random() : o.ring / RINGS;
    o.delay = 0.15 + ringOrder * 1.7 + Math.random() * 0.45;
    o.aspect = 0.8 + Math.random() * 0.5;
    // 고리 카드: 반지름과 각도의 cos·sin을 미리 계산해 두고 회전은 덧셈 공식으로
    if (!o.loose) { o.r = rAt(o.a); o.cp = Math.cos(o.phi); o.sp = Math.sin(o.phi); }
    return o;
  }

  // 화면 크기
  let W = 0, H = 0, dpr = 1, focal = 1, cx = 0, cy = 0;
  function resize() {
    dpr = Math.min(isPhone ? 2 : 1.5, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const portrait = H > W;
    focal = portrait ? Math.min(W * 2.3, H * 1.05) : Math.min(W * 0.75, H * 1.3);
    // 가로 화면은 비율만큼 원뿔을 늘림 (최대 1.8배). 길이가 바뀌면 true를 돌려 카드를 다시 배치하게 함
    const want = portrait ? 2.0 : 2.0 * Math.min(1.8, Math.max(1, (W / H) * 0.75));
    if (Math.abs(want - L) < 0.05) return false;
    L = want;
    RINGS = Math.round(36 * L / 2);
    LOOSE_HI = L / 2 + 1.6;
    HEAD_A = -L / 2 - 0.16; TAIL_A = L / 2 + 1.4;
    return true;
  }
  // 휴대폰: 원뿔 가운데를 고정. 가로 화면: 혜성 머리를 오른쪽 끝 가까이에 고정
  function anchor() {
    const portrait = H > W;
    const tx = portrait ? W * 0.4 : W * 0.86;
    const ty = portrait ? H * 0.7 : H * 0.56; // 휴대폰은 소개 문구·버튼과 덜 겹치게 조금 아래로
    coneToWorld(portrait ? 0 : HEAD_A, 0, 0, out);
    const s = focal / (camDist - out.z);
    cx = tx - out.x * s;
    cy = ty + out.y * s;
  }

  // 회전: 축(x)을 중심으로 spin, 그다음 y축으로 살짝 돌려 입구가 보이게, z축으로 화면에서 기울임
  let spin = 0, spinBoost = 0;
  const out = { x: 0, y: 0, z: 0 };
  function coneToWorld(a, r, phi, o) {
    localToWorld(a, r * Math.cos(phi), r * Math.sin(phi), o);
  }
  // 회전에 쓰는 cos·sin은 프레임마다 한 번만 계산 (카드 수천 개마다 다시 계산하지 않음)
  const YAW = -0.3, cYaw = Math.cos(YAW), sYaw = Math.sin(YAW);
  const ROLL = Math.PI - state.tilt * Math.PI / 180, cRoll = Math.cos(ROLL), sRoll = Math.sin(ROLL);
  let cCy = 1, sCy = 0, cCp = 1, sCp = 0;
  function updateCamTrig() {
    cCy = Math.cos(camYaw); sCy = Math.sin(camYaw);
    cCp = Math.cos(camPitch); sCp = Math.sin(camPitch);
  }
  function localToWorld(a, y0, z0, o) {
    const x1 = a * cYaw + z0 * sYaw;
    const z1 = -a * sYaw + z0 * cYaw;
    const x2 = x1 * cRoll - y0 * sRoll;
    const y2 = x1 * sRoll + y0 * cRoll;
    // 카메라 시점: 세로축으로 돌고(yaw) 살짝 위아래로(pitch)
    const x3 = x2 * cCy + z1 * sCy;
    const z3 = -x2 * sCy + z1 * cCy;
    o.x = x3;
    o.y = y2 * cCp - z3 * sCp;
    o.z = y2 * sCp + z3 * cCp;
  }

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  let start = performance.now();
  let last = start, running = true, rafId = 0;
  let fpsAvg = 60, slowFor = 0;

  const project = (a, r, phi) => {
    coneToWorld(a, r, phi, out);
    const sc = focal / (camDist - out.z);
    return [cx + out.x * sc, cy - out.y * sc, sc];
  };

  // 별똥별: 꼭지 바로 앞의 머리, 축을 따라 입구 뒤로 길게 빠지는 꼬리
  let HEAD_A = -L / 2 - 0.16, TAIL_A = L / 2 + 1.4;
  function drawTail() {
    const [hx, hy] = project(HEAD_A, 0, 0);
    const [tx, ty] = project(TAIL_A, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    [[7, 0.16], [2.4, 0.5], [1, 0.95]].forEach(([w, a]) => {
      const g = ctx.createLinearGradient(hx, hy, tx, ty);
      g.addColorStop(0, `rgba(255,240,205,${a})`);
      g.addColorStop(0.35, `rgba(236,222,190,${a * 0.45})`);
      g.addColorStop(1, 'rgba(236,222,190,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawHead(t) {
    const [hx, hy] = project(HEAD_A, 0, 0);
    const pulse = 1 + 0.12 * Math.sin(t * 9) + 0.08 * Math.sin(t * 23.7);
    const rad = Math.max(22, Math.min(W, H) * 0.09) * pulse;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, rad);
    g.addColorStop(0, 'rgba(255,250,235,1)');
    g.addColorStop(0.12, 'rgba(255,236,190,0.85)');
    g.addColorStop(0.4, 'rgba(255,210,150,0.18)');
    g.addColorStop(1, 'rgba(255,210,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(hx, hy, rad, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // 입구 테두리의 와이어 링 (가는 관을 둥글게 만 모양), 원뿔과 같이 회전.
  // 카드가 다 모인 뒤(약 3.6초) 한 바퀴 둘러 그려지며 나타남
  function drawRim(t) {
    const p = Math.min(1, Math.max(0, (t - 3.6) / 1.4));
    if (p <= 0) return;
    const sweep = 1 - Math.pow(1 - p, 3);
    const rt = 0.045, segs = Math.max(1, Math.round(72 * sweep)), tubes = 36, tseg = 10;
    const end = sweep * Math.PI * 2;
    const pt = (phi, psi) => project(L / 2 + rt * Math.cos(psi), R + rt * Math.sin(psi), phi + spin);
    ctx.strokeStyle = `rgba(236,230,218,${0.38 * Math.min(1, p * 2)})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const psi = k * Math.PI / 2;
      for (let i = 0; i <= segs; i++) {
        const [x, y] = pt(i / segs * end, psi);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    }
    for (let i = 0; i < tubes; i++) {
      const phi = i / tubes * Math.PI * 2;
      if (phi > end) break;
      for (let j = 0; j <= tseg; j++) {
        const [x, y] = pt(phi, j / tseg * Math.PI * 2);
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }

  // 머리에서 떨어져 뒤로 흩날리는 불티
  const sparks = [];
  function updateSparks(dt) {
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < n && sparks.length < 140; i++) {
      sparks.push({ a: HEAD_A, r: Math.random() * 0.03, phi: Math.random() * Math.PI * 2,
        va: 0.6 + Math.random() * 1.2, vr: 0.04 + Math.random() * 0.18, life: 1, decay: 0.5 + Math.random() * 0.7 });
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffeec8';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.a += sp.va * dt; sp.r += sp.vr * dt; sp.life -= sp.decay * dt;
      if (sp.life <= 0) { sparks.splice(i, 1); continue; }
      const [px, py, sc] = project(sp.a, sp.r, sp.phi);
      const z = Math.max(1, sc * 0.008);
      ctx.globalAlpha = sp.life * 0.9;
      ctx.fillRect(px - z / 2, py - z / 2, z, z);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // 배경의 먼 별: 비행 반대 방향으로 흘러가는 짧은 선 (원뿔은 제자리, 주변이 지나감)
  let streaks = [];
  const STREAK_STEPS = 6;
  const streakBuckets = Array.from({ length: STREAK_STEPS }, () => []);
  function buildStreaks() {
    const n = Math.round((W * H) / (isPhone ? 5200 : 7000));
    streaks = Array.from({ length: n }, () => ({
      u: Math.random(), v: Math.random() - 0.5,
      speed: 0.08 + Math.pow(Math.random(), 2) * 0.55,
      band: (Math.random() * STREAK_STEPS) | 0,
    }));
  }
  function drawStreaks(dt) {
    const [hx, hy] = project(HEAD_A, 0, 0);
    const [tx, ty] = project(TAIL_A, 0, 0);
    let dx = hx - tx, dy = hy - ty;
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const span = Math.hypot(W, H) * 1.1;
    ctx.strokeStyle = '#ece6da';
    ctx.lineWidth = 1;
    // 투명도가 비슷한 선끼리 모아 한 번에 그림
    for (let b = 0; b < STREAK_STEPS; b++) streakBuckets[b].length = 0;
    for (const st of streaks) {
      st.u -= st.speed * dt;
      if (st.u < 0) { st.u += 1; st.v = Math.random() - 0.5; }
      const along = (st.u - 0.5) * span, across = st.v * span;
      const x = W / 2 + dx * along - dy * across;
      const y = H / 2 + dy * along + dx * across;
      const len = 6 + st.speed * 140;
      streakBuckets[st.band].push(x, y, x - dx * len, y - dy * len);
    }
    for (let b = 0; b < STREAK_STEPS; b++) {
      const q = streakBuckets[b];
      if (!q.length) continue;
      ctx.globalAlpha = 0.15 + 0.45 * (b + 0.5) / STREAK_STEPS;
      ctx.beginPath();
      for (let j = 0; j < q.length; j += 4) { ctx.moveTo(q[j], q[j + 1]); ctx.lineTo(q[j + 2], q[j + 3]); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 120·144Hz 모니터에서는 화면이 바뀔 때마다 그리지 않고 약 60fps로 맞춤 (일정한 간격으로 건너뜀)
  let tick = 0, every = 1, gaps = [], prevNow = 0;
  function paced(now) {
    if (prevNow && gaps.length < 30) {
      gaps.push(now - prevNow);
      if (gaps.length === 30) every = Math.max(1, Math.round(16.7 / gaps.sort((a, b) => a - b)[15]));
    }
    prevNow = now;
    return tick++ % every === 0;
  }
  function frame(now) {
    if (!reduceMotion && !paced(now)) { if (running) rafId = requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = reduceMotion ? 99 : (now - start) / 1000;

    if (!reduceMotion) {
      spin += dt * (Math.PI * 2 / state.turn + spinBoost);
      spinBoost *= Math.pow(0.12, dt);
    }

    // 성능 감시: 2초 넘게 느리면 그리는 카드 수를 20%씩 줄임
    if (dt > 0) fpsAvg += (1 / dt - fpsAvg) * 0.05;
    if (t > 3 && fpsAvg < 45) {
      slowFor += dt;
      if (slowFor > 2 && state.drawn > 400) { state.drawn = Math.round(state.drawn * 0.8); slowFor = 0; }
    } else slowFor = 0;

    if (!reduceMotion) {
      const k = (1 - Math.cos(t * Math.PI * 2 / CAM_PERIOD)) / 2;   // 0 → 1 → 0 부드럽게
      camYaw = 0.3 * k;
      camPitch = 0.06 * Math.sin(t * Math.PI * 2 / CAM_PERIOD);
      camDist = 5 - 0.175 * k;
    }
    updateCamTrig();
    ctx.clearRect(0, 0, W, H);
    anchor();
    const cS = Math.cos(spin), sS = Math.sin(spin);
    if (!reduceMotion) drawStreaks(dt);
    drawTail();

    for (let i = 0; i < state.drawn; i++) {
      const c = cards[i];
      let wx, wy, wz, fade = 1;
      if (c.loose) {
        const span = LOOSE_HI - LOOSE_LO;
        const a = LOOSE_LO + (((c.a - LOOSE_LO + t * c.v) % span) + span) % span;
        fade = Math.min(1, (a - LOOSE_LO) / 0.4, (LOOSE_HI - a) / 0.6);
        coneToWorld(a, rAt(Math.min(a, L / 2)) * c.k + 0.08 + Math.cos(t * 0.5 + c.seed) * 0.03, c.phi + Math.sin(t * 0.3 + c.seed) * 0.1, out);
        wx = out.x; wy = out.y; wz = out.z;
      } else {
        // 고정된 고리 그대로 축을 중심으로 매끈하게 회전
        localToWorld(c.a, c.r * (c.cp * cS - c.sp * sS), c.r * (c.sp * cS + c.cp * sS), out);
        wx = out.x; wy = out.y; wz = out.z;
      }
      const p = Math.min(1, Math.max(0, (t - c.delay) / 1.5));
      if (p < 1) {
        const e = ease(p);
        wx = c.sx + (wx - c.sx) * e;
        wy = c.sy + (wy - c.sy) * e;
        wz = c.sz + (wz - c.sz) * e;
      }
      if (camDist - wz < 0.5) continue;
      const s = focal / (camDist - wz);
      const px = cx + wx * s, py = cy - wy * s;
      if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
      const depth = Math.min(1, Math.max(0, (wz + 1.3) / 2.6));
      const w = CARD_W * s * c.aspect, h = CARD_H * s;
      const alpha = (c.loose ? 0.55 : 0.22 + 0.78 * depth) * fade * (0.3 + 0.7 * Math.min(1, p * 1.4));
      const lv = Math.min(ALPHA_STEPS - 1, Math.round(alpha * (ALPHA_STEPS - 1)));
      if (lv > 0) buckets[c.color * ALPHA_STEPS + lv].push(px - w / 2, py - h / 2, w, h);
    }
    // 같은 색·비슷한 투명도끼리 모아 한 번에 칠함 (카드마다 색·투명도를 바꾸면 PC 큰 화면에서 느려짐)
    for (let b = 0; b < buckets.length; b++) {
      const q = buckets[b];
      if (!q.length) continue;
      ctx.globalAlpha = (b % ALPHA_STEPS) / (ALPHA_STEPS - 1);
      ctx.fillStyle = COLORS[(b / ALPHA_STEPS) | 0];
      ctx.beginPath();
      for (let j = 0; j < q.length; j += 4) ctx.rect(q[j], q[j + 1], q[j + 2], q[j + 3]);
      ctx.fill();
      q.length = 0;
    }
    ctx.globalAlpha = 1;
    drawRim(t);
    if (!reduceMotion) updateSparks(dt);
    drawHead(t);

    if (running && !reduceMotion) rafId = requestAnimationFrame(frame);
  }

  function play() {
    if (running) return;
    running = true; last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function pause() { running = false; cancelAnimationFrame(rafId); }

  // 화면 밖이거나 다른 탭이면 멈춤
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : play());
  // 위쪽 고정 메뉴 줄 뒤에 히어로 끝자락만 걸쳐 있을 때(버튼 화면)도 안 보이므로 멈춤
  const headerH = document.querySelector('.site-header')?.offsetHeight || 0;
  new IntersectionObserver(([e]) => e.isIntersecting ? play() : pause(), { rootMargin: `-${headerH + 1}px 0px 0px 0px` }).observe(canvas);

  // 좌우로 끌면 회전 가속
  let lastX = null;
  canvas.addEventListener('pointerdown', (e) => { lastX = e.clientX; });
  canvas.addEventListener('pointermove', (e) => {
    if (lastX === null) return;
    spinBoost += (e.clientX - lastX) * 0.02;
    spinBoost = Math.max(-4, Math.min(4, spinBoost));
    lastX = e.clientX;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => canvas.addEventListener(n, () => { lastX = null; }));

  addEventListener('resize', () => { if (resize()) build(); buildStreaks(); if (reduceMotion) frame(performance.now()); });
  resize();
  // 원뿔이 길어진 만큼 PC 카드 수도 늘림 (최대 6,500개, 느리면 자동으로 줄어듦)
  if (!isPhone) state.count = Math.min(6500, Math.round(5500 * L / 2 / 100) * 100);
  buildStreaks();
  build();
  running = true;
  rafId = requestAnimationFrame(frame);
})();
