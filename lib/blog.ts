import "server-only";
import { cache } from "react";
import { one, sql, type PageRow } from "./db";
import { renderHtml, sanitizeHtml, spliceElement } from "./blocks.mjs";
import { SITE_URL, type RenderedPage } from "./cms";
import { getSettings } from "./db";

/*
 * Blog, archives, search and admin-created pages.
 *
 * These have no WordPress original, so they are built from the Gerow theme's
 * own blog markup and CSS classes (blog-post-item-two, blog-details-wrap,
 * blog-widget, rc-post-item, pagination-wrap, breadcrumb-area) and placed in
 * the real site shell (header, footer, menu) taken from the migrated /blog/ page.
 */

export const POSTS_PER_PAGE = 10; // WordPress "Blog pages show at most" setting

export type Post = {
  id: number; slug: string; title: string; excerpt: string; content_html: string; featured_image: string | null; featured_alt: string;
  status: "draft" | "published"; published_at: string | null; author_id: number | null; author_name: string | null;
  meta_title: string | null; meta_description: string | null; noindex: boolean; updated_at: string;
};
export type Term = { id: number; taxonomy: "category" | "tag"; name: string; slug: string; description: string; count?: number };

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const postPath = (slug: string) => `/${slug}/`;
export const termPath = (t: Pick<Term, "taxonomy" | "slug">) => `/${t.taxonomy}/${t.slug}/`;
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Europe/Paris" }) : "";
export const plainText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
export const excerptOf = (p: Pick<Post, "excerpt" | "content_html">, words = 30) => {
  if (p.excerpt.trim()) return p.excerpt.trim();
  // Prefer paragraph text so headings don't run into the summary.
  const paras = [...p.content_html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => plainText(m[1])).filter(Boolean).join(" ");
  const w = (paras || plainText(p.content_html)).split(" ");
  return w.slice(0, words).join(" ") + (w.length > words ? "…" : "");
};

const LIVE = `p.status = 'published' AND p.published_at <= now()`;
const POST_COLS = `p.*, u.name AS author_name`;

/* ---------------- Data ---------------- */

export const getPostBySlug = cache(async (slug: string, includeDrafts = false) =>
  one<Post>(`SELECT ${POST_COLS} FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.slug = $1 ${includeDrafts ? "" : `AND ${LIVE}`}`, [slug])
);

export async function getPostById(id: number) {
  return one<Post>(`SELECT ${POST_COLS} FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.id = $1`, [id]);
}

export async function listPosts(opts: { termId?: number; q?: string; page?: number } = {}) {
  const where = [LIVE];
  const params: unknown[] = [];
  if (opts.termId) { params.push(opts.termId); where.push(`EXISTS (SELECT 1 FROM post_terms pt WHERE pt.post_id = p.id AND pt.term_id = $${params.length})`); }
  if (opts.q) { params.push(`%${opts.q}%`); where.push(`(p.title ILIKE $${params.length} OR p.content_html ILIKE $${params.length} OR p.excerpt ILIKE $${params.length})`); }
  const page = Math.max(1, opts.page ?? 1);
  const total = (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM posts p WHERE ${where.join(" AND ")}`, params))[0].n;
  const posts = await sql<Post>(
    `SELECT ${POST_COLS} FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE ${where.join(" AND ")}
     ORDER BY p.published_at DESC LIMIT ${POSTS_PER_PAGE} OFFSET ${(page - 1) * POSTS_PER_PAGE}`,
    params
  );
  return { posts, total, page, pages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)) };
}

export async function termsForPosts(ids: number[]) {
  if (!ids.length) return new Map<number, Term[]>();
  const rows = await sql<Term & { post_id: number }>(
    `SELECT pt.post_id, t.* FROM post_terms pt JOIN terms t ON t.id = pt.term_id WHERE pt.post_id = ANY($1) ORDER BY t.taxonomy, t.name`,
    [ids]
  );
  const map = new Map<number, Term[]>();
  for (const r of rows) map.set(r.post_id, [...(map.get(r.post_id) ?? []), r]);
  return map;
}

export const getTerm = cache(async (taxonomy: string, slug: string) =>
  one<Term>(`SELECT * FROM terms WHERE taxonomy = $1 AND slug = $2`, [taxonomy, slug])
);

export async function categoriesWithCounts() {
  return sql<Term & { count: number }>(
    `SELECT t.*, (SELECT count(*)::int FROM post_terms pt JOIN posts p ON p.id = pt.post_id WHERE pt.term_id = t.id AND ${LIVE}) AS count
       FROM terms t WHERE t.taxonomy = 'category' ORDER BY t.name`
  );
}

/* ---------------- Theme markup ---------------- */

function postCard(p: Post, terms: Term[]) {
  const url = postPath(p.slug);
  const cat = terms.find((t) => t.taxonomy === "category");
  const thumb = p.featured_image
    ? `<div class="blog-post-thumb-two"><a href="${url}"><img src="${esc(p.featured_image)}" alt="${esc(p.featured_alt || p.title)}" loading="lazy" style="width:100%;height:auto"></a>${cat ? `<a href="${termPath(cat)}" class="tag">${esc(cat.name)}</a>` : ""}</div>`
    : "";
  return `<article class="blog-post-item-two${p.featured_image ? " has-post-thumbnail" : ""}">
  ${thumb}
  <div class="blog-post-content-two">
    <h2 class="title"><a href="${url}">${esc(p.title)}</a></h2>
    <p>${esc(excerptOf(p))}</p>
    <div class="blog-meta"><ul class="list-wrap">
      ${p.author_name ? `<li><i class="far fa-user"></i> ${esc(p.author_name)}</li>` : ""}
      <li><i class="far fa-calendar"></i> ${fmt(p.published_at)}</li>
      ${!p.featured_image && cat ? `<li class="category"><i class="far fa-folder"></i> <a href="${termPath(cat)}">${esc(cat.name)}</a></li>` : ""}
    </ul></div>
  </div>
</article>`;
}

function pagination(base: string, page: number, pages: number, query = "") {
  if (pages <= 1) return "";
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`) + query;
  const items: string[] = [];
  if (page > 1) items.push(`<li class="page-item"><a class="page-link" href="${href(page - 1)}" aria-label="Previous page"><i class="fas fa-angle-double-left"></i></a></li>`);
  for (let n = 1; n <= pages; n++) {
    items.push(n === page
      ? `<li class="page-item active"><span class="page-link" aria-current="page">${n}</span></li>`
      : `<li class="page-item"><a class="page-link" href="${href(n)}">${n}</a></li>`);
  }
  if (page < pages) items.push(`<li class="page-item"><a class="page-link" href="${href(page + 1)}" aria-label="Next page"><i class="fas fa-angle-double-right"></i></a></li>`);
  return `<div class="pagination-wrap mt-30"><nav aria-label="Posts"><ul class="pagination list-wrap">${items.join("")}</ul></nav></div>`;
}

const searchForm = (q = "") =>
  `<div class="sidebar-search position-relative"><form action="/" method="get"><input type="text" value="${esc(q)}" required name="s" placeholder="Search" aria-label="Search"><button type="submit" aria-label="Search"><i class="flaticon-search"></i></button></form></div>`;

async function sidebar(q = "") {
  const [cats, recent] = await Promise.all([categoriesWithCounts(), listPosts({ page: 1 })]);
  const used = cats.filter((c) => (c.count ?? 0) > 0);
  const catList = used.length
    ? used.map((c) => `<li class="cat-item"><a href="${termPath(c)}">${esc(c.name)} (${c.count})</a></li>`).join("")
    : `<li class="cat-item-none">No categories</li>`;
  const rc = recent.posts.slice(0, 3).map((p) => `<div class="rc-post-item">
      ${p.featured_image ? `<div class="thumb"><a href="${postPath(p.slug)}"><img src="${esc(p.featured_image)}" alt="${esc(p.featured_alt || p.title)}" loading="lazy"></a></div>` : ""}
      <div class="content"><span class="date"><i class="far fa-calendar"></i>${fmt(p.published_at)}</span><h4 class="title"><a href="${postPath(p.slug)}">${esc(p.title)}</a></h4></div>
    </div>`).join("");
  return `<aside class="blog-sidebar">
  <div class="blog-widget widget widget_search"><h4 class="bw-title">Search Here</h4>${searchForm(q)}</div>
  <div class="blog-widget widget widget_categories"><h4 class="bw-title">Categories</h4><ul>${catList}</ul></div>
  <div class="blog-widget widget widget_genix-latest-posts"><h4 class="bw-title"> Most Popular </h4><div class="rc-post-wrap">${rc}</div></div>
</aside>`;
}

const nothingFound = (q = "") => `<section class="no-results not-found">
  <header class="page-header"><h1 class="page-title blog-search-title">Nothing Found</h1></header>
  <div class="pageontent blog-search-content mt-20 mb-10">
    <p>${q ? "Sorry, but nothing matched your search terms. Please try again with some different keywords." : "It seems we can&rsquo;t find what you&rsquo;re looking for. Perhaps searching can help."}</p>
    ${searchForm(q)}
  </div>
</section>`;

const blogSection = (main: string, side: string) => `<section class="blog-area pt-120 pb-120">
  <div class="container"><div class="inner-blog-wrap"><div class="row justify-content-center">
    <div class="col-71"><div class="blog-item-wrap">${main}</div></div>
    <div class="col-29">${side}</div>
  </div></div></div>
</section>`;

const pageTitleBanner = (title: string, crumbs: { label: string; href?: string }[], image?: string | null) => `<section class="breadcrumb-area breadcrumb-bg" data-background="${esc(image || "/wp-content/uploads/2024/02/bg02.jpg")}">
  <div class="container"><div class="row"><div class="col-lg-12"><div class="breadcrumb-content">
    <h1 class="title">${esc(title)}</h1>
    <nav aria-label="breadcrumb"><ol class="breadcrumb">${crumbs
      .map((c) => (c.href ? `<li class="breadcrumb-item"><a href="${c.href}">${esc(c.label)}</a></li>` : `<li class="breadcrumb-item active" aria-current="page">${esc(c.label)}</li>`))
      .join("")}</ol></nav>
  </div></div></div></div>
</section>`;

/* ---------------- Shell ---------------- */

const getShell = cache(async () => {
  const blog = await one<PageRow>(`SELECT * FROM pages WHERE path = '/blog/'`);
  if (!blog) throw new Error("The /blog/ page is missing from the database; run npm run db:import.");
  return blog;
});

async function inShell(
  section: string,
  meta: { path: string; title: string; description?: string | null; canonical?: string | null; robots?: string; bodyClass?: string; menuPath?: string }
): Promise<RenderedPage> {
  const shell = await getShell();
  const [globalBlocks, menu, media, settings] = await Promise.all([
    sql<{ element_id: string; widget_type: string; content: unknown }>(`SELECT element_id, widget_type, content FROM blocks WHERE page_id IS NULL AND content IS NOT NULL`),
    sql<{ label: string; url: string; new_tab: boolean }>(`SELECT label, url, new_tab FROM menu_items WHERE menu = 'main' ORDER BY position`),
    sql<{ path: string; alt_text: string }>(`SELECT path, alt_text FROM media WHERE alt_text <> ''`),
    getSettings(),
  ]);
  const html = renderHtml(
    spliceElement(shell.html, 'class="blog-area pt-120 pb-120"', () => section),
    { pageBlocks: [], globalBlocks, menu, altByPath: new Map(media.map((m) => [m.path, m.alt_text])), currentPath: meta.menuPath ?? meta.path }
  );
  return {
    ...shell,
    id: -1,
    path: meta.path,
    title: meta.title,
    meta_description: meta.description ?? null,
    canonical: meta.canonical ?? null,
    robots: meta.robots ?? "max-image-preview:large",
    body_class: meta.bodyClass ?? shell.body_class,
    html,
    sliders: [],
  };
}

const suffix = " – Bridge and Value";

/* ---------------- Public renderers ---------------- */

export async function renderBlogIndex(page = 1): Promise<RenderedPage | null> {
  const { posts, pages } = await listPosts({ page });
  if (page > 1 && page > pages) return null;
  const terms = await termsForPosts(posts.map((p) => p.id));
  const main = posts.length ? posts.map((p) => postCard(p, terms.get(p.id) ?? [])).join("") + pagination("/blog/", page, pages) : nothingFound();
  const shell = await getShell();
  return inShell(blogSection(main, await sidebar()), {
    path: page > 1 ? `/blog/page/${page}/` : "/blog/",
    title: page > 1 ? `Blog – Page ${page}${suffix}` : shell.title,
    description: shell.meta_description,
    menuPath: "/blog/",
  });
}

export async function renderTermArchive(taxonomy: "category" | "tag", slug: string, page = 1): Promise<RenderedPage | null> {
  const term = await getTerm(taxonomy, slug);
  if (!term) return null;
  const { posts, pages } = await listPosts({ termId: term.id, page });
  if (page > 1 && page > pages) return null;
  const terms = await termsForPosts(posts.map((p) => p.id));
  const heading = `<header class="page-header mb-40"><h1 class="page-title">${taxonomy === "category" ? "Category" : "Tag"}: ${esc(term.name)}</h1>${term.description ? `<p>${esc(term.description)}</p>` : ""}</header>`;
  const base = termPath(term);
  const main = heading + (posts.length ? posts.map((p) => postCard(p, terms.get(p.id) ?? [])).join("") + pagination(base, page, pages) : nothingFound());
  return inShell(blogSection(main, await sidebar()), {
    path: page > 1 ? `${base}page/${page}/` : base,
    title: `${term.name}${suffix}`,
    description: term.description || null,
    robots: posts.length ? "max-image-preview:large" : "noindex, follow",
    bodyClass: `archive ${taxonomy} wp-theme-gerow elementor-kit-6`,
    menuPath: "/blog/",
  });
}

export async function renderSearch(q: string, page = 1): Promise<RenderedPage> {
  const query = q.trim().slice(0, 100);
  const { posts, total, pages } = query ? await listPosts({ q: query, page }) : { posts: [], total: 0, pages: 1 };
  const pageHits = query
    ? await sql<{ path: string; title: string; meta_description: string | null }>(
        // Search each page's own content (its editable blocks or rich text), not the shared header/footer.
        `SELECT p.path, p.title, p.meta_description FROM pages p
          WHERE p.status = 'published' AND p.kind IN ('page','service','custom')
            AND (p.title ILIKE $1 OR coalesce(p.content_html,'') ILIKE $1 OR coalesce(p.meta_description,'') ILIKE $1
                 OR EXISTS (SELECT 1 FROM blocks b WHERE b.page_id = p.id
                            AND (coalesce(b.content, b.original)->>'html' ILIKE $1 OR (coalesce(b.content, b.original)->'texts')::text ILIKE $1)))
          ORDER BY (p.title ILIKE $1) DESC, array_position(ARRAY['service','page','custom'], p.kind), p.path LIMIT 10`,
        [`%${query}%`]
      )
    : [];
  const terms = await termsForPosts(posts.map((p) => p.id));
  const pagesHtml = pageHits.length && page === 1
    ? `<div class="blog-widget mb-40"><h4 class="bw-title">Pages</h4><ul class="list-wrap">${pageHits
        .map((h) => `<li class="mb-10"><a href="${h.path}"><strong>${esc(h.title.replace(suffix, ""))}</strong></a>${h.meta_description ? `<br><span>${esc(h.meta_description)}</span>` : ""}</li>`)
        .join("")}</ul></div>`
    : "";
  const heading = `<header class="page-header mb-40"><h1 class="page-title blog-search-title">${query ? `Search results for: ${esc(query)}` : "Search"}</h1></header>`;
  const main = !query || (!posts.length && !pageHits.length)
    ? nothingFound(query)
    : heading + pagesHtml + posts.map((p) => postCard(p, terms.get(p.id) ?? [])).join("") + pagination("/search/", page, pages, `?s=${encodeURIComponent(query)}`);
  return inShell(blogSection(main, await sidebar(query)), {
    path: "/search/",
    title: `${query ? `Search Results for “${query}”` : "Search"}${suffix}`,
    robots: "noindex, follow",
    bodyClass: "search search-results wp-theme-gerow elementor-kit-6",
    menuPath: "",
  }).then((r) => ({ ...r, meta_description: total ? `${total} posts found` : null }));
}

export async function renderPost(slug: string, includeDrafts = false): Promise<RenderedPage | null> {
  const p = await getPostBySlug(slug, includeDrafts);
  if (!p) return null;
  const terms = (await termsForPosts([p.id])).get(p.id) ?? [];
  const cats = terms.filter((t) => t.taxonomy === "category");
  const tags = terms.filter((t) => t.taxonomy === "tag");
  const url = postPath(p.slug);
  const share = encodeURIComponent(SITE_URL + url);
  const main = `<div class="blog-post-item-two blog-details-wrap">
  ${p.featured_image ? `<div class="blog-post-thumb-two blog-details-thumb"><img src="${esc(p.featured_image)}" alt="${esc(p.featured_alt || p.title)}" style="width:100%;height:auto">${cats[0] ? `<a href="${termPath(cats[0])}" class="tag">${esc(cats[0].name)}</a>` : ""}</div>` : ""}
  <div class="blog-post-content-two blog-details-content">
    <h1 class="title">${esc(p.title)}</h1>
    <div class="blog-meta"><ul class="list-wrap">
      ${p.author_name ? `<li><i class="far fa-user"></i> ${esc(p.author_name)}</li>` : ""}
      <li><i class="far fa-calendar"></i> ${fmt(p.published_at)}</li>
      ${cats.length ? `<li class="category"><i class="far fa-folder"></i> ${cats.map((c) => `<a href="${termPath(c)}">${esc(c.name)}</a>`).join(", ")}</li>` : ""}
    </ul></div>
    <div class="post-text entry-content">${sanitizeHtml(p.content_html)}</div>
    <div class="blog-details-bottom">
      <div class="row align-items-center">
        <div class="col-lg-7">${tags.length ? `<div class="post-tags"><h5 class="title">Tags:</h5><ul class="list-wrap">${tags.map((t) => `<li><a href="${termPath(t)}">${esc(t.name)}</a></li>`).join("")}</ul></div>` : ""}</div>
        <div class="col-lg-5"><div class="blog-details-social"><h5 class="title">Share:</h5><ul class="list-wrap">
          <li><a href="https://www.linkedin.com/sharing/share-offsite/?url=${share}" target="_blank" rel="noopener" aria-label="Share on LinkedIn"><i class="fab fa-linkedin-in"></i></a></li>
          <li><a href="https://twitter.com/intent/tweet?url=${share}" target="_blank" rel="noopener" aria-label="Share on X"><i class="fab fa-twitter"></i></a></li>
          <li><a href="https://www.facebook.com/sharer/sharer.php?u=${share}" target="_blank" rel="noopener" aria-label="Share on Facebook"><i class="fab fa-facebook-f"></i></a></li>
        </ul></div></div>
      </div>
    </div>
  </div>
</div>`;
  const r = await inShell(blogSection(main, await sidebar()), {
    path: url,
    title: `${p.meta_title || p.title}${suffix}`,
    description: p.meta_description || excerptOf(p, 28),
    canonical: SITE_URL + url,
    robots: p.noindex || p.status !== "published" ? "noindex, follow" : "max-image-preview:large",
    bodyClass: `post-template-default single single-post postid-${p.id} wp-theme-gerow elementor-kit-6`,
    menuPath: "/blog/",
  });
  return { ...r, post: p } as RenderedPage & { post: Post };
}

/** Pages created in the admin: theme page-title banner + rich content. */
export async function renderCustomPage(page: PageRow): Promise<RenderedPage> {
  const title = page.title.replace(suffix, "");
  const section = `${pageTitleBanner(title, [{ label: "Home", href: "/" }, { label: title }], page.hero_image)}
<section class="custom-page-area pt-120 pb-120"><div class="container"><div class="row justify-content-center"><div class="col-lg-10">
  <div class="entry-content blog-details-content">${sanitizeHtml(page.content_html ?? "")}</div>
</div></div></div></section>`;
  const r = await inShell(section, {
    path: page.path,
    title: page.title,
    description: page.meta_description,
    canonical: page.canonical,
    robots: page.robots ?? "max-image-preview:large",
    bodyClass: `page-template-default page page-id-${page.id} wp-theme-gerow elementor-kit-6`,
  });
  return { ...r, ...{ id: page.id, status: page.status, updated_at: page.updated_at } };
}
