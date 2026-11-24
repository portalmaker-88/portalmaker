// 버튼·레시피 페이지 (/prompts/…, /recipes/…, /ko/…) 전용
// - "프롬프트 복사" 버튼: 옆에 있는 프롬프트 글을 클립보드에 복사하고 알림을 띄움
// - 이 페이지의 언어를 기억해, 첫 화면으로 가도 같은 언어로 보이게 함
(function () {
  var body = document.body;
  var lang = document.documentElement.lang === 'ko' ? 'ko' : 'en';
  function store(v) { try { localStorage.setItem('lang', v); } catch (e) {} }
  store(lang);
  document.querySelectorAll('[data-set-lang]').forEach(function (a) {
    a.addEventListener('click', function () { store(a.getAttribute('data-set-lang')); });
  });

  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  body.appendChild(toast);
  var timer;
  function show(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
    body.appendChild(ta);
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

  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = document.getElementById(btn.getAttribute('data-copy'));
      if (!src) return;
      copy(src.textContent).then(function (ok) {
        show(ok ? body.getAttribute('data-copied') : body.getAttribute('data-copy-fail'));
        if (!ok) return;
        btn.classList.add('done');
        var step = btn.closest('.seo-step');
        if (step) step.classList.add('done');
        if (window.gtag) gtag('event', 'button_copy', {
          button_number: parseInt(btn.getAttribute('data-n'), 10),
          source: btn.getAttribute('data-source') || 'page',
          language: lang
        });
      });
    });
  });
})();
