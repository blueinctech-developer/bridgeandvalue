// Imports the migrated WordPress content into the database. Safe to re-run:
// pages are upserted by path, existing block edits are kept, and media,
// menu, redirects and legacy enquiries are only inserted when missing.
//
// Usage: node scripts/import-wordpress.mjs
import fs from "node:fs";
import path from "node:path";
import { getClient } from "../lib/db/client.mjs";
import { extractBlocks } from "../lib/blocks.mjs";

const db = await getClient();
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const index = read("content/index.json");
const exp = read("content/wordpress-export/pages-templates.json");
const spf = read("content/wordpress-export/services-projects-footers.json");
const wpIdBySlug = new Map([...exp.pages, ...spf.services, ...spf.project].map((p) => [p.slug, p.id]));

const kindOf = (p) =>
  p.startsWith("/services/") ? "service" : p.startsWith("/project/") ? "project" : p.startsWith("/project-cat/") ? "project-cat" : p.startsWith("/author/") ? "author" : "page";

let pagesN = 0, blocksN = 0, globalN = 0;
const entries = [...index.map((e) => ({ ...e })), { path: "/__404/", slug: "_404", title: "Page not found", sitemap: false, system: true }];
for (const e of entries) {
  const c = read(path.join("content/pages", e.slug + ".json"));
  const slug = e.path.split("/").filter(Boolean).pop() ?? "";
  const kind = e.system ? "system" : kindOf(e.path);
  const { rows } = await db.query(
    `INSERT INTO pages (path, slug, kind, title, canonical, robots, in_sitemap, body_class, stylesheets, inline_styles, sliders, html, wp_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (path) DO UPDATE SET body_class=EXCLUDED.body_class, stylesheets=EXCLUDED.stylesheets,
       inline_styles=EXCLUDED.inline_styles, sliders=EXCLUDED.sliders, html=EXCLUDED.html
     RETURNING id`,
    [e.path, slug || "home", kind, c.title, c.canonical, c.robots, e.sitemap !== false && !e.system, c.bodyClass,
     JSON.stringify(c.stylesheets), c.inlineStyles, JSON.stringify(c.sliders), c.html, wpIdBySlug.get(slug || "home-three") ?? null]
  );
  const pageId = rows[0].id;
  pagesN++;
  const { page, global } = extractBlocks(c.html);
  for (const b of page) {
    await db.query(
      `INSERT INTO blocks (page_id, element_id, widget_type, position, label, original) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (COALESCE(page_id, 0), element_id) DO UPDATE SET position=EXCLUDED.position, label=EXCLUDED.label, original=EXCLUDED.original, widget_type=EXCLUDED.widget_type`,
      [pageId, b.element_id, b.widget_type, b.position, b.label, JSON.stringify(b.original)]
    );
    blocksN++;
  }
  if (e.path === "/") {
    for (const b of global) {
      await db.query(
        `INSERT INTO blocks (page_id, element_id, widget_type, position, label, original) VALUES (NULL,$1,$2,$3,$4,$5)
         ON CONFLICT (COALESCE(page_id, 0), element_id) DO UPDATE SET position=EXCLUDED.position, label=EXCLUDED.label, original=EXCLUDED.original`,
        [b.element_id, b.widget_type, b.position, b.label, JSON.stringify(b.original)]
      );
      globalN++;
    }
  }
}

// Media library (all 244 WordPress items)
let mediaN = 0;
for (const m of read("content/wordpress-export/media.json").media) {
  const p = "/wp-content/uploads/" + m.source_url.split("/wp-content/uploads/")[1];
  const r = await db.query(
    `INSERT INTO media (path, mime_type, width, height, filesize, title, alt_text, caption, source, wp_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'wordpress',$9,$10) ON CONFLICT (path) DO NOTHING RETURNING id`,
    [p, m.mime_type, m.width ?? null, m.height ?? null, m.filesize ?? null, m.title ?? "", m.alt_text ?? "", (m.caption ?? "").replace(/<[^>]+>/g, "").trim(), m.id, m.date]
  );
  mediaN += r.rows.length;
}

// Main menu
const menuCount = (await db.query(`SELECT count(*)::int AS n FROM menu_items`)).rows[0].n;
if (!menuCount) {
  const items = read("content/wordpress-export/site-media-menus.json").menuItems.sort((a, b) => a.order - b.order);
  for (const [i, it] of items.entries()) {
    await db.query(`INSERT INTO menu_items (menu, label, url, position, new_tab) VALUES ('main',$1,$2,$3,$4)`, [
      it.title, it.url.replace("https://bridgeandvalue.com", ""), i + 1, it.target === "_blank",
    ]);
  }
}

// Redirects that exist on the WordPress site today
for (const r of read("docs/migration/redirects.json")) {
  await db.query(`INSERT INTO redirects (source, destination, status_code, note) VALUES ($1,$2,$3,$4) ON CONFLICT (source) DO NOTHING`, [
    r.source, r.destination, r.permanent ? 301 : 302, r.reason,
  ]);
}

// Legacy contact enquiries (personal data; file is git-ignored)
let subsN = 0;
const legacyFile = "data/legacy/form-submissions.json";
if (fs.existsSync(legacyFile)) {
  const keyMap = { field_6f4576e: "phone", field_0827996: "subject" };
  for (const s of read(legacyFile).submissions) {
    const fields = Object.fromEntries(s.values.map((v) => [keyMap[v.key] ?? v.key, v.value]));
    const r = await db.query(
      `INSERT INTO submissions (form, page, fields, status, email_sent, legacy_id, created_at)
       VALUES ('contact',$1,$2,'new',$3,$4,$5) ON CONFLICT (legacy_id) DO NOTHING RETURNING id`,
      [s.page ? new URL(s.page).pathname : "/contact-us/", JSON.stringify(fields), s.email_sent, s.id, s.created_at_gmt + "Z"]
    );
    subsN += r.rows.length;
  }
}

// Default settings (values observed on the WordPress site)
const defaults = {
  site: { name: "Bridge and Value", titleSuffix: " – Bridge and Value" },
  contact: { email: "contact@bridgeandvalue.com", address: "66 Avenue des Champs Elysees, 75008, Paris" },
  seo: { googleVerification: "OMDGm6o2idh3POa7LE0hnOmdlS_oFOVA5Apd-fMJ7o4" },
  popup: { enabled: true, delaySeconds: 5 },
  notifications: { recipient: "contact@bridgeandvalue.com" },
};
for (const [k, v] of Object.entries(defaults)) {
  await db.query(`INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, [k, JSON.stringify(v)]);
}

const count = async (t) => (await db.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
console.log(`pages upserted=${pagesN} page-blocks=${blocksN} global-blocks=${globalN} new-media=${mediaN} new-legacy-enquiries=${subsN}`);
console.log(`totals: pages=${await count("pages")} blocks=${await count("blocks")} media=${await count("media")} menu=${await count("menu_items")} redirects=${await count("redirects")} submissions=${await count("submissions")}`);
await db.close();
