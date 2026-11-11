// Editable content blocks for migrated Elementor pages.
//
// Each Elementor widget (element with data-widget_type) becomes a block whose
// editable fields are extracted from the migrated markup:
//   - texts:  every visible text node, in document order
//   - links:  every <a href>
//   - images: every <img> (src + alt)
//   - html:   for rich-text widgets (text-editor), the widget's inner HTML
// Edits are stored separately and re-applied to the original markup at render
// time, so the design stays identical to the original site.
import { parse } from "node-html-parser";

/** Widgets that are not content (or are managed elsewhere, e.g. forms). */
const SKIP = new Set(["shortcode.default", "spacer.default", "google_maps.default", "form.default", "html.default", "site-logo.default", "copyright.default"]);
const RICH = new Set(["text-editor.default"]);
const SKIP_TEXT_PARENTS = new Set(["script", "style", "svg", "noscript", "textarea"]);

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const decode = (s) =>
  String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘");

function textNodes(el) {
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        if (c.rawText.trim()) out.push(c);
      } else if (c.nodeType === 1 && !SKIP_TEXT_PARENTS.has(c.rawTagName?.toLowerCase())) {
        walk(c);
      }
    }
  };
  walk(el);
  return out;
}

const container = (w) => w.querySelector(".elementor-widget-container") ?? w;

function fieldsOf(widget, type) {
  if (RICH.has(type)) return { html: container(widget).innerHTML.trim() };
  return {
    texts: textNodes(widget).map((t) => decode(t.rawText.trim())),
    links: widget.querySelectorAll("a[href]").map((a) => ({ href: a.getAttribute("href") ?? "" })),
    images: widget.querySelectorAll("img").map((i) => ({ src: i.getAttribute("src") ?? "", alt: decode(i.getAttribute("alt") ?? "") })),
  };
}

function labelOf(type, fields) {
  const name = type.replace(/\.default$/, "").replace(/^tg-/, "").replace(/-/g, " ");
  const sample = fields.html ? fields.html.replace(/<[^>]+>/g, " ") : (fields.texts ?? []).join(" ");
  const s = decode(sample).replace(/\s+/g, " ").trim().slice(0, 70);
  return s ? `${name}: ${s}` : name;
}

/**
 * Extract blocks from a page's migrated HTML.
 * @returns {{ page: Block[], global: Block[] }} global = footer widgets (shared by every page)
 */
export function extractBlocks(html) {
  const root = parse(html, { comment: false });
  const footer = root.querySelector("footer");
  const page = [], global = [];
  let pos = 0;
  for (const w of root.querySelectorAll("[data-widget_type]")) {
    const type = w.getAttribute("data-widget_type");
    const id = w.getAttribute("data-id");
    if (!id || SKIP.has(type)) continue;
    const fields = fieldsOf(w, type);
    const empty = !fields.html && !fields.texts?.length && !fields.links?.length && !fields.images?.length;
    if (empty) continue;
    const inFooter = footer && isInside(w, footer);
    (inFooter ? global : page).push({ element_id: id, widget_type: type, position: pos++, label: labelOf(type, fields), original: fields });
  }
  return { page, global };
}

function isInside(node, ancestor) {
  for (let n = node; n; n = n.parentNode) if (n === ancestor) return true;
  return false;
}

/** Strip anything executable from editor-supplied rich text. */
export function sanitizeHtml(html) {
  const root = parse(String(html), { comment: false });
  for (const bad of root.querySelectorAll("script, style, iframe, object, embed, form, input, button, link, meta")) bad.remove();
  for (const el of root.querySelectorAll("*")) {
    for (const attr of Object.keys(el.attributes)) {
      const v = String(el.getAttribute(attr) ?? "");
      if (/^on/i.test(attr) || ((attr === "href" || attr === "src") && /^\s*(javascript|data|vbscript):/i.test(v))) el.removeAttribute(attr);
    }
  }
  return root.toString();
}

function applyToWidget(w, type, content) {
  if (RICH.has(type)) {
    if (typeof content.html === "string") container(w).set_content(sanitizeHtml(content.html));
    return;
  }
  if (Array.isArray(content.texts)) {
    textNodes(w).forEach((t, i) => {
      const v = content.texts[i];
      if (typeof v !== "string") return;
      const lead = t.rawText.match(/^\s*/)[0], trail = t.rawText.match(/\s*$/)[0];
      t.rawText = lead + escapeHtml(v) + trail;
    });
  }
  if (Array.isArray(content.links)) {
    w.querySelectorAll("a[href]").forEach((a, i) => {
      const href = content.links[i]?.href;
      if (typeof href === "string" && !/^\s*(javascript|data|vbscript):/i.test(href)) a.setAttribute("href", href);
    });
  }
  if (Array.isArray(content.images)) {
    w.querySelectorAll("img").forEach((img, i) => {
      const c = content.images[i];
      if (!c) return;
      if (typeof c.src === "string" && c.src && c.src !== img.getAttribute("src")) {
        img.setAttribute("src", c.src);
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
      }
      if (typeof c.alt === "string") img.setAttribute("alt", c.alt);
    });
  }
}

/** Index range [start, end) of the element whose opening tag contains `marker`. */
function elementRange(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.lastIndexOf("<", at);
  const tag = (html.slice(start + 1).match(/^([a-zA-Z0-9]+)/) || [])[1];
  if (!tag) return null;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, "gi");
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[2] === "/") continue; // self-closing
    depth += m[1] ? -1 : 1;
    if (depth === 0) return [start, m.index + m[0].length];
  }
  return null;
}

/** Replace one element (found by an attribute marker) with the result of fn(fragmentHtml). */
export function spliceElement(html, marker, fn) {
  const r = elementRange(html, marker);
  if (!r) return html;
  return html.slice(0, r[0]) + fn(html.slice(r[0], r[1])) + html.slice(r[1]);
}

/**
 * Render a page: apply global (footer) and page block edits, the main menu,
 * and media alt text to the migrated markup.
 *
 * Edits are spliced into the original string element by element: only the
 * edited widget is parsed and re-serialised. Re-serialising the whole page
 * would let the parser "repair" WordPress's unbalanced markup differently
 * from a browser and change the layout.
 * @param {string} html
 * @param {{ pageBlocks: {element_id:string, widget_type:string, content:any}[], globalBlocks: any[], menu?: {label:string,url:string,new_tab:boolean}[], altByPath?: Map<string,string>, currentPath?: string }} o
 */
export function renderHtml(html, o) {
  let out = html;
  for (const b of [...o.globalBlocks, ...o.pageBlocks]) {
    if (!b.content) continue;
    out = spliceElement(out, `data-id="${b.element_id}"`, (frag) => {
      const root = parse(frag, { comment: false });
      const w = root.querySelector(`[data-id="${b.element_id}"]`);
      if (!w) return frag;
      applyToWidget(w, b.widget_type, b.content);
      return root.toString();
    });
  }
  if (o.menu) {
    const items = o.menu
      .map((m) => {
        const current = o.currentPath && m.url === o.currentPath;
        // Same classes/attributes WordPress printed, so the theme styles them identically.
        const cls = `menu-item menu-item-type-post_type menu-item-object-page${current ? " current-menu-item current_page_item active" : ""} nav-item`;
        const target = m.new_tab ? ' target="_blank" rel="noopener"' : "";
        const label = escapeHtml(m.label);
        return `<li itemscope="itemscope" itemtype="https://www.schema.org/SiteNavigationElement" class="${cls}"><a title="${label.replace(/"/g, "&quot;")}" href="${escapeHtml(m.url).replace(/"/g, "&quot;")}" class="nav-links"${target}${current ? ' aria-current="page"' : ""}>${label}</a></li>`;
      })
      .join("");
    out = spliceElement(out, 'id="menu-main-menu"', (frag) => frag.slice(0, frag.indexOf(">") + 1) + items + "</ul>");
  }
  if (o.altByPath?.size) {
    out = out.replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = tag.match(/\salt="([^"]*)"/);
      if (alt && alt[1].trim()) return tag; // never overwrite an explicit alt
      const src = ((tag.match(/\ssrc="([^"]*)"/) || [])[1] || "").split("?")[0];
      const base = src.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "").replace(/-scaled(?=\.[a-z0-9]+$)/i, "");
      const value = o.altByPath.get(src) ?? o.altByPath.get(base);
      if (!value) return tag;
      const attr = `alt="${escapeHtml(value).replace(/"/g, "&quot;")}"`;
      return alt ? tag.replace(/\salt="[^"]*"/, " " + attr) : tag.replace(/^<img\b/i, "<img " + attr);
    });
  }
  return out;
}
