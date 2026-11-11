// Mirrors every stylesheet the crawled WordPress pages load (plus the fonts and
// images those stylesheets reference) into /public, keeping the original
// /wp-content/... paths so relative url(...) references keep working.
// Usage: node scripts/mirror-assets.mjs <crawl-html-dir>
import fs from "node:fs";
import path from "node:path";

const ORIGIN = "https://bridgeandvalue.com";
const htmlDir = process.argv[2] ?? "../audit/html";
const publicDir = path.resolve("public");

const queue = new Set();
for (const f of fs.readdirSync(htmlDir).filter((f) => f.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(htmlDir, f), "utf8");
  for (const m of html.matchAll(/<link rel='stylesheet'[^>]*href='([^']+)'/g)) {
    const u = m[1].replace(/&#038;/g, "&");
    if (u.startsWith(ORIGIN)) queue.add(u.split("?")[0]);
  }
}

const done = new Set();
let ok = 0, fail = 0;
async function fetchTo(url) {
  if (done.has(url)) return;
  done.add(url);
  const rel = new URL(url).pathname;
  const out = path.join(publicDir, decodeURIComponent(rel));
  if (!fs.existsSync(out)) {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 bridgeandvalue-migration" } });
    if (!res.ok) { fail++; console.warn("FAIL", res.status, url); return; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    ok++;
  }
  if (out.endsWith(".css")) {
    const css = fs.readFileSync(out, "utf8");
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const ref = m[1].trim();
      if (ref.startsWith("data:") || ref.startsWith("#")) continue;
      const abs = new URL(ref, url);
      if (abs.origin !== ORIGIN) continue;
      await fetchTo(abs.origin + abs.pathname);
    }
  }
}

for (const u of queue) await fetchTo(u);

// Absolute https://bridgeandvalue.com/... references inside the CSS must become
// root-relative so the new site never loads anything from the old server.
let rewritten = 0;
for (const u of done) {
  const out = path.join(publicDir, decodeURIComponent(new URL(u).pathname));
  if (!out.endsWith(".css") || !fs.existsSync(out)) continue;
  const css = fs.readFileSync(out, "utf8");
  const local = css.replaceAll(ORIGIN + "/", "/").replaceAll("http://bridgeandvalue.com/", "/");
  if (local !== css) { fs.writeFileSync(out, local); rewritten++; }
}
console.log(`css files localized=${rewritten}`);
console.log(`stylesheets=${queue.size} downloaded=${ok} failed=${fail} total-seen=${done.size}`);
