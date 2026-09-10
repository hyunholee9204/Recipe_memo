/* =========================================================
   레시피 노트 — 정적 페이지 생성기
   content/site.json + content/recipes.json + content/pages/*.html
   → recipes/*.html, *.html, sitemap.xml, robots.txt
   실행: npm run build
   ========================================================= */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");

const site = JSON.parse(readFileSync(join(CONTENT, "site.json"), "utf8"));
const recipes = JSON.parse(readFileSync(join(CONTENT, "recipes.json"), "utf8"));

/* `--base <url>` 로 배포 주소를 덮어쓸 수 있다. (로컬 미리보기: --base http://localhost:8765)
   지정하지 않으면 content/site.json 의 url(실서비스 주소)을 쓴다. */
const baseArgIdx = process.argv.indexOf("--base");
if (baseArgIdx !== -1 && process.argv[baseArgIdx + 1]) {
  site.url = process.argv[baseArgIdx + 1];
}

const BASE = site.url.replace(/\/$/, "");
const AD_SLOT_PLACEHOLDER = "0000000000";

/* 템플릿에서는 내부 링크를 항상 루트 절대경로(href="/styles.css")로 쓰고,
   여기서 파일 위치(depth)에 맞는 상대경로로 바꾼다.
   이렇게 하면 file:// 로 열든, 로컬 서버 루트든, GitHub Pages 프로젝트 경로
   (/Recipe_memo/)든, 커스텀 도메인이든 어디서나 CSS·링크가 살아난다.
   depth 0 = 저장소 루트 페이지(about.html 등), depth 1 = recipes/ 안. */
function relativize(html, depth) {
  const prefix = "../".repeat(depth);
  return html.replace(/\b(href|src)="\/(?!\/)([^"]*)"/g, (_m, a, path) => {
    const rel = path === "" ? prefix || "./" : prefix + path;
    return `${a}="${rel}"`;
  });
}

/* ---------- 유틸 ---------- */
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const attr = esc;

function abs(href) {
  if (/^https?:/.test(href)) return href;
  return BASE + (href.startsWith("/") ? href : "/" + href);
}

function isoDuration(minutes) {
  const m = Number(minutes) || 0;
  return "PT" + m + "M";
}

/* ---------- 공통 셸 ---------- */
function shell({ title, description, canonical, bodyClass = "", main, jsonLd = [], activeHref }) {
  const fullTitle = title === site.name ? title : `${title} · ${site.name}`;
  const nav = site.nav
    .map((n) => {
      const active = n.href === activeHref ? ' aria-current="page"' : "";
      return `<a href="${attr(n.href)}"${active}>${esc(n.label)}</a>`;
    })
    .join("\n          ");
  const legal = site.legalNav
    .map((n) => `<a href="${attr(n.href)}">${esc(n.label)}</a>`)
    .join("\n          ");
  const ld = jsonLd
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join("\n  ");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${attr(description)}" />
  <link rel="canonical" href="${attr(canonical)}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${attr(site.name)}" />
  <meta property="og:title" content="${attr(fullTitle)}" />
  <meta property="og:description" content="${attr(description)}" />
  <meta property="og:url" content="${attr(canonical)}" />
  <meta property="og:locale" content="${attr(site.locale)}" />
  <meta name="twitter:card" content="summary" />

  <!-- Google AdSense -->
  <meta name="google-adsense-account" content="${attr(site.adsenseClient)}" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
    site.adsenseClient
  )}" crossorigin="anonymous"></script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Nanum+Myeongjo:wght@400;700;800&display=swap"
    rel="stylesheet"
  />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8D%B3%3C/text%3E%3C/svg%3E" />
  ${ld}
</head>
<body class="${bodyClass}">
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-brand" href="/recipes/">
        <span class="site-brand__mark">🍳</span>
        <span class="site-brand__text">
          <strong>${esc(site.name)}</strong>
          <small>${esc(site.tagline)}</small>
        </span>
      </a>
      <nav class="site-nav" aria-label="주요 메뉴">
          ${nav}
      </nav>
    </div>
  </header>

  <main class="page">
${main}
  </main>

  <footer class="site-footer">
    <div class="site-footer__inner">
      <p class="site-footer__brand">${esc(site.name)}</p>
      <nav class="site-footer__nav" aria-label="사이트 정보">
          ${legal}
      </nav>
      <p class="site-footer__note">
        © 2026 ${esc(site.name)}. 레시피 글과 이미지의 무단 전재를 금합니다.
        데이터는 이용자 브라우저에만 저장됩니다.
      </p>
    </div>
  </footer>

  <script src="/site.js"></script>
</body>
</html>
`;
}

/* ---------- 광고 유닛 ---------- */
function adUnit(kind = "display") {
  const common = `data-ad-client="${attr(site.adsenseClient)}" data-ad-slot="${AD_SLOT_PLACEHOLDER}"`;
  const ins =
    kind === "in-article"
      ? `<ins class="adsbygoogle" style="display:block;text-align:center" ${common} data-ad-layout="in-article" data-ad-format="fluid"></ins>`
      : `<ins class="adsbygoogle" style="display:block" ${common} data-ad-format="auto" data-full-width-responsive="true"></ins>`;
  return `      <aside class="ad-slot" aria-label="광고" hidden>
        <span class="ad-slot__label">광고</span>
        ${ins}
      </aside>`;
}

/* ---------- 레시피 상세 ---------- */
function recipePage(r) {
  const canonical = `${BASE}/recipes/${r.slug}.html`;
  const related = recipes
    .filter((x) => x.slug !== r.slug && x.category === r.category)
    .slice(0, 3);
  const relatedFallback =
    related.length < 3
      ? recipes.filter((x) => x.slug !== r.slug && !related.includes(x)).slice(0, 3 - related.length)
      : [];
  const relatedList = [...related, ...relatedFallback];

  const intro = r.intro.map((p) => `        <p>${esc(p)}</p>`).join("\n");
  const ingredients = r.ingredients
    .map(
      (i) =>
        `          <li><span class="ing__name">${esc(i.item)}</span><span class="ing__amt">${esc(
          i.amount
        )}</span></li>`
    )
    .join("\n");
  const steps = r.steps.map((s) => `          <li>${esc(s)}</li>`).join("\n");
  const tips = r.tips.map((t) => `          <li>${esc(t)}</li>`).join("\n");
  const faq = r.faq
    .map(
      (f) =>
        `        <details class="faq__item">\n          <summary>${esc(
          f.q
        )}</summary>\n          <p>${esc(f.a)}</p>\n        </details>`
    )
    .join("\n");
  const tags = r.tags
    .map((t) => `<li>#${esc(t)}</li>`)
    .join("");

  const relatedCards = relatedList
    .map(
      (x) =>
        `        <li><a href="/recipes/${attr(x.slug)}.html"><span class="rel__cat">${esc(
          x.category
        )}</span><span class="rel__title">${esc(x.title)}</span></a></li>`
    )
    .join("\n");

  const recipeLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: r.title,
    description: r.summary,
    datePublished: r.published,
    dateModified: r.updated,
    author: { "@type": "Organization", name: site.author },
    recipeCategory: r.category,
    recipeYield: r.servings,
    totalTime: isoDuration(r.time),
    keywords: r.tags.join(", "),
    recipeIngredient: r.ingredients.map((i) => `${i.item} ${i.amount}`.trim()),
    recipeInstructions: r.steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      text: s,
    })),
    mainEntityOfPage: canonical,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "레시피", item: `${BASE}/recipes/` },
      { "@type": "ListItem", position: 2, name: r.title, item: canonical },
    ],
  };
  const faqLd = r.faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: r.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  const main = `    <article class="recipe">
      <nav class="breadcrumb" aria-label="위치">
        <a href="/recipes/">레시피</a> <span aria-hidden="true">›</span> <span>${esc(r.title)}</span>
      </nav>

      <header class="recipe__head">
        <p class="recipe__cat">${esc(r.category)}</p>
        <h1>${esc(r.title)}</h1>
        <p class="recipe__summary">${esc(r.summary)}</p>
        <ul class="recipe__facts">
          <li><span>분량</span>${esc(r.servings)}</li>
          <li><span>조리시간</span>약 ${esc(String(r.time))}분</li>
          <li><span>난이도</span>${esc(r.difficulty)}</li>
        </ul>
        <p class="recipe__dates">최초 작성 ${esc(r.published)} · 마지막 수정 ${esc(r.updated)}</p>
      </header>

      <section class="recipe__intro">
${intro}
      </section>

${adUnit("in-article")}

      <div class="recipe__cols">
        <section class="recipe__ingredients">
          <h2>재료 <small>${esc(r.servings)} 기준</small></h2>
          <ul class="ing-list">
${ingredients}
          </ul>
        </section>

        <section class="recipe__steps">
          <h2>만드는 법</h2>
          <ol class="step-list">
${steps}
          </ol>
        </section>
      </div>

      <section class="recipe__tips">
        <h2>실패하지 않는 팁</h2>
        <ul class="tip-list">
${tips}
        </ul>
      </section>

      ${
        r.faq.length
          ? `<section class="recipe__faq">
        <h2>자주 묻는 질문</h2>
${faq}
      </section>`
          : ""
      }

      <ul class="tag-row">${tags}</ul>

      <section class="related">
        <h2>비슷한 레시피</h2>
        <ul class="rel-list">
${relatedCards}
        </ul>
      </section>

      <p class="recipe__back"><a href="/recipes/">← 전체 레시피 보기</a></p>
    </article>`;

  return shell({
    title: r.title,
    description: r.summary,
    canonical,
    bodyClass: "is-article",
    main,
    activeHref: "/recipes/",
    jsonLd: [recipeLd, breadcrumbLd, ...(faqLd ? [faqLd] : [])],
  });
}

/* ---------- 레시피 목록 ---------- */
function recipesIndex() {
  const canonical = `${BASE}/recipes/`;
  const byCategory = {};
  for (const r of recipes) (byCategory[r.category] ||= []).push(r);

  const cards = recipes
    .slice()
    .sort((a, b) => (a.title > b.title ? 1 : -1))
    .map(
      (r) => `        <li class="rcard">
          <a href="/recipes/${attr(r.slug)}.html">
            <span class="rcard__cat">${esc(r.category)}</span>
            <span class="rcard__title">${esc(r.title)}</span>
            <span class="rcard__summary">${esc(r.summary)}</span>
            <span class="rcard__facts">${esc(r.servings)} · 약 ${esc(String(r.time))}분 · ${esc(
        r.difficulty
      )}</span>
          </a>
        </li>`
    )
    .join("\n");

  const catList = Object.keys(byCategory)
    .map((c) => `<li>${esc(c)} <b>${byCategory[c].length}</b></li>`)
    .join("");

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "레시피 노트 전체 레시피",
    itemListElement: recipes.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}/recipes/${r.slug}.html`,
      name: r.title,
    })),
  };

  const main = `    <div class="recipes-index">
      <header class="section-head">
        <h1>레시피</h1>
        <p>
          재료가 적게 들고 설거지가 덜 나오는, 매일 해 먹기 좋은 집밥 레시피를 직접 만들어 보고 정리합니다.
          현재 ${recipes.length}개의 레시피가 있습니다.
        </p>
        <ul class="cat-counts">${catList}</ul>
      </header>

${adUnit("display")}

      <ul class="rcard-grid">
${cards}
      </ul>

      <p class="section-foot">
        처음이라면 <a href="/guide.html">자취 요리 시작 가이드</a>부터 읽어 보세요.
      </p>
    </div>`;

  return shell({
    title: "레시피",
    description:
      "자취생을 위한 집밥 레시피 모음. 재료가 적고 간단한 한식 위주 레시피를 직접 만들어 보고 계량과 시간을 확인해 정리합니다.",
    canonical,
    main,
    activeHref: "/recipes/",
    jsonLd: [itemListLd],
  });
}

/* ---------- 일반 페이지 ---------- */
function contentPage(file) {
  const raw = readFileSync(join(CONTENT, "pages", file), "utf8");
  const m = raw.match(/^<!--\s*([\s\S]*?)-->\s*/);
  const meta = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const mm = line.match(/^\s*([a-z]+)\s*:\s*(.+?)\s*$/i);
      if (mm) meta[mm[1].toLowerCase()] = mm[2];
    }
  }
  const body = raw.slice(m ? m[0].length : 0).trim();
  const slug = file.replace(/\.html$/, "");
  const href = "/" + file;
  const canonical = `${BASE}/${file}`;
  const activeHref = site.nav.some((n) => n.href === href) ? href : undefined;

  const webPageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: meta.title || slug,
    description: meta.description || site.description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: site.name, url: BASE + "/" },
  };

  const main = `    <div class="prose">
${body
  .split("\n")
  .map((l) => "      " + l)
  .join("\n")}
    </div>`;

  return shell({
    title: meta.title || slug,
    description: meta.description || site.description,
    canonical,
    main,
    activeHref,
    jsonLd: [webPageLd],
  });
}

/* ---------- sitemap / robots ---------- */
function sitemap() {
  const urls = [
    { loc: `${BASE}/`, priority: "0.9" },
    { loc: `${BASE}/recipes/`, priority: "0.9" },
    { loc: `${BASE}/guide.html`, priority: "0.7" },
    { loc: `${BASE}/about.html`, priority: "0.4" },
    { loc: `${BASE}/privacy.html`, priority: "0.2" },
    { loc: `${BASE}/terms.html`, priority: "0.2" },
    { loc: `${BASE}/contact.html`, priority: "0.3" },
    ...recipes.map((r) => ({
      loc: `${BASE}/recipes/${r.slug}.html`,
      lastmod: r.updated,
      priority: "0.8",
    })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>${
          u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""
        }\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function robots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`;
}

/* ---------- 실행 ---------- */
const recipesDir = join(ROOT, "recipes");
if (existsSync(recipesDir)) rmSync(recipesDir, { recursive: true, force: true });
mkdirSync(recipesDir, { recursive: true });

let count = 0;
for (const r of recipes) {
  writeFileSync(join(recipesDir, `${r.slug}.html`), relativize(recipePage(r), 1));
  count++;
}
writeFileSync(join(recipesDir, "index.html"), relativize(recipesIndex(), 1));

const pageFiles = readdirSync(join(CONTENT, "pages")).filter((f) => f.endsWith(".html"));
for (const f of pageFiles) {
  writeFileSync(join(ROOT, f), relativize(contentPage(f), 0));
}

writeFileSync(join(ROOT, "sitemap.xml"), sitemap());
writeFileSync(join(ROOT, "robots.txt"), robots());

console.log(`✓ 레시피 ${count}개 + 목록 1개`);
console.log(`✓ 일반 페이지 ${pageFiles.length}개: ${pageFiles.join(", ")}`);
console.log(`✓ sitemap.xml, robots.txt`);
console.log(`  base URL: ${BASE}`);
