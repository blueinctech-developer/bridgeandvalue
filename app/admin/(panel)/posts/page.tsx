import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDate } from "../format";
import Notice from "../Notice";

export const metadata = { title: "Blog posts" };

export default async function Posts({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; ok?: string; err?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const where: string[] = [];
  const params: unknown[] = [];
  if (status === "published") where.push(`p.status = 'published' AND p.published_at <= now()`);
  if (status === "scheduled") where.push(`p.status = 'published' AND p.published_at > now()`);
  if (status === "draft") where.push(`p.status = 'draft'`);
  if (sp.q) { params.push(`%${sp.q}%`); where.push(`(p.title ILIKE $${params.length} OR p.slug ILIKE $${params.length})`); }
  const rows = await sql<{ id: number; slug: string; title: string; status: string; published_at: string | null; updated_at: string; author: string | null; cats: string | null }>(
    `SELECT p.id, p.slug, p.title, p.status, p.published_at, p.updated_at, u.name AS author,
            (SELECT string_agg(t.name, ', ' ORDER BY t.name) FROM post_terms pt JOIN terms t ON t.id = pt.term_id WHERE pt.post_id = p.id AND t.taxonomy = 'category') AS cats
       FROM posts p LEFT JOIN users u ON u.id = p.author_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY coalesce(p.published_at, p.updated_at) DESC`,
    params
  );
  const state = (r: (typeof rows)[number]) =>
    r.status === "draft" ? <span className="badge amber">Draft</span> : r.published_at && new Date(r.published_at) > new Date() ? <span className="badge blue">Scheduled</span> : <span className="badge green">Published</span>;
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Blog posts</h1>
          <div className="sub">Posts appear on <a href="/blog/" target="_blank" rel="noopener">/blog/</a> at their own address, e.g. /my-post-title/ (the same style WordPress used).</div>
        </div>
        <Link className="btn" href="/admin/posts/new/">New post</Link>
      </div>
      <Notice sp={sp} />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="filters" style={{ margin: 0 }}>
          {[["all", "All"], ["published", "Published"], ["scheduled", "Scheduled"], ["draft", "Drafts"]].map(([k, l]) => (
            <Link key={k} href={`/admin/posts/?status=${k}`} className={status === k ? "on" : ""}>{l}</Link>
          ))}
        </div>
        <span className="spacer" />
        <form className="row" action="/admin/posts/">
          <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search posts" aria-label="Search posts" style={{ width: 220 }} />
          <button className="btn secondary small" type="submit">Search</button>
        </form>
      </div>
      <table className="list">
        <thead><tr><th>Title</th><th>Categories</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/admin/posts/${r.id}/`}><strong>{r.title}</strong></Link><div className="muted small mono">/{r.slug}/</div></td>
              <td className="small">{r.cats ?? <span className="muted">—</span>}</td>
              <td>{state(r)}</td>
              <td className="small muted">{r.published_at ? fmtDate(r.published_at) : `Edited ${fmtDate(r.updated_at)}`}{r.author ? <div>by {r.author}</div> : null}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={4} className="muted">No posts yet. The WordPress blog had none either. <Link href="/admin/posts/new/">Write the first post</Link>.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
