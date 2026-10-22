// 주요 버튼 → 왼쪽에서 나오는 사이드바 페이지
//
// 내용은 나중에 구글 스프레드시트에서 불러옴. SHEET_ID를 채우기 전에는 아래 PLACEHOLDER를 보여줌.
// 스프레드시트 열 순서(한 줄 = 한 단락): A 순서 | B 한글 제목 | C 영어 제목 | D 한글 내용 | E 영어 내용
// A가 0인 줄은 페이지 맨 위 제목과 소개 글로 씀.
// 시트는 "링크가 있는 모든 사용자: 뷰어"로 공유돼 있어야 방문자 브라우저가 읽을 수 있음.
(function () {
  var SHEET_ID = '';
  var SHEET_GID = '0';
  var CACHE_KEY = 'sheet-panel';

  var PLACEHOLDER = [
    { n: 0, ko: '페이지 제목', en: 'Page title', textKo: '이 페이지를 소개하는 한두 문장이 들어갑니다.', textEn: 'A sentence or two introducing this page goes here.' },
    { n: 1, ko: '첫 번째 단락', en: 'First section', textKo: '스프레드시트를 연결하면 이 자리에 내용이 들어갑니다.', textEn: 'Content from the spreadsheet will appear here.' },
    { n: 2, ko: '두 번째 단락', en: 'Second section', textKo: '단락은 시트에 줄을 추가하는 만큼 늘어납니다.\n줄바꿈도 그대로 보입니다.', textEn: 'Add rows to the sheet to add more sections.\nLine breaks are kept.' },
    { n: 3, ko: '세 번째 단락', en: 'Third section', textKo: '내용이 길면 사이드바 안에서 스크롤됩니다.', textEn: 'Long content scrolls inside the sidebar.' }
  ];

  var panel = document.getElementById('side-panel');
  var backdrop = document.getElementById('panel-backdrop');
  var openBtn = document.getElementById('open-panel');
  var closeBtn = document.getElementById('close-panel');
  var scroller = panel.querySelector('.side-panel-scroll');
  var titleEl = document.getElementById('side-panel-title');
  var introEl = document.getElementById('side-panel-intro');
  var bodyEl = document.getElementById('side-panel-body');
  var rows = PLACEHOLDER;

  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'ko'; }

  function render() {
    var en = lang() === 'en';
    var head = rows.filter(function (r) { return r.n === 0; })[0] || {};
    titleEl.textContent = (en ? head.en : head.ko) || '';
    introEl.textContent = (en ? head.textEn : head.textKo) || '';
    introEl.hidden = !introEl.textContent;
    bodyEl.textContent = '';
    rows.filter(function (r) { return r.n > 0; }).forEach(function (r) {
      var title = en ? r.en : r.ko, text = en ? r.textEn : r.textKo;
      if (!title && !text) return;
      var sec = document.createElement('section');
      sec.className = 'side-panel-section';
      if (title) { var h = document.createElement('h3'); h.textContent = title; sec.appendChild(h); }
      if (text) { var p = document.createElement('p'); p.textContent = text; sec.appendChild(p); }
      bodyEl.appendChild(sec);
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

  // 시트 응답(gviz JSON)을 단락 목록으로 정리
  function parse(res) {
    var list = (res && res.table && res.table.rows) || [];
    var out = [];
    list.forEach(function (r) {
      var c = r.c || [];
      var cell = function (j) { return c[j] && c[j].v != null ? String(c[j].v).trim() : ''; };
      var m = cell(0).match(/\d+/);
      if (!m) return;
      out.push({ n: parseInt(m[0], 10), ko: cell(1), en: cell(2), textKo: cell(3), textEn: cell(4) });
    });
    return out.sort(function (a, b) { return a.n - b.n; });
  }

  function loadSheet() {
    var cb = '__panelCb' + Date.now();
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

  if (SHEET_ID) {
    try { var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (cached && cached.length) rows = cached; } catch (e) {}
  }
  render();
  if (SHEET_ID) loadSheet();
})();
