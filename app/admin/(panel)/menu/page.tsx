import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { saveMenu } from "../actions";
import Notice from "../Notice";

export const metadata = { title: "Menu" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const items = await sql<{ label: string; url: string; new_tab: boolean }>(`SELECT label, url, new_tab FROM menu_items WHERE menu='main' ORDER BY position`);
  const pages = await sql<{ path: string; title: string }>(`SELECT path, title FROM pages WHERE status='published' AND kind IN ('page','service','custom') ORDER BY path`);
  // Existing items plus three empty rows for adding new ones.
  const rows = [...items, ...Array.from({ length: 3 }, () => ({ label: "", url: "", new_tab: false }))];
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Main menu</h1>
          <div className="sub">The navigation at the top of every page (desktop and mobile). Order is top to bottom; clear a row&apos;s label to remove it.</div>
        </div>
      </div>
      <Notice sp={sp} />
      <form action={saveMenu} className="card">
        <datalist id="page-paths">
          {pages.map((p) => <option key={p.path} value={p.path}>{p.title}</option>)}
        </datalist>
        <table className="list" style={{ border: 0 }}>
          <thead><tr><th style={{ width: 40 }}>#</th><th>Label</th><th>Link</th><th style={{ width: 110 }}>New tab</th></tr></thead>
          <tbody>
            {rows.map((it, i) => (
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                <td><input type="text" name="label" defaultValue={it.label} aria-label={`Menu item ${i + 1} label`} placeholder={i >= items.length ? "New item" : ""} /></td>
                <td><input type="text" name="url" defaultValue={it.url} list="page-paths" className="mono" aria-label={`Menu item ${i + 1} link`} placeholder="/page/ or https://…" /></td>
                <td><label className="check"><input type="checkbox" name="new_tab" value={i} defaultChecked={it.new_tab} /> Yes</label></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: 10 }}>To reorder, change the labels and links in the rows. Menu items appear in uppercase on the site, like the original.</p>
        <button className="btn" type="submit">Save &amp; publish menu</button>
      </form>
    </>
  );
}
