import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deleteRedirect, saveRedirect } from "../actions";
import { fmtDate } from "../format";
import Notice from "../Notice";
import ConfirmButton from "../ConfirmButton";

export const metadata = { title: "Redirects" };

export default async function Redirects({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const rows = await sql<{ id: number; source: string; destination: string; status_code: number; note: string; created_at: string }>(
    `SELECT * FROM redirects ORDER BY source`
  );
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Redirects</h1>
          <div className="sub">Send visitors and Google from an old address to a new one. Use 301 for permanent moves (keeps SEO value).</div>
        </div>
      </div>
      <Notice sp={sp} />
      <form action={saveRedirect} className="card">
        <h2>Add a redirect</h2>
        <div className="grid k2">
          <div className="field"><label htmlFor="source">From (old path)</label><input id="source" name="source" type="text" className="mono" placeholder="/old-page/" required /></div>
          <div className="field"><label htmlFor="destination">To</label><input id="destination" name="destination" type="text" className="mono" placeholder="/new-page/ or https://…" required /></div>
        </div>
        <div className="grid k2">
          <div className="field">
            <label htmlFor="status_code">Type</label>
            <select id="status_code" name="status_code" defaultValue="301">
              <option value="301">301 Permanent</option>
              <option value="302">302 Temporary</option>
            </select>
          </div>
          <div className="field"><label htmlFor="note">Note (optional)</label><input id="note" name="note" type="text" /></div>
        </div>
        <button className="btn" type="submit">Add redirect</button>
      </form>
      <table className="list">
        <thead><tr><th>From</th><th>To</th><th>Type</th><th>Note</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono">{r.source}</td>
              <td className="mono">{r.destination}</td>
              <td><span className="badge">{r.status_code}</span></td>
              <td className="small muted">{r.note}<div>{fmtDate(r.created_at, false)}</div></td>
              <td>
                <form action={deleteRedirect}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmButton className="btn danger small" confirmLabel="Confirm delete">Delete</ConfirmButton>
                </form>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="muted">No redirects.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
