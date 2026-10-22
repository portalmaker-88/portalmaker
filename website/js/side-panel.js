// 주요 버튼 → 왼쪽에서 나오는 사이드바: 버튼 레시피 목록
//
// 내용은 구글 스프레드시트 "burron recipe"에서 불러옴. 한국 국기면 A~D열, 미국 국기면 E~H열을 보여줌.
// 열 순서: A 번호 | B 카테고리 | C 결과물 이름 | D 레시피 | E No. | F Category | G Deliverable Name | H Recipe
// 레시피 칸은 "입력할 것 ➔ 버튼 3 (이름) ➔ 버튼 31 (이름) ..." 형식이면 단계별로 나눠서 보여줌.
// 시트는 "링크가 있는 모든 사용자: 뷰어"로 공유돼 있어야 방문자 브라우저가 읽을 수 있음.
// 시트를 못 읽으면 지난번에 받아둔 내용, 그것도 없으면 data/recipes.js 스냅샷을 보여줌.
(function () {
  var SHEET_ID = '1YcyBCKgujSsPVmM6In_CQPexoCBaBDb89czQfi4nkPc';
  var SHEET_GID = '0';
  var CACHE_KEY = 'sheet-recipes';

  var TEXT = {
    ko: { title: '버튼 레시피', intro: '버튼을 순서대로 누르면 결과물이 완성돼요.', all: '전체', filters: '카테고리', input: '입력', count: '개' },
    en: { title: 'Button Recipes', intro: 'Press the buttons in order to build each deliverable.', all: 'All', filters: 'Categories', input: 'Input', count: '' }
  };

  var panel = document.getElementById('side-panel');
  var backdrop = document.getElementById('panel-backdrop');
  var openBtn = document.getElementById('open-panel');
  var closeBtn = document.getElementById('close-panel');
  var scroller = panel.querySelector('.side-panel-scroll');
  var titleEl = document.getElementById('side-panel-title');
  var introEl = document.getElementById('side-panel-intro');
  var filtersEl = document.getElementById('recipe-filters');
  var listEl = document.getElementById('recipe-list');

  var rows = window.RECIPES_SNAPSHOT || []; // 시트 한 줄 = 문자열 8칸
  var category = -1; // 고른 카테고리 순번 (-1 = 전체). 언어가 바뀌어도 같은 카테고리가 유지되게 순번으로 기억

  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'ko'; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  // 현재 언어의 4칸만 꺼냄
  function recipe(r) {
    var o = lang() === 'en' ? 4 : 0;
    return { no: r[o] || '', cat: r[o + 1] || '', name: r[o + 2] || '', steps: r[o + 3] || '' };
  }

  // 카테고리 목록: 한국어 카테고리 기준으로 처음 나온 순서대로
  function categories() {
    var seen = [], out = [];
    rows.forEach(function (r) {
      if (seen.indexOf(r[1]) < 0) { seen.push(r[1]); out.push(recipe(r).cat || r[1]); }
    });
    return { keys: seen, labels: out };
  }

  // "버튼 3 (아이디어 도출)" → { num: '3', label: '아이디어 도출' }
  function step(s) {
    var m = s.match(/^\s*(?:버튼|Button)\s*(\d+)\s*\((.*)\)\s*$/i);
    return m ? { num: m[1], label: m[2] } : { num: '', label: s.trim() };
  }

  function renderFilters(cats) {
    var t = TEXT[lang()];
    filtersEl.setAttribute('aria-label', t.filters);
    filtersEl.textContent = '';
    [t.all].concat(cats.labels).forEach(function (label, i) {
      var b = el('button', 'recipe-chip', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(i - 1 === category));
      b.addEventListener('click', function () {
        category = i - 1;
        render();
        scroller.scrollTop = 0;
      });
      filtersEl.appendChild(b);
    });
  }

  function render() {
    var t = TEXT[lang()];
    var cats = categories();
    if (category >= cats.keys.length) category = -1;
    titleEl.textContent = t.title;
    introEl.textContent = t.intro;
    renderFilters(cats);

    listEl.textContent = '';
    rows.forEach(function (r) {
      if (category >= 0 && r[1] !== cats.keys[category]) return;
      var d = recipe(r);
      if (!d.name && !d.steps) return;
      var li = el('li', 'recipe');
      var meta = el('div', 'recipe-meta');
      meta.appendChild(el('span', 'recipe-no', d.no));
      if (d.cat) meta.appendChild(el('span', 'recipe-cat', d.cat));
      li.appendChild(meta);
      li.appendChild(el('h3', 'recipe-name', d.name));

      var parts = d.steps.split('➔').map(function (s) { return s.trim(); }).filter(Boolean);
      var ol = el('ol', 'recipe-steps');
      parts.forEach(function (s) {
        var p = step(s);
        var item = el('li', p.num ? 'recipe-step' : 'recipe-step is-input');
        item.appendChild(el('span', 'step-badge', p.num || t.input));
        item.appendChild(el('span', 'step-label', p.label));
        ol.appendChild(item);
      });
      li.appendChild(ol);
      listEl.appendChild(li);
    });
  }

  function setOpen(open) {
    document.body.classList.toggle('panel-open', open);
    panel.setAttribute('aria-hidden', String(!open));
    if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    openBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      backdrop.hidden = false;
      requestAnimationFrame(function () { backdrop.classList.add('show'); });
      scroller.focus({ preventScroll: true });
    } else {
      backdrop.classList.remove('show');
      setTimeout(function () { if (!backdrop.classList.contains('show')) backdrop.hidden = true; }, 300);
      openBtn.focus({ preventScroll: true });
    }
  }

  openBtn.addEventListener('click', function () { setOpen(true); });
  closeBtn.addEventListener('click', function () { setOpen(false); });
  backdrop.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('panel-open')) setOpen(false);
  });

  // 언어 버튼을 누르면 i18n.js가 <html lang>을 바꿈 → 따라서 다시 그림
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // 시트 응답(gviz JSON)을 문자열 8칸짜리 줄 목록으로 정리. A열에 숫자가 없는 줄(제목 줄, 빈 줄)은 건너뜀
  function parse(res) {
    var list = (res && res.table && res.table.rows) || [];
    var out = [];
    list.forEach(function (r) {
      var c = r.c || [];
      var row = [];
      for (var j = 0; j < 8; j++) row.push(c[j] && c[j].v != null ? String(c[j].v).trim() : '');
      if (/\d/.test(row[0])) out.push(row);
    });
    return out;
  }

  function loadSheet() {
    var cb = '__recipeCb' + Date.now();
    var script = document.createElement('script');
    var done = false;
    function cleanup() { done = true; try { delete window[cb]; } catch (e) { window[cb] = undefined; } script.remove(); }
    window[cb] = function (res) {
      if (done) return;
      cleanup();
      if (!res || res.status === 'error') return;
      var next = parse(res);
      if (!next.length) return;
      rows = next;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch (e) {}
      render();
    };
    script.onerror = cleanup;
    setTimeout(function () { if (!done) cleanup(); }, 10000);
    script.src = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?gid=' + SHEET_GID +
      '&headers=1&tqx=responseHandler:' + cb + '&_=' + Date.now();
    document.head.appendChild(script);
  }

  try { var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (cached && cached.length) rows = cached; } catch (e) {}
  render();
  loadSheet();
})();
