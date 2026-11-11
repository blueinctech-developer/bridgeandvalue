import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, sql, type BlockRow, type PageRow } from "@/lib/db";
import { savePageSettings } from "../../actions";
import BlockEditor from "../../BlockEditor";
import { fmtDate, KIND_LABEL } from "../../format";
import Notice from "../../Notice";
import CustomPageEditor from "../CustomPageEditor";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  const page = await one<PageRow & { editor: string | null }>(
    `SELECT p.*, u.name AS editor FROM pages p LEFT JOIN users u ON u.id = p.updated_by WHERE p.id = $1 AND p.kind <> 'system'`,
    [id]
  );
  if (!page) notFound();
  if (page.kind === "custom") {
    return (
      <>
        <div className="pagehead"><div><div className="muted small"><Link href="/admin/pages/?kind=custom">Pages &amp; services</Link> / New page</div><h1>{page.title.replace(/ – Bridge and Value$/, "")}</h1><div className="sub mono">{page.path}</div></div></div>
        <Notice sp={sp} />
        <CustomPageEditor page={page} isAdmin={user.role === "admin"} />
      </>
    );
  }
  const blocks = await sql<BlockRow>(`SELECT * FROM blocks WHERE page_id = $1 ORDER BY position`, [id]);
  const robotsNoindex = (page.robots ?? "").includes("noindex");
  const descLen = (page.meta_description ?? "").length;

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="muted small"><Link href="/admin/pages/">Pages &amp; services</Link> / {KIND_LABEL[page.kind] ?? page.kind}</div>
          <h1>{page.title.replace(/ – Bridge and Value$/, "")}</h1>
          <div className="sub mono">{page.path}</div>
        </div>
        <div className="row">
          {page.status === "published" ? <span className="badge green">Published</span> : <span className="badge amber">Draft</span>}
          <a className="btn secondary" href={page.path} target="_blank" rel="noopener">View page ↗</a>
        </div>
      </div>
      <Notice sp={sp} />

      <div className="card">
        <h2>Page settings &amp; SEO</h2>
        <form action={savePageSettings}>
          <input type="hidden" name="id" value={page.id} />
          <div className="field">
            <label htmlFor="title">Page title (browser tab and Google)</label>
            <input id="title" name="title" type="text" defaultValue={page.title} required maxLength={200} />
            <div className="hint">Currently {page.title.length} characters. Google shows about 60.</div>
          </div>
          <div className="field">
            <label htmlFor="meta_description">Meta description</label>
            <textarea id="meta_description" name="meta_description" defaultValue={page.meta_description ?? ""} maxLength={320} rows={3} />
            <div className="hint">{descLen ? `${descLen} characters. Aim for 120–160.` : "Not set (WordPress had none). Google will pick text from the page."}</div>
          </div>
          <div className="grid k2">
            <div className="field">
              <label htmlFor="canonical">Canonical URL</label>
              <input id="canonical" name="canonical" type="url" defaultValue={page.canonical ?? ""} placeholder="(none)" />
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={page.status}>
                <option value="published">Published</option>
                <option value="draft">Draft (hidden from the website)</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <label className="check"><input type="checkbox" name="in_sitemap" defaultChecked={page.in_sitemap} /> Include in sitemap.xml</label>
            <label className="check"><input type="checkbox" name="noindex" defaultChecked={robotsNoindex} /> Hide from search engines (noindex)</label>
          </div>
          <div className="row">
            <button className="btn" type="submit">Save settings</button>
            <span className="muted small">Last changed {fmtDate(page.updated_at)}{page.editor ? ` by ${page.editor}` : ""}</span>
          </div>
        </form>
      </div>

      <div className="pagehead" style={{ marginTop: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Content blocks</h2>
          <div className="sub small">In page order. Open a block to edit its text, links and images. The shared footer is edited under <Link href="/admin/footer/">Footer</Link>.</div>
        </div>
      </div>
      {blocks.map((b) => (
        <BlockEditor key={b.id} block={b} returnTo={`/admin/pages/${page.id}/`} />
      ))}
      {!blocks.length && <div className="card muted">This page has no editable content blocks.</div>}
    </>
  );
}
