import "server-only";
import { cache } from "react";
import { one } from "./db";
import { getRenderedPage, type RenderedPage } from "./cms";
import { renderBlogIndex, renderPost, renderTermArchive, type Post } from "./blog";

export type Resolved = RenderedPage & { post?: Post };

const pageNum = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : NaN);

/**
 * Resolve a public URL to rendered content. Order mirrors WordPress:
 * pages → blog index/pagination → category/tag archives → posts (/%postname%/).
 */
export const resolvePath = cache(async (segments: string[]): Promise<Resolved | null> => {
  const s = segments.map(decodeURIComponent);
  const path = s.length ? `/${s.join("/")}/` : "/";

  if (path === "/blog/") {
    const hasPosts = await one(`SELECT 1 FROM posts WHERE status = 'published' AND published_at <= now() LIMIT 1`);
    // With no posts, serve the migrated WordPress /blog/ page unchanged.
    return hasPosts ? renderBlogIndex(1) : getRenderedPage(path);
  }

  const page = await getRenderedPage(path);
  if (page) return page;

  if (s[0] === "blog" && s[1] === "page" && s.length === 3) {
    const n = pageNum(s[2]);
    return n >= 2 ? renderBlogIndex(n) : null;
  }
  if ((s[0] === "category" || s[0] === "tag") && (s.length === 2 || (s.length === 4 && s[2] === "page"))) {
    const n = s.length === 4 ? pageNum(s[3]) : 1;
    return n >= 1 ? renderTermArchive(s[0], s[1], n) : null;
  }
  if (s.length === 1) return renderPost(s[0]);
  return null;
});
