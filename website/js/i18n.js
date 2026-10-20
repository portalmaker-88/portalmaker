// 언어 전환 (한국어 / English) + 구글 스프레드시트에서 버튼 이름 불러오기
//
// 스프레드시트 열 순서: A 버튼 번호 | B 한글 이름 | C 영어 이름 | D 한글 프롬프트 | E 영어 프롬프트
// 시트는 "링크가 있는 모든 사용자: 뷰어"로 공유돼 있어야 방문자 브라우저가 읽을 수 있음.
// 시트를 못 읽거나 칸이 비어 있으면 기본 이름(버튼 01 / Button 01)을 보여줌.
(function () {
  var SHEET_ID = '1i6BL3RqnmG1aaqI3XsPE_uBmIE19MvkHk2U7_QltjaE';
  var SHEET_GID = '0';
  var LANG_KEY = 'lang';
  var CACHE_KEY = 'sheet-buttons';
  var LANGS = ['ko', 'en'];

  // 페이지의 고정 문구 (data-i18n="키"가 붙은 요소)
  var TEXT = {
    ko: {
      skip: '본문으로 건너뛰기',
      eyebrow: '태그라인',
      lead: '한두 문장으로 사이트를 소개하는 문구가 들어갑니다.',
      primary: '주요 버튼',
      secondary: '보조 버튼',
      buttonsLabel: '버튼 목록',
      langLabel: '언어 선택',
      tile: '버튼'
    },
    en: {
      skip: 'Skip to content',
      eyebrow: 'Tagline',
      lead: 'A sentence or two introducing the site goes here.',
      primary: 'Main button',
      secondary: 'Secondary button',
      buttonsLabel: 'Button list',
      langLabel: 'Choose language',
      tile: 'Button'
    }
  };

  var tiles = Array.prototype.slice.call(document.querySelectorAll('.button-grid .tile'));
  var rows = {}; // 버튼 번호 -> { ko, en, promptKo, promptEn }
  var lang = 'ko';

  function store(key, value) {
    try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch (e) {}
    return null;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function apply() {
    var t = TEXT[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t[el.getAttribute('data-i18n')];
    });
    document.querySelectorAll('[data-i18n-label]').forEach(function (el) {
      el.setAttribute('aria-label', t[el.getAttribute('data-i18n-label')]);
    });
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    tiles.forEach(function (tile, i) {
      var n = i + 1;
      var row = rows[n] || {};
      tile.textContent = (lang === 'ko' ? row.ko : row.en) || t.tile + ' ' + pad(n);
      var prompt = lang === 'ko' ? row.promptKo : row.promptEn;
      if (prompt) tile.setAttribute('data-prompt', prompt); else tile.removeAttribute('data-prompt');
    });
  }

  function setLang(next) {
    if (LANGS.indexOf(next) < 0) return;
    lang = next;
    store(LANG_KEY, next);
    apply();
  }

  // 시트 응답(gviz JSON)을 버튼 번호별로 정리
  function parse(res) {
    var out = {};
    var list = (res && res.table && res.table.rows) || [];
    list.forEach(function (r) {
      var c = r.c || [];
      var cell = function (j) { return c[j] && c[j].v != null ? String(c[j].v).trim() : ''; };
      var m = cell(0).match(/\d+/);
      if (!m) return;
      out[parseInt(m[0], 10)] = { ko: cell(1), en: cell(2), promptKo: cell(3), promptEn: cell(4) };
    });
    return out;
  }

  // JSONP 방식으로 불러옴: 별도 서버나 CORS 설정 없이 정적 사이트에서 바로 동작
  function loadSheet() {
    var cb = '__sheetCb' + Date.now();
    var script = document.createElement('script');
    var done = false;
    function cleanup() { done = true; try { delete window[cb]; } catch (e) { window[cb] = undefined; } script.remove(); }
    window[cb] = function (res) {
      if (done) return;
      cleanup();
      if (!res || res.status === 'error') return;
      rows = parse(res);
      store(CACHE_KEY, JSON.stringify(rows));
      apply();
    };
    script.onerror = cleanup;
    setTimeout(function () { if (!done) cleanup(); }, 10000);
    script.src = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?gid=' + SHEET_GID +
      '&headers=1&tqx=responseHandler:' + cb + '&_=' + Date.now();
    document.head.appendChild(script);
  }

  // 지난 방문 때 받아둔 이름을 먼저 보여주고, 시트에서 새로 받아오면 바꿈
  try { rows = JSON.parse(store(CACHE_KEY) || '{}') || {}; } catch (e) { rows = {}; }
  var saved = store(LANG_KEY);
  if (LANGS.indexOf(saved) >= 0) lang = saved;

  document.querySelectorAll('.lang-btn').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
  });

  apply();
  loadSheet();
})();
