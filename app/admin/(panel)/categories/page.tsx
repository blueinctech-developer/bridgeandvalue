import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deleteTerm, saveTerm } from "../content-actions";
import Notice from "../Notice";
import ConfirmButton from "../ConfirmButton";

export const metadata = { title: "Categories & tags" };

type Row = { id: number; taxonomy: string; name: string; slug: string; description: string; posts: number };

function TermTable({ rows, taxonomy }: { rows: Row[]; taxonomy: "category" | "tag" }) {
  return (
    <div className="card">
      <h2>{taxonomy === "category" ? "Categories" : "Tags"}</h2>
      <table className="list" style={{ marginBottom: 14 }}>
        <thead><tr><th>Name</th><th>Address</th><th>Posts</th><th></th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td colSpan={2} style={{ padding: 0 }}>
                <form action={saveTerm} className="row" style={{ padding: "8px 12px" }} id={`t${t.id}`}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="taxonomy" value={taxonomy} />
                  <input type="text" name="name" defaultValue={t.name} aria-label="Name" style={{ width: 160 }} required />
                  <span className="muted mono small">/{taxonomy}/</span>
                  <input type="text" name="slug" defaultValue={t.slug} aria-label="Slug" className="mono" style={{ width: 150 }} />
                  <input type="hidden" name="description" value={t.description} />
                </form>
              </td>
              <td>{t.posts ? <a href={`/${taxonomy}/${t.slug}/`} target="_blank" rel="noopener">{t.posts}</a> : <span className="muted">0</span>}</td>
              <td className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn secondary small" type="submit" form={`t${t.id}`}>Save</button>
                <form action={deleteTerm}><input type="hidden" name="id" value={t.id} /><ConfirmButton className="btn danger small" confirmLabel="Confirm delete">Delete</ConfirmButton></form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={saveTerm} className="row">
        <input type="hidden" name="taxonomy" value={taxonomy} />
        <input type="text" name="name" placeholder={`New ${taxonomy} name`} aria-label={`New ${taxonomy} name`} required style={{ width: 220 }} />
        <button className="btn small" type="submit">Add {taxonomy}</button>
      </form>
    </div>
  );
}

export default async function Categories({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const rows = await sql<Row>(`SELECT t.*, (SELECT count(*)::int FROM post_terms pt WHERE pt.term_id = t.id) AS posts FROM terms t ORDER BY t.name`);
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Categories &amp; tags</h1>
          <div className="sub">Group blog posts. Each one gets an archive page, e.g. /category/business/. The six categories and six tags from WordPress were kept.</div>
        </div>
      </div>
      <Notice sp={sp} />
      <div className="grid k2">
        <TermTable rows={rows.filter((r) => r.taxonomy === "category")} taxonomy="category" />
        <TermTable rows={rows.filter((r) => r.taxonomy === "tag")} taxonomy="tag" />
      </div>
    </>
  );
}
