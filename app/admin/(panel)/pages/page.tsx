import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDate, KIND_LABEL } from "../format";
import Notice from "../Notice";

export const metadata = { title: "Pages & services" };

const KINDS = [
  { k: "main", label: "Main pages" },
  { k: "service", label: "Services" },
  { k: "custom", label: "New pages" },
  { k: "demo", label: "Theme demo pages" },
  { k: "all", label: "All" },
];
const MAIN = ["/", "/about-us/", "/our-services/", "/business-mission/", "/contact-us/", "/blog/"];

export default async function PagesList({ searchParams }: { searchParams: Promise<{ kind?: string; q?: string; ok?: string; err?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const kind = sp.kind ?? "main";
  const q = (sp.q ?? "").trim();
  const where: string[] = ["p.kind <> 'system'"];
  const params: unknown[] = [];
  if (kind === "main") { params.push(MAIN); where.push(`p.path = ANY($${params.length})`); }
  if (kind === "service") where.push(`p.kind = 'service'`);
  if (kind === "custom") where.push(`p.kind = 'custom'`);
  if (kind === "demo") { params.push(MAIN); where.push(`p.kind NOT IN ('service','custom') AND NOT (p.path = ANY(${params.length}))`); }
  if (q) { params.push(`%${q}%`); where.push(`(p.title ILIKE $${params.length} OR p.path ILIKE $${params.length})`); }
  const rows = await sql<{ id: number; path: string; title: string; kind: string; status: string; meta_description: string | null; updated_at: string; edited: number; blocks: number; editor: string | null }>(
    `SELECT p.id, p.path, p.title, p.kind, p.status, p.meta_description, p.updated_at, u.name AS editor,
            (SELECT count(*)::int FROM blocks b WHERE b.page_id = p.id AND b.content IS NOT NULL) AS edited,
            (SELECT count(*)::int FROM blocks b WHERE b.page_id = p.id) AS blocks
       FROM pages p LEFT JOIN users u ON u.id = p.updated_by
      WHERE ${where.join(" AND ")}
      ORDER BY array_position($${params.length + 1}::text[], p.path) NULLS LAST, p.kind, p.path`,
    [...params, MAIN]
  );

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Pages &amp; services</h1>
          <div className="sub">Edit page text, links, images and SEO. Changes go live as soon as you save.</div>
        </div>
        <Link className="btn" href="/admin/pages/new/">New page</Link>
      </div>
      <Notice sp={sp} />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="filters" style={{ margin: 0 }}>
          {KINDS.map((k) => (
            <Link key={k.k} href={`/admin/pages/?kind=${k.k}`} className={kind === k.k ? "on" : ""}>{k.label}</Link>
          ))}
        </div>
        <span className="spacer" />
        <form className="row" action="/admin/pages/">
          <input type="hidden" name="kind" value="all" />
          <input type="search" name="q" defaultValue={q} placeholder="Search title or URL" aria-label="Search pages" style={{ width: 220 }} />
          <button className="btn secondary small" type="submit">Search</button>
        </form>
      </div>
      <table className="list">
        <thead>
          <tr><th>Page</th><th>Type</th><th>Status</th><th>Content</th><th>Last change</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/admin/pages/${r.id}/`}><strong>{r.title.replace(/ – Bridge and Value$/, "")}</strong></Link>
                <div className="muted small mono">{r.path}</div>
              </td>
              <td className="small">{KIND_LABEL[r.kind] ?? r.kind}</td>
              <td>{r.status === "published" ? <span className="badge green">Published</span> : <span className="badge amber">Draft</span>}{!r.meta_description && r.status === "published" && (r.kind === "page" || r.kind === "service") && <div><span className="badge">No description</span></div>}</td>
              <td className="small">{r.kind === "custom" ? "Rich text" : <>{r.blocks} blocks</>}{r.edited ? <> · <span className="badge blue">{r.edited} edited</span></> : null}</td>
              <td className="small muted">{fmtDate(r.updated_at)}{r.editor ? <div>by {r.editor}</div> : null}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="muted">No pages match.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
