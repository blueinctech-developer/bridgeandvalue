import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { KIND_LABEL } from "../format";

export const metadata = { title: "SEO overview" };

export default async function Seo() {
  await requireUser();
  const pages = await sql<{ id: number; path: string; title: string; kind: string; meta_description: string | null; canonical: string | null; robots: string | null; in_sitemap: boolean; status: string }>(
    `SELECT id, path, title, kind, meta_description, canonical, robots, in_sitemap, status FROM pages WHERE kind <> 'system' ORDER BY kind <> 'page', kind, path`
  );
  const [m] = await sql<{ noalt: number; images: number }>(
    `SELECT count(*) FILTER (WHERE alt_text = '')::int AS noalt, count(*)::int AS images FROM media WHERE mime_type LIKE 'image/%'`
  );
  const issues = (p: (typeof pages)[number]) => {
    const out: string[] = [];
    if (p.status !== "published") return ["Draft"];
    if (!p.meta_description) out.push("No meta description");
    else if (p.meta_description.length < 70 || p.meta_description.length > 170) out.push("Description length");
    if (p.title.length > 65) out.push("Long title");
    if ((p.robots ?? "").includes("noindex")) out.push("noindex");
    if (!p.in_sitemap) out.push("Not in sitemap");
    return out;
  };
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>SEO overview</h1>
          <div className="sub">Titles, descriptions and indexing for every URL. URLs, titles and canonicals were kept exactly as on WordPress.</div>
        </div>
        <div className="row">
          <a className="btn secondary" href="/sitemap.xml" target="_blank" rel="noopener">sitemap.xml ↗</a>
          <a className="btn secondary" href="/robots.txt" target="_blank" rel="noopener">robots.txt ↗</a>
        </div>
      </div>
      <div className="notice warn">
        {m.noalt} of {m.images} images have no alt text. <Link href="/admin/media/?filter=noalt">Add alt text in Media</Link>; it is applied automatically wherever the image is used without one.
      </div>
      <table className="list">
        <thead><tr><th>Page</th><th>Title</th><th>Meta description</th><th>Checks</th></tr></thead>
        <tbody>
          {pages.map((p) => {
            const list = issues(p);
            return (
              <tr key={p.id}>
                <td><Link href={`/admin/pages/${p.id}/`} className="mono small">{p.path}</Link><div className="muted small">{KIND_LABEL[p.kind] ?? p.kind}</div></td>
                <td className="small">{p.title}<div className="muted">{p.title.length} chars</div></td>
                <td className="small">{p.meta_description ? <>{p.meta_description.slice(0, 120)}{p.meta_description.length > 120 ? "…" : ""}<div className="muted">{p.meta_description.length} chars</div></> : <span className="muted">—</span>}</td>
                <td>{list.length ? list.map((i) => <div key={i}><span className={`badge ${i === "Draft" ? "amber" : "red"}`}>{i}</span></div>) : <span className="badge green">OK</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
