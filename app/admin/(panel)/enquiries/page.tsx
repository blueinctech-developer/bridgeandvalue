import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDate } from "../format";
import Notice from "../Notice";

export const metadata = { title: "Enquiries" };

const FORM_LABEL: Record<string, string> = { contact: "Contact form", quote: "Free quote" };
const PER = 25;

export default async function Enquiries({ searchParams }: { searchParams: Promise<{ status?: string; form?: string; q?: string; p?: string; ok?: string; err?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const status = sp.status ?? "inbox";
  const page = Math.max(1, Number(sp.p) || 1);
  const where: string[] = [];
  const params: unknown[] = [];
  if (status === "inbox") where.push(`status <> 'archived'`);
  else if (["new", "read", "archived"].includes(status)) { params.push(status); where.push(`status = $${params.length}`); }
  if (sp.form) { params.push(sp.form); where.push(`form = $${params.length}`); }
  if (sp.q) { params.push(`%${sp.q}%`); where.push(`fields::text ILIKE $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM submissions ${w}`, params))[0].n;
  const rows = await sql<{ id: number; form: string; page: string; fields: Record<string, string>; status: string; email_sent: boolean | null; created_at: string }>(
    `SELECT * FROM submissions ${w} ORDER BY created_at DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`,
    params
  );
  const qs = (o: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, form: sp.form, q: sp.q, ...o })) if (v) u.set(k, String(v));
    return `/admin/enquiries/?${u}`;
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Enquiries</h1>
          <div className="sub">Messages from the contact form and the service-page quote form, including the 37 migrated from WordPress.</div>
        </div>
        <a className="btn secondary" href={`/admin/enquiries/export/?${new URLSearchParams({ status, ...(sp.form ? { form: sp.form } : {}), ...(sp.q ? { q: sp.q } : {}) })}`}>Export CSV</a>
      </div>
      <Notice sp={sp} />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="filters" style={{ margin: 0 }}>
          {[["inbox", "Inbox"], ["new", "New"], ["read", "Read"], ["archived", "Archived"], ["all", "All"]].map(([k, l]) => (
            <Link key={k} href={qs({ status: k, p: undefined })} className={status === k ? "on" : ""}>{l}</Link>
          ))}
        </div>
        <span className="spacer" />
        <form className="row" action="/admin/enquiries/">
          <input type="hidden" name="status" value={status} />
          <select name="form" defaultValue={sp.form ?? ""} aria-label="Form" style={{ width: 150 }}>
            <option value="">All forms</option>
            <option value="contact">Contact form</option>
            <option value="quote">Free quote</option>
          </select>
          <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search name, email, message" aria-label="Search enquiries" style={{ width: 230 }} />
          <button className="btn secondary small" type="submit">Filter</button>
        </form>
      </div>
      <table className="list">
        <thead><tr><th>From</th><th>Message</th><th>Form</th><th>Received</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.status === "new" ? "unread" : ""}>
              <td><Link href={`/admin/enquiries/${r.id}/`}>{r.fields.name || "(no name)"}</Link><div className="muted small">{r.fields.email}</div></td>
              <td className="small">{r.fields.subject ? <strong>{r.fields.subject} · </strong> : null}{(r.fields.message || "").slice(0, 90)}{(r.fields.message || "").length > 90 ? "…" : ""}</td>
              <td className="small">{FORM_LABEL[r.form] ?? r.form}</td>
              <td className="small muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
              <td>
                <span className={`badge ${r.status === "new" ? "red" : r.status === "read" ? "green" : ""}`}>{r.status}</span>
                {r.email_sent === false && <div><span className="badge amber" title="WordPress failed to send the notification email">email failed</span></div>}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="muted">No enquiries here.</td></tr>}
        </tbody>
      </table>
      <div className="pager">
        {page > 1 && <Link className="btn secondary small" href={qs({ p: page - 1 })}>← Newer</Link>}
        <span className="muted small">{total} enquir{total === 1 ? "y" : "ies"} · page {page} of {Math.max(1, Math.ceil(total / PER))}</span>
        {page * PER < total && <Link className="btn secondary small" href={qs({ p: page + 1 })}>Older →</Link>}
      </div>
    </>
  );
}
