import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDate } from "./format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const [c] = await sql<{ pages: number; drafts: number; edited: number; newq: number; total: number; media: number; noalt: number; nodesc: number; redirects: number; posts: number; postdrafts: number }>(`
    SELECT (SELECT count(*)::int FROM pages WHERE kind <> 'system') AS pages,
           (SELECT count(*)::int FROM pages WHERE status = 'draft') AS drafts,
           (SELECT count(DISTINCT page_id)::int FROM blocks WHERE content IS NOT NULL) AS edited,
           (SELECT count(*)::int FROM submissions WHERE status = 'new') AS newq,
           (SELECT count(*)::int FROM submissions) AS total,
           (SELECT count(*)::int FROM media) AS media,
           (SELECT count(*)::int FROM media WHERE alt_text = '' AND mime_type LIKE 'image/%') AS noalt,
           (SELECT count(*)::int FROM pages WHERE status = 'published' AND kind = ANY('{page,service}') AND coalesce(meta_description,'') = '') AS nodesc,
           (SELECT count(*)::int FROM redirects) AS redirects,
           (SELECT count(*)::int FROM posts WHERE status = 'published') AS posts,
           (SELECT count(*)::int FROM posts WHERE status = 'draft') AS postdrafts`);
  const recent = await sql<{ id: number; form: string; fields: Record<string, string>; created_at: string; status: string }>(
    `SELECT id, form, fields, created_at, status FROM submissions ORDER BY created_at DESC LIMIT 5`
  );
  const activity = await sql<{ action: string; entity: string; entity_id: string; created_at: string; name: string | null }>(
    `SELECT a.action, a.entity, a.entity_id, a.created_at, u.name FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 6`
  );

  return (
    <>
      {denied && <div className="notice warn">That area is for administrators only.</div>}
      <div className="pagehead">
        <div>
          <h1>Welcome, {user.name.split(" ")[0]}</h1>
          <div className="sub">Manage the Bridge &amp; Value website: content, enquiries, media and SEO.</div>
        </div>
      </div>

      <div className="grid k4" style={{ marginBottom: 16 }}>
        <Link className="card stat" href="/admin/enquiries/?status=new"><div className="n">{c.newq}</div><div className="l">New enquiries · {c.total} total</div></Link>
        <Link className="card stat" href="/admin/pages/"><div className="n">{c.pages}</div><div className="l">Pages &amp; services · {c.edited} edited{c.drafts ? ` · ${c.drafts} draft` : ""}</div></Link>
        <Link className="card stat" href="/admin/media/?filter=noalt"><div className="n">{c.media}</div><div className="l">Media files · {c.noalt} without alt text</div></Link>
        <Link className="card stat" href="/admin/posts/"><div className="n">{c.posts}</div><div className="l">Blog posts{c.postdrafts ? ` · ${c.postdrafts} draft${c.postdrafts > 1 ? "s" : ""}` : ""}</div></Link>
        <Link className="card stat" href="/admin/seo/"><div className="n">{c.nodesc}</div><div className="l">Pages missing a meta description</div></Link>
      </div>

      <div className="grid k2">
        <div className="card">
          <div className="row"><h2>Latest enquiries</h2><span className="spacer" /><Link href="/admin/enquiries/">View all</Link></div>
          <table className="list">
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className={s.status === "new" ? "unread" : ""}>
                  <td><Link href={`/admin/enquiries/${s.id}/`}>{s.fields.name || s.fields.email || "(no name)"}</Link><div className="muted small">{(s.fields.subject || s.fields.message || "").slice(0, 60)}</div></td>
                  <td className="muted small" style={{ whiteSpace: "nowrap" }}>{fmtDate(s.created_at)}</td>
                </tr>
              ))}
              {!recent.length && <tr><td className="muted">No enquiries yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="row"><h2>Recent activity</h2><span className="spacer" />{user.role === "admin" && <Link href="/admin/activity/">View all</Link>}</div>
          <table className="list">
            <tbody>
              {activity.map((a, i) => (
                <tr key={i}><td>{a.name ?? "System"} {a.action} <span className="muted">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ""}</span></td><td className="muted small" style={{ whiteSpace: "nowrap" }}>{fmtDate(a.created_at)}</td></tr>
              ))}
              {!activity.length && <tr><td className="muted">No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
