#!/usr/bin/env python3
"""검색 노출용 정적 페이지 만들기 (BUTTON)

버튼 90개와 레시피 160개를 각각 한 페이지씩, 영어(/...)와 한국어(/ko/...)로 만들어
website/ 안에 저장합니다. 검색엔진은 자바스크립트로 불러오는 내용보다 HTML에 바로 있는
글을 훨씬 잘 읽기 때문에, 시트 내용을 미리 HTML로 구워 둡니다.

  website/prompts/N/index.html      영어 버튼 페이지     → /prompts/N/
  website/ko/prompts/N/index.html   한국어 버튼 페이지   → /ko/prompts/N/
  website/recipes/N/index.html      영어 레시피 페이지   → /recipes/N/
  website/ko/recipes/N/index.html   한국어 레시피 페이지 → /ko/recipes/N/
  website/prompts/, website/recipes/ (+ /ko/)  목록 페이지
  website/sitemap.xml               모든 주소 + 언어 짝(hreflang)
  website/index.html                첫 화면 버튼 90개에 실제 이름과 버튼 페이지 링크를 넣음

데이터:
  tools/data/buttons.json  버튼 이름·프롬프트 (구글 시트 1i6BL3Rq… 스냅샷)
  website/data/recipes.js  레시피 (구글 시트 1YcyBCKg… 스냅샷, 사이드바와 같은 파일)

시트 내용을 바꾸면 두 스냅샷을 새로 받은 뒤 이 스크립트를 다시 돌리고 커밋하세요.
  python3 tools/build_seo_pages.py
"""
import datetime
import html
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "website"
SITE = "https://button.backtohome.kr"
TODAY = datetime.date.today().isoformat()

BUTTONS = json.loads((ROOT / "tools/data/buttons.json").read_text(encoding="utf-8"))
_rjs = (WEB / "data/recipes.js").read_text(encoding="utf-8")
RECIPE_ROWS = json.loads(_rjs[_rjs.index("= [") + 2:_rjs.rindex("]") + 1])

e = html.escape


def strip_no(name):
    return re.sub(r"^\s*\d+\s*[.)]\s*", "", name).strip()


def num(s):
    m = re.search(r"\d+", s)
    return int(m.group()) if m else 0


# ---------- 데이터 정리 ----------
def parse_prompt(text, lang):
    """프롬프트에서 첫 줄(하는 일), AI가 물어볼 질문, 결과물 형식을 뽑음"""
    lines = [l.strip() for l in text.split("\n")]
    intro = next((l for l in lines if l), "")
    questions = []
    for l in lines:
        m = re.match(r"^\d\)\s*(.+)$", l)
        if m:
            q = re.sub(r"\s*\((?:보기|options)\s*:.*\)\s*$", "", m.group(1)).strip()
            questions.append(q)
    marker = "[작성]" if lang == "ko" else "[Write]"
    output = ""
    if marker in text:
        after = text.split(marker, 1)[1].split("\n")[1:]
        output = " ".join(l.strip() for l in after if l.strip())
    return {"intro": intro, "questions": questions, "output": output}


buttons = {}
for b in BUTTONS:
    n = b["n"]
    buttons[n] = {
        "n": n,
        "ko": {"name": strip_no(b["ko"]), "prompt": b["promptKo"], **parse_prompt(b["promptKo"], "ko")},
        "en": {"name": strip_no(b["en"]), "prompt": b["promptEn"], **parse_prompt(b["promptEn"], "en")},
        "recipes": [],
    }


def parse_recipe(row, off):
    parts = [p.strip() for p in row[off + 3].split("➔")]
    first = re.sub(r"^(AI 첫 질문에 답할 것|Answer the AI's first question)\s*:\s*", "", parts[0])
    steps = []
    for p in parts[1:]:
        m = re.match(r"^(?:버튼|Button)\s*(\d+)\s*\((.*)\)$", p, re.I)
        steps.append({"n": int(m.group(1)), "label": m.group(2)})
    return {"cat": row[off + 1], "name": row[off + 2], "first": first, "steps": steps}


recipes = {}
for row in RECIPE_ROWS:
    n = num(row[0])
    r = {"n": n, "ko": parse_recipe(row, 0), "en": parse_recipe(row, 4)}
    recipes[n] = r
    for s in r["en"]["steps"]:
        if n not in buttons[s["n"]]["recipes"]:
            buttons[s["n"]]["recipes"].append(n)

CATS = []  # (ko, en) 처음 나온 순서
for r in recipes.values():
    c = (r["ko"]["cat"], r["en"]["cat"])
    if c not in CATS:
        CATS.append(c)

# ---------- 공통 조각 ----------
_howto = (WEB / "how-to-use.html").read_text(encoding="utf-8")
LOGO_SVG = re.search(r'<svg class="logo-mark".*?</svg>', _howto, re.S).group()
FLAG_EN = re.search(r'data-lang="en"[^>]*>(<svg.*?</svg>)</button>', _howto, re.S).group(1)
FLAG_KO = re.search(r'data-lang="ko"[^>]*>(<svg.*?</svg>)</button>', _howto, re.S).group(1)

T = {
    "en": {
        "home": "Home", "prompts": "All prompts", "recipes": "All recipes", "howto": "How to use",
        "copy": "Copy prompt", "copyN": "Copy button {n}", "copied": "Prompt copied",
        "copyFail": "Could not copy. Please try again", "see": "See the prompt",
        "button": "Button", "recipe": "Recipe", "langLabel": "Choose language",
        "skip": "Skip to content",
    },
    "ko": {
        "home": "홈", "prompts": "전체 프롬프트", "recipes": "전체 레시피", "howto": "사용 방법",
        "copy": "프롬프트 복사", "copyN": "버튼 {n} 복사", "copied": "프롬프트를 복사했어요",
        "copyFail": "복사하지 못했어요. 다시 눌러 주세요", "see": "프롬프트 보기",
        "button": "버튼", "recipe": "레시피", "langLabel": "언어 선택",
        "skip": "본문으로 건너뛰기",
    },
}


def url(lang, path):
    """path 예: 'prompts/3/' → 영어 /prompts/3/, 한국어 /ko/prompts/3/"""
    return ("/ko/" if lang == "ko" else "/") + path


def other(lang):
    return "en" if lang == "ko" else "ko"


def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>"


def breadcrumbs(lang, items):
    return {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": SITE + href}
            for i, (name, href) in enumerate(items)
        ],
    }


def page(lang, path, title, desc, body, ld=(), og_type="article"):
    t = T[lang]
    o = other(lang)
    canon = SITE + url(lang, path)
    alt_en = SITE + url("en", path)
    alt_ko = SITE + url("ko", path)
    lang_links = []
    for code, flag, label in (("en", FLAG_EN, "English"), ("ko", FLAG_KO, "한국어")):
        cur = ' aria-current="true"' if code == lang else ""
        lang_links.append(
            f'<a class="lang-btn" href="{url(code, path)}" hreflang="{code}" lang="{code}" data-set-lang="{code}"'
            f' aria-label="{label}" title="{label}"{cur}>{flag}</a>'
        )
    ld_html = "\n  ".join(jsonld(x) for x in ld)
    return f"""<!doctype html>
<html lang="{lang}" class="page-howto page-seo">
<head>
  <meta charset="utf-8">
  <meta name="naver-site-verification" content="74e1eeb39f1ebebd0752b0fb7237c66dbafdf594" />
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <link rel="canonical" href="{canon}">
  <link rel="alternate" hreflang="en" href="{alt_en}">
  <link rel="alternate" hreflang="ko" href="{alt_ko}">
  <link rel="alternate" hreflang="x-default" href="{alt_en}">
  <meta name="application-name" content="BUTTON">
  <meta property="og:site_name" content="BUTTON">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:url" content="{canon}">
  <meta property="og:image" content="{SITE}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="{'ko_KR' if lang == 'ko' else 'en_US'}">
  <meta property="og:locale:alternate" content="{'en_US' if lang == 'ko' else 'ko_KR'}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Noto+Sans+KR:wght@400;500;700;800&display=swap">
  <link rel="icon" href="/assets/favicon-32.png?v=dev" type="image/png" sizes="32x32">
  <link rel="icon" href="/assets/favicon.svg?v=dev" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png?v=dev">
  <link rel="stylesheet" href="/css/style.css?v=dev">
  <link rel="stylesheet" href="/css/pages.css?v=dev">
  {ld_html}
  <!-- Google Analytics (방문자 통계) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-PKL37FCS8F"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-PKL37FCS8F');
    setTimeout(function () {{ gtag('event', 'stay_30s'); }}, 30000);
  </script>
  <!-- Google AdSense (자동 광고) -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2568905754072938"
     crossorigin="anonymous"></script>
</head>
<body data-copied="{e(t['copied'])}" data-copy-fail="{e(t['copyFail'])}">
  <a class="skip-link" href="#main">{t['skip']}</a>

  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/" aria-label="{t['home']}">{LOGO_SVG}</a>
      <nav class="lang-switch" aria-label="{t['langLabel']}">
        {lang_links[0]}
        {lang_links[1]}
      </nav>
    </div>
  </header>

  <main id="main" class="howto">
{body}
    <footer class="site-footer howto-footer">
      <nav class="seo-footer-nav">
        <a href="/">{t['home']}</a>
        <a href="{url(lang, 'prompts/')}">{t['prompts']}</a>
        <a href="{url(lang, 'recipes/')}">{t['recipes']}</a>
        <a href="/how-to-use.html">{t['howto']}</a>
      </nav>
      <p>&copy; <span id="year"></span> BUTTON. All rights reserved.</p>
    </footer>
  </main>

  <script src="/js/main.js?v=dev"></script>
  <script src="/js/flow-bg.js?v=dev"></script>
  <script src="/js/pages.js?v=dev"></script>
</body>
</html>
"""


def crumbs_html(items):
    parts = []
    for i, (name, href) in enumerate(items):
        if i == len(items) - 1:
            parts.append(f'<span aria-current="page">{e(name)}</span>')
        else:
            parts.append(f'<a href="{href}">{e(name)}</a>')
    return '<nav class="crumbs" aria-label="Breadcrumb">' + ' <span aria-hidden="true">/</span> '.join(parts) + "</nav>"


def write(rel, text):
    p = WEB / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


# ---------- 버튼(프롬프트) 페이지 ----------
def prompt_page(b, lang):
    t = T[lang]
    d = b[lang]
    n = b["n"]
    name = d["name"]
    if lang == "ko":
        title = f"{name} AI 프롬프트 (복사해서 바로 쓰기) · BUTTON"
        desc = f"{d['intro']} ChatGPT·Claude·Gemini에 붙여넣기만 하면 되는 무료 AI 프롬프트. 빈칸을 채울 필요 없이 AI가 필요한 걸 먼저 물어봐요."
        h1 = f"{name} AI 프롬프트"
        eyebrow = f"BUTTON {n:02d} · AI PROMPT"
        how = "이 프롬프트를 복사해 ChatGPT, Claude, Gemini 같은 AI 채팅창에 그대로 붙여넣으세요. 미리 적을 건 없어요. AI가 아래 질문을 먼저 하고, 답하면 바로 결과를 만들어 줘요."
        h_q, h_out, h_prompt, h_rec = "AI가 먼저 물어볼 것", "받게 되는 결과", "프롬프트 전문", "이 버튼을 쓰는 레시피"
        rec_note = "여러 버튼을 순서대로 이어 쓰면 보고서·발표자료 같은 완성된 결과물을 만들 수 있어요."
        prev_l, next_l = "이전 버튼", "다음 버튼"
    else:
        title = f"{name} AI Prompt (Copy & Paste) · BUTTON"
        desc = f"{d['intro']} Free copy-paste AI prompt for ChatGPT, Claude and Gemini. No blanks to fill in: the AI asks you what it needs."
        h1 = f"{name} AI prompt"
        eyebrow = f"BUTTON {n:02d} · AI PROMPT"
        how = "Copy this prompt and paste it as is into ChatGPT, Claude, Gemini or any AI chat. Nothing to fill in first: the AI asks the questions below, and once you answer, it writes the result."
        h_q, h_out, h_prompt, h_rec = "What the AI will ask you", "What you get", "Full prompt", "Recipes that use this button"
        rec_note = "Chain several buttons in order to build finished work like reports and pitch decks."
        prev_l, next_l = "Previous button", "Next button"
    path = f"prompts/{n}/"
    crumbs = [(t["home"], "/"), (t["prompts"], url(lang, "prompts/")), (f"{n}. {name}", url(lang, path))]
    q_html = "".join(f"<li>{e(q)}</li>" for q in d["questions"])
    rec_items = []
    for rn in b["recipes"]:
        r = recipes[rn][lang]
        rec_items.append(f'<li><a href="{url(lang, f"recipes/{rn}/")}"><span class="seo-num">{t["recipe"]} {rn}</span> {e(r["name"])}</a></li>')
    rec_html = ""
    if rec_items:
        rec_html = f"""
      <section class="seo-block">
        <h2>{h_rec}</h2>
        <p class="howto-note">{rec_note}</p>
        <ul class="seo-list">{''.join(rec_items)}</ul>
      </section>"""
    pager = []
    if n > 1:
        pb = buttons[n - 1][lang]["name"]
        pager.append(f'<a class="seo-pager-prev" href="{url(lang, f"prompts/{n-1}/")}" rel="prev"><small>{prev_l}</small>{n-1:02d}. {e(pb)}</a>')
    if n < len(buttons):
        nb = buttons[n + 1][lang]["name"]
        pager.append(f'<a class="seo-pager-next" href="{url(lang, f"prompts/{n+1}/")}" rel="next"><small>{next_l}</small>{n+1:02d}. {e(nb)}</a>')
    body = f"""    <article class="container howto-inner seo-page">
      {crumbs_html(crumbs)}
      <p class="eyebrow">{eyebrow}</p>
      <h1>{e(h1)}</h1>
      <p class="howto-lead">{e(d['intro'])}</p>
      <p class="seo-how">{how}</p>
      <div class="seo-copy-row"><button type="button" class="btn btn-primary copy-btn" data-copy="p-{n}" data-n="{n}" data-source="prompt_page">{t['copy']}</button></div>

      <section class="seo-block">
        <h2>{h_q}</h2>
        <ol class="seo-questions">{q_html}</ol>
      </section>
      <section class="seo-block">
        <h2>{h_out}</h2>
        <p>{e(d['output'])}</p>
      </section>
      <section class="seo-block">
        <h2>{h_prompt}</h2>
        <pre class="prompt-text" id="p-{n}">{e(d['prompt'])}</pre>
        <div class="seo-copy-row"><button type="button" class="btn btn-ghost copy-btn" data-copy="p-{n}" data-n="{n}" data-source="prompt_page">{t['copy']}</button></div>
      </section>{rec_html}
      <nav class="seo-pager">{''.join(pager)}</nav>
    </article>
"""
    ld = [
        breadcrumbs(lang, crumbs),
        {
            "@context": "https://schema.org", "@type": "CreativeWork", "name": h1,
            "description": d["intro"], "inLanguage": lang, "url": SITE + url(lang, path),
            "isAccessibleForFree": True, "text": d["prompt"],
            "isPartOf": {"@type": "WebSite", "name": "BUTTON", "url": SITE + "/"},
        },
    ]
    write(url(lang, path).lstrip("/") + "index.html", page(lang, path, title, desc, body, ld))


# ---------- 레시피 페이지 ----------
def recipe_page(r, lang):
    t = T[lang]
    d = r[lang]
    n = r["n"]
    labels = " → ".join(s["label"] for s in d["steps"])
    k = len(d["steps"])
    if lang == "ko":
        title = f"{d['name']} | AI 프롬프트 레시피 · BUTTON"
        desc = f"AI로 {d['name']} 만들기. 프롬프트 {k}개를 순서대로: {labels}. 복사해서 ChatGPT·Claude·Gemini에 붙여넣기만 하세요."
        eyebrow = f"RECIPE {n} · {d['cat']}"
        lead = f"버튼 {k}개를 차례로 복사해 같은 AI 대화창에 붙여넣으면 끝나요. AI가 질문하면 답한 뒤 다음 버튼으로 넘어가세요."
        first_h = "먼저 준비할 답"
        first_p = f"첫 버튼을 붙여넣으면 AI가 물어봐요. 이것만 알려 주면 돼요: <strong>{e(d['first'])}</strong>"
        h_steps = "순서"
        more = "같은 분야의 다른 레시피"
        how_name = f"AI로 {d['name']} 만들기"
    else:
        title = f"{d['name']}: Step-by-Step AI Prompt Recipe · BUTTON"
        desc = f"Make a {d['name']} with AI in {k} prompts: {labels}. Copy each one into ChatGPT, Claude or Gemini."
        eyebrow = f"RECIPE {n} · {d['cat']}"
        lead = f"Copy {k} buttons in order and paste each into the same AI chat. When the AI asks questions, answer them, then move on to the next button."
        first_h = "Have this answer ready"
        first_p = f"After you paste the first button, the AI asks for this: <strong>{e(d['first'])}</strong>"
        h_steps = "Steps"
        more = "More recipes in this category"
        how_name = f"How to make a {d['name']} with AI"
    if len(desc) > 300:
        desc = desc[:297] + "…"
    path = f"recipes/{n}/"
    crumbs = [(t["home"], "/"), (t["recipes"], url(lang, "recipes/")), (f"{t['recipe']} {n}", url(lang, path))]
    steps_html = []
    for i, s in enumerate(d["steps"]):
        b = buttons[s["n"]]
        bn = b[lang]["name"]
        steps_html.append(f"""
        <li class="howto-step seo-step">
          <h3><a href="{url(lang, f"prompts/{s['n']}/")}">{t['button']} {s['n']} · {e(bn)}</a></h3>
          <p>{e(b[lang]['intro'])}</p>
          <div class="seo-step-actions">
            <button type="button" class="btn btn-primary copy-btn" data-copy="r{n}-p{i}" data-n="{s['n']}" data-source="recipe_page">{t['copyN'].format(n=s['n'])}</button>
          </div>
          <details class="seo-details"><summary>{t['see']}</summary><pre class="prompt-text" id="r{n}-p{i}">{e(b[lang]['prompt'])}</pre></details>
        </li>""")
    same = [x for x in recipes.values() if x[lang]["cat"] == d["cat"] and x["n"] != n]
    # 앞뒤 레시피 위주로 6개
    same.sort(key=lambda x: abs(x["n"] - n))
    more_html = "".join(
        f'<li><a href="{url(lang, f"recipes/{x["n"]}/")}"><span class="seo-num">{t["recipe"]} {x["n"]}</span> {e(x[lang]["name"])}</a></li>'
        for x in sorted(same[:6], key=lambda x: x["n"])
    )
    body = f"""    <article class="container howto-inner seo-page">
      {crumbs_html(crumbs)}
      <p class="eyebrow">{e(eyebrow)}</p>
      <h1>{e(d['name'])}</h1>
      <p class="howto-lead">{lead}</p>
      <section class="seo-block seo-first">
        <h2>{first_h}</h2>
        <p>{first_p}</p>
      </section>
      <h2 class="seo-steps-h">{h_steps}</h2>
      <ol class="howto-steps">{''.join(steps_html)}
      </ol>
      <section class="seo-block">
        <h2>{more}</h2>
        <ul class="seo-list">{more_html}</ul>
      </section>
    </article>
"""
    ld = [
        breadcrumbs(lang, crumbs),
        {
            "@context": "https://schema.org", "@type": "HowTo", "name": how_name,
            "description": desc, "inLanguage": lang, "url": SITE + url(lang, path),
            "supply": [{"@type": "HowToSupply", "name": d["first"]}],
            "tool": [{"@type": "HowToTool", "name": "ChatGPT, Claude, Gemini"}],
            "step": [
                {"@type": "HowToStep", "position": i + 1,
                 "name": f"{t['button']} {s['n']} · {buttons[s['n']][lang]['name']}",
                 "text": buttons[s["n"]][lang]["intro"],
                 "url": SITE + url(lang, f"prompts/{s['n']}/")}
                for i, s in enumerate(d["steps"])
            ],
        },
    ]
    write(url(lang, path).lstrip("/") + "index.html", page(lang, path, title, desc, body, ld))


# ---------- 목록 페이지 ----------
GROUPS = [
    (1, 30, "아이디어·기획", "Ideas & planning"),
    (31, 60, "분석·다듬기", "Analysis & polishing"),
    (61, 90, "결과물 만들기", "Finished documents"),
]


def prompts_index(lang):
    t = T[lang]
    if lang == "ko":
        title = "업무용 AI 프롬프트 90개 모음 (복사해서 바로 쓰기) · BUTTON"
        desc = "요약, 보고서, 기획안, 이메일, SWOT, PPT, 엑셀 수식까지. ChatGPT·Claude·Gemini에 붙여넣기만 하면 되는 무료 업무용 AI 프롬프트 90개."
        h1 = "업무용 AI 프롬프트 90개"
        lead = "빈칸 없는 프롬프트예요. 복사해서 AI 채팅창에 붙여넣으면 AI가 필요한 걸 먼저 물어봐요."
    else:
        title = "90 Copy-Paste AI Prompts for Work · BUTTON"
        desc = "Free AI prompts for summaries, reports, plans, emails, SWOT, slide decks and Excel formulas. Paste into ChatGPT, Claude or Gemini: the AI asks what it needs."
        h1 = "90 copy-paste AI prompts for work"
        lead = "No blanks to fill in. Copy a prompt, paste it into your AI chat, and the AI asks you what it needs."
    path = "prompts/"
    crumbs = [(t["home"], "/"), (t["prompts"], url(lang, path))]
    secs = []
    for a, z, gko, gen in GROUPS:
        items = "".join(
            f'<li><a href="{url(lang, f"prompts/{i}/")}"><span class="seo-num">{i:02d}</span> <strong>{e(buttons[i][lang]["name"])}</strong><small>{e(buttons[i][lang]["intro"])}</small></a></li>'
            for i in range(a, z + 1)
        )
        secs.append(f'<section class="seo-block"><h2>{a:02d}–{z:02d} · {gko if lang == "ko" else gen}</h2><ul class="seo-list seo-cards">{items}</ul></section>')
    body = f"""    <article class="container howto-inner seo-page">
      {crumbs_html(crumbs)}
      <p class="eyebrow">AI PROMPTS</p>
      <h1>{h1}</h1>
      <p class="howto-lead">{lead}</p>
      {''.join(secs)}
    </article>
"""
    ld = [breadcrumbs(lang, crumbs), {
        "@context": "https://schema.org", "@type": "CollectionPage", "name": h1, "description": desc,
        "inLanguage": lang, "url": SITE + url(lang, path),
    }]
    write(url(lang, path).lstrip("/") + "index.html", page(lang, path, title, desc, body, ld, og_type="website"))


def recipes_index(lang):
    t = T[lang]
    if lang == "ko":
        title = "AI 프롬프트 레시피 160개: 보고서·기획서·발표자료 만들기 · BUTTON"
        desc = "신사업, 마케팅, 기획, 세일즈, 인사, 데이터 업무를 AI로 끝내는 단계별 프롬프트 레시피 160개. 버튼을 순서대로 복사해 붙여넣기만 하세요."
        h1 = "AI 프롬프트 레시피 160개"
        lead = "결과물 하나를 만드는 버튼 순서예요. 차례로 복사해 같은 AI 대화창에 붙여넣으면 돼요."
    else:
        title = "160 AI Prompt Recipes for Reports, Plans and Pitch Decks · BUTTON"
        desc = "Step-by-step AI prompt recipes for strategy, marketing, product, sales, HR, operations and data work. Copy each button in order and paste it into your AI chat."
        h1 = "160 AI prompt recipes"
        lead = "Each recipe is a sequence of buttons that builds one finished deliverable. Copy them in order into the same AI chat."
    path = "recipes/"
    crumbs = [(t["home"], "/"), (t["recipes"], url(lang, path))]
    secs = []
    for cko, cen in CATS:
        cat = cko if lang == "ko" else cen
        items = "".join(
            f'<li><a href="{url(lang, f"recipes/{r["n"]}/")}"><span class="seo-num">{r["n"]}</span> {e(r[lang]["name"])}</a></li>'
            for r in recipes.values() if r["ko"]["cat"] == cko
        )
        secs.append(f'<section class="seo-block"><h2>{e(cat)}</h2><ul class="seo-list">{items}</ul></section>')
    chips = "".join(f'<a class="recipe-chip" href="#cat-{i}">{e(c[0] if lang == "ko" else c[1])}</a>' for i, c in enumerate(CATS))
    secs = [s.replace('<section class="seo-block">', f'<section class="seo-block" id="cat-{i}">', 1) for i, s in enumerate(secs)]
    body = f"""    <article class="container howto-inner seo-page">
      {crumbs_html(crumbs)}
      <p class="eyebrow">BUTTON RECIPES</p>
      <h1>{h1}</h1>
      <p class="howto-lead">{lead}</p>
      <nav class="recipe-filters seo-chips">{chips}</nav>
      {''.join(secs)}
    </article>
"""
    ld = [breadcrumbs(lang, crumbs), {
        "@context": "https://schema.org", "@type": "CollectionPage", "name": h1, "description": desc,
        "inLanguage": lang, "url": SITE + url(lang, path),
    }]
    write(url(lang, path).lstrip("/") + "index.html", page(lang, path, title, desc, body, ld, og_type="website"))


# ---------- 사이트맵 ----------
def sitemap():
    def pair(path, prio):
        out = []
        for lang in ("en", "ko"):
            out.append(f"""  <url>
    <loc>{SITE}{url(lang, path)}</loc>
    <lastmod>{TODAY}</lastmod>
    <priority>{prio}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="{SITE}{url('en', path)}"/>
    <xhtml:link rel="alternate" hreflang="ko" href="{SITE}{url('ko', path)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{url('en', path)}"/>
  </url>""")
        return out

    urls = [f"""  <url>
    <loc>{SITE}/</loc>
    <lastmod>{TODAY}</lastmod>
    <priority>1.0</priority>
  </url>""", f"""  <url>
    <loc>{SITE}/how-to-use.html</loc>
    <lastmod>{TODAY}</lastmod>
    <priority>0.6</priority>
  </url>"""]
    urls += pair("prompts/", "0.9") + pair("recipes/", "0.9")
    for n in buttons:
        urls += pair(f"prompts/{n}/", "0.7")
    for n in recipes:
        urls += pair(f"recipes/{n}/", "0.7")
    (WEB / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8")
    return len(urls)


# ---------- 첫 화면 버튼: 실제 이름 + 버튼 페이지 링크 ----------
def update_home_tiles():
    p = WEB / "index.html"
    s = p.read_text(encoding="utf-8")
    i = iter(range(1, 91))

    def rep(m):
        n = next(i)
        b = buttons[n]
        return (f'<li><a class="tile" href="/prompts/{n}/" data-ko="{e(b["ko"]["name"])}" data-en="{e(b["en"]["name"])}">'
                f'<span class="tile-num">{n:02d}</span><span class="tile-label">{e(b["en"]["name"])}</span></a></li>')

    s2 = re.sub(r'<li><a class="tile"[^>]*>.*?</a></li>', rep, s)
    p.write_text(s2, encoding="utf-8")


if __name__ == "__main__":
    for d in ("prompts", "recipes", "ko"):
        shutil.rmtree(WEB / d, ignore_errors=True)
    for lang in ("en", "ko"):
        for b in buttons.values():
            prompt_page(b, lang)
        for r in recipes.values():
            recipe_page(r, lang)
        prompts_index(lang)
        recipes_index(lang)
    count = sitemap()
    update_home_tiles()
    print(f"버튼 {len(buttons)}개, 레시피 {len(recipes)}개 × 2개 언어, 사이트맵 주소 {count}개")
