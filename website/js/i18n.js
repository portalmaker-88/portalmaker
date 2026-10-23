// 언어 전환 (한국어 / English) + 구글 스프레드시트에서 버튼 이름 불러오기 + 버튼 누르면 프롬프트 복사
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
      eyebrow: 'Back to home',
      lead: '생각은 버튼이 할게요. 당신은 누르기만 하세요.',
      primary: 'How to Use',
      buttonsLabel: '버튼 목록',
      langLabel: '언어 선택',
      logoLabel: '맨 위로',
      homeLabel: '홈으로',
      cue: '버튼 보러 가기',
      dotsLabel: '버튼 화면',
      tile: '버튼',
      copied: '프롬프트를 복사했어요',
      noPrompt: '아직 입력된 프롬프트가 없어요',
      copyFail: '복사하지 못했어요. 다시 눌러 주세요'
    },
    en: {
      skip: 'Skip to content',
      eyebrow: 'Back to home',
      lead: 'Let the buttons do the thinking. You just press.',
      primary: 'How to Use',
      buttonsLabel: 'Button list',
      langLabel: 'Choose language',
      logoLabel: 'Back to top',
      homeLabel: 'Home',
      cue: 'See the buttons',
      dotsLabel: 'Button screens',
      tile: 'Button',
      copied: 'Prompt copied',
      noPrompt: 'No prompt entered yet',
      copyFail: 'Could not copy. Please try again'
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
      // 시트 이름 앞의 "N. "은 떼고, 번호는 따로 작게 보여줌
      var name = ((lang === 'ko' ? row.ko : row.en) || '').replace(/^\s*\d+\s*[.)]\s*/, '') || t.tile;
      var num = document.createElement('span');
      num.className = 'tile-num';
      num.textContent = pad(n);
      var label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = name;
      tile.textContent = '';
      tile.appendChild(num);
      tile.appendChild(label);
      var prompt = lang === 'ko' ? row.promptKo : row.promptEn;
      if (prompt) {
        tile.setAttribute('data-prompt', prompt);
        // PC에서 마우스를 올리면 프롬프트 앞부분을 미리 보여줌
        var flat = prompt.replace(/\s+/g, ' ');
        tile.title = flat.length > 140 ? flat.slice(0, 140) + '…' : flat;
      } else {
        tile.removeAttribute('data-prompt');
        tile.removeAttribute('title');
      }
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

  // 버튼을 누르면 현재 언어의 프롬프트를 클립보드에 복사
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  var toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }

  // 예전 브라우저나 http 주소에서는 clipboard API가 없어서 임시 입력칸으로 복사
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  // 버튼 하나의 프롬프트 복사. 레시피 사이드바(side-panel.js)도 이걸 씀. 복사됐으면 true
  // source: 'tile'(본문 버튼) 또는 'recipe'(레시피 사이드바)
  function copyTile(tile, source) {
    var t = TEXT[lang];
    var prompt = tile && tile.getAttribute('data-prompt');
    if (!prompt) { showToast(t.noPrompt); return Promise.resolve(false); }
    return copy(prompt).then(function (ok) {
      showToast(ok ? t.copied : t.copyFail);
      if (ok) {
        tile.classList.add('copied', 'used'); // used: 이번 방문에서 복사한 버튼 표시 (새로고침하면 사라짐)
        setTimeout(function () { tile.classList.remove('copied'); }, 600);
        // 구글 애널리틱스: 몇 번 버튼이 복사됐는지 기록
        if (window.gtag) gtag('event', 'button_copy', { button_number: tiles.indexOf(tile) + 1, source: source || 'tile' });
      }
      return ok;
    });
  }
  window.ButtonApp = { copyButton: function (n) { return copyTile(tiles[n - 1], 'recipe'); } };

  tiles.forEach(function (tile) {
    tile.addEventListener('click', function (e) {
      e.preventDefault();
      copyTile(tile);
    });
  });

  document.querySelectorAll('.lang-btn').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
  });

  apply();
  if (tiles.length) loadSheet(); // How to Use 페이지처럼 버튼이 없는 페이지는 시트를 안 읽음
})();
