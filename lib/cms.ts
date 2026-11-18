import "server-only";
import { cache } from "react";
import { one, sql, type BlockRow, type PageRow } from "./db";
import { renderHtml } from "./blocks.mjs";

export const SITE_URL = "https://bridgeandvalue.com";

export type RenderedPage = Omit<PageRow, "html"> & { html: string };

/** Published page by URL path, with all edits applied. */
export const getRenderedPage = cache(async (path: string, { includeDrafts = false } = {}): Promise<RenderedPage | null> => {
  const page = await one<PageRow>(`SELECT * FROM pages WHERE path = $1 AND kind <> 'system'`, [path]);
  if (!page || (page.status !== "published" && !includeDrafts)) return null;
  if (page.kind === "custom") return (await import("./blog")).renderCustomPage(page);
  return render(page);
});

export const getNotFoundPage = cache(async () => {
  const page = await one<PageRow>(`SELECT * FROM pages WHERE path = '/__404/'`);
  return page ? render(page) : null;
});

async function render(page: PageRow): Promise<RenderedPage> {
  const [pageBlocks, globalBlocks, menu, media] = await Promise.all([
    sql<BlockRow>(`SELECT element_id, widget_type, content FROM blocks WHERE page_id = $1 AND content IS NOT NULL`, [page.id]),
    sql<BlockRow>(`SELECT element_id, widget_type, content FROM blocks WHERE page_id IS NULL AND content IS NOT NULL`),
    sql<{ label: string; url: string; new_tab: boolean }>(`SELECT label, url, new_tab FROM menu_items WHERE menu = 'main' ORDER BY position`),
    sql<{ path: string; alt_text: string }>(`SELECT path, alt_text FROM media WHERE alt_text <> ''`),
  ]);
  const html = renderHtml(page.html, {
    pageBlocks,
    globalBlocks,
    menu,
    altByPath: new Map(media.map((m) => [m.path, m.alt_text])),
    currentPath: page.path,
  });
  return { ...page, html };
}

export async function listPublicPaths() {
  return sql<{ path: string; updated_at: string }>(
    `SELECT path, updated_at FROM pages WHERE status = 'published' AND kind <> 'system'
     UNION ALL SELECT '/' || slug || '/', updated_at FROM posts WHERE status = 'published' AND published_at <= now()`
  );
}

/** Everything that belongs in sitemap.xml (WordPress listed pages, posts and used categories). */
export async function listSitemapPages() {
  return sql<{ path: string; updated_at: string }>(
    `SELECT path, updated_at FROM pages WHERE status = 'published' AND in_sitemap AND kind <> 'system'
     UNION ALL
     SELECT '/' || slug || '/', updated_at FROM posts WHERE status = 'published' AND published_at <= now() AND NOT noindex
     UNION ALL
     SELECT '/' || t.taxonomy || '/' || t.slug || '/', max(p.updated_at) FROM terms t
       JOIN post_terms pt ON pt.term_id = t.id JOIN posts p ON p.id = pt.post_id
      WHERE p.status = 'published' AND p.published_at <= now() GROUP BY t.taxonomy, t.slug`
  );
}
