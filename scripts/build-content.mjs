// Converts the crawled WordPress HTML into framework-independent content files
// (content/pages/*.json) and downloads any media those pages reference that is
// not yet in /public. WordPress/Elementor scripts are removed; the interactions
// they provided are re-implemented in components/SiteBehaviors.tsx.
//
// Usage: node scripts/build-content.mjs <crawl-html-dir> <url-list>
import fs from "node:fs";
import path from "node:path";

const ORIGIN = "https://bridgeandvalue.com";
const htmlDir = process.argv[2] ?? "../audit/html";
const urlList = process.argv[3] ?? "../audit/raw/urls.txt";
const outDir = path.resolve("content/pages");
fs.mkdirSync(outDir, { recursive: true });

const decode = (s) =>
  s.replace(/&#8211;/g, "–").replace(/&#8217;/g, "’").replace(/&#038;/g, "&").replace(/&amp;/g, "&").replace(/&#039;/g, "'");

/** Make every bridgeandvalue.com URL root-relative (also inside escaped JSON). */
const localize = (s) =>
  s
    .replaceAll(ORIGIN + "/", "/")
    .replaceAll("https:\\/\\/bridgeandvalue.com\\/", "\\/")
    .replaceAll("http://bridgeandvalue.com/", "/")
    .replaceAll("//bridgeandvalue.com/", "/");

function parseSliders(html) {
  // Theme demo pages initialise slick sliders with inline jQuery. Capture the
  // options as data so our own slider can reproduce them.
  const sliders = [];
  for (const m of html.matchAll(/\$\('(\.[a-z0-9-]+)'\)\.slick\((\{[\s\S]*?\})\);/g)) {
    const json = m[2]
      .replace(/\/\/.*$/gm, "")
      .replace(/([{,]\s*)([A-Za-z_]+)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, "$1");
    try {
      const o = JSON.parse(json);
      sliders.push({ selector: m[1], kind: "slick", options: o });
    } catch {
      // Options containing HTML strings (custom arrows): keep the scalar options.
      const num = (k) => Number((m[2].match(new RegExp(k + "\\s*:\\s*(\\d+)")) || [])[1]) || undefined;
      const bool = (k) => (m[2].match(new RegExp(k + "\\s*:\\s*(true|false)")) || [])[1] === "true";
      const responsive = [...m[2].matchAll(/breakpoint:\s*(\d+),\s*settings:\s*\{[^}]*?slidesToShow:\s*(\d+)/g)].map((r) => ({
        breakpoint: Number(r[1]),
        settings: { slidesToShow: Number(r[2]) },
      }));
      sliders.push({
        selector: m[1],
        kind: "slick",
        options: { slidesToShow: num("slidesToShow") ?? 1, autoplay: bool("autoplay"), arrows: bool("arrows"), dots: bool("dots"), speed: num("speed") ?? 500, responsive },
      });
    }
  }
  if (/new Swiper\("\.project-active"/.test(html)) sliders.push({ selector: ".project-active", kind: "swiper-theme", options: {} });
  return sliders;
}

const assetRefs = new Set();
const pages = [];
const urls = fs.readFileSync(urlList, "utf8").trim().split(/\r?\n/);
// Public URLs that WordPress serves but does not list in its sitemap (e.g. author archive).
const extraList = path.join(path.dirname(urlList), "extra-urls.txt");
const extras = fs.existsSync(extraList) ? fs.readFileSync(extraList, "utf8").trim().split(/\r?\n/) : [];
const notInSitemap = new Set(extras.map((u) => new URL(u).pathname));

for (const url of [...urls, ...extras]) {
  const p = new URL(url).pathname; // keeps trailing slash
  let slug = p.replace(/^\/|\/$/g, "").replace(/\//g, "__") || "_front";
  const code = fs.readFileSync(path.join(htmlDir, slug + ".code"), "utf8").trim();
  if (code !== "200") continue; // template URLs that already 301 on WordPress
  const html = fs.readFileSync(path.join(htmlDir, slug + ".html"), "utf8");
  pages.push(buildPage(p, slug, html));
}

// The live 404 page (crawled from a URL that does not exist).
const notFound = fs.readFileSync("../audit/raw/rootsitemap_index.xml.out", "utf8");
pages.push(buildPage("/__404/", "_404", notFound));

function buildPage(p, slug, html) {
  const head = html.slice(0, html.indexOf("</head>"));
  const get = (re) => (head.match(re) || [])[1];
  const stylesheets = [...head.matchAll(/<link rel='stylesheet' id='([^']+)'[^>]*href='([^']+)'/g)].map((m) => {
    const href = decode(m[2]);
    return href.startsWith(ORIGIN) ? localize(href.split("?")[0]) : href.startsWith("//") ? "https:" + href : href;
  });
  const inlineStyles = [...head.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]
    .filter((m) => !/emoji/.test(m[1]))
    .map((m) => localize(m[2]))
    .join("\n");

  const bodyOpen = html.match(/<body([^>]*)>/);
  const bodyClass = (bodyOpen[1].match(/class="([^"]*)"/) || [])[1] || "";
  let body = html.slice(html.indexOf(bodyOpen[0]) + bodyOpen[0].length, html.lastIndexOf("</body>"));

  const sliders = parseSliders(body);
  body = body
    .replace(/<script\b[\s\S]*?<\/script>/g, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/g, "")
    .replace(/<link rel='stylesheet'[^>]*>/g, "") // late-enqueued styles are hoisted below
    .replace(/<!--[\s\S]*?-->/g, "");
  // Late-enqueued stylesheets in the body (animations, widget CSS)
  for (const m of html.slice(html.indexOf("</head>")).matchAll(/<link rel='stylesheet' id='[^']+'[^>]*href='([^']+)'/g)) {
    const href = localize(decode(m[1]).split("?")[0]);
    if (!stylesheets.includes(href)) stylesheets.push(href);
  }
  body = localize(body);

  for (const m of body.matchAll(/(?:src|href|data-background|srcset|data-src)="([^"]+)"/g)) {
    for (const part of m[1].split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (/^\/(wp-content|wp-includes)\/.+\.(png|jpe?g|gif|svg|webp|pdf|mp4|ico)$/i.test(u)) assetRefs.add(u);
    }
  }
  for (const m of body.matchAll(/url\((?:&quot;|'|")?(\/wp-content\/[^)'"&]+)/g)) assetRefs.add(m[1]);

  const page = {
    path: p,
    title: decode(get(/<title>([^<]*)<\/title>/) || ""),
    canonical: get(/<link rel="canonical" href="([^"]+)"/) || null,
    robots: get(/<meta name='robots' content='([^']+)'/) || null,
    bodyClass,
    stylesheets,
    inlineStyles,
    sliders,
    html: body.trim(),
  };
  fs.writeFileSync(path.join(outDir, slug + ".json"), JSON.stringify(page));
  return { path: p, slug, title: page.title };
}

// Download any referenced media that is not already mirrored.
let fetched = 0, missing = [];
for (const rel of assetRefs) {
  const out = path.join("public", decodeURIComponent(rel));
  if (fs.existsSync(out)) continue;
  const res = await fetch(ORIGIN + rel, { headers: { "user-agent": "Mozilla/5.0 bridgeandvalue-migration" } });
  if (!res.ok) { missing.push(`${res.status} ${rel}`); continue; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  fetched++;
}

fs.writeFileSync(
  "content/index.json",
  JSON.stringify(
    pages.filter((x) => x.slug !== "_404").map(({ path, slug, title }) => ({ path, slug, title, sitemap: !notInSitemap.has(path) })),
    null,
    2
  )
);
console.log(`pages=${pages.length} asset-refs=${assetRefs.size} newly-downloaded=${fetched} missing=${missing.length}`);
if (missing.length) console.log(missing.join("\n"));
