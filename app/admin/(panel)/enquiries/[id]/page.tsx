import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logActivity, one, sql } from "@/lib/db";
import { deleteEnquiry, setEnquiryStatus } from "../../actions";
import { fmtDate } from "../../format";
import ConfirmButton from "../../ConfirmButton";

export const metadata = { title: "Enquiry" };

const LABELS: Record<string, string> = { name: "Name", email: "Email", phone: "Phone", subject: "Subject", message: "Message" };

export default async function Enquiry({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const s = await one<{ id: number; form: string; page: string; fields: Record<string, string>; status: string; email_sent: boolean | null; legacy_id: number | null; created_at: string }>(
    `SELECT * FROM submissions WHERE id = $1`,
    [id]
  );
  if (!s) notFound();
  // Opening a new enquiry marks it as read.
  if (s.status === "new") {
    await sql(`UPDATE submissions SET status = 'read' WHERE id = $1`, [id]);
    await logActivity(user.id, "read enquiry", "enquiry", id);
    s.status = "read";
  }
  const keys = [...Object.keys(LABELS).filter((k) => k in s.fields), ...Object.keys(s.fields).filter((k) => !(k in LABELS))];
  const reply = s.fields.email ? `mailto:${s.fields.email}?subject=${encodeURIComponent("Re: " + (s.fields.subject || "Your enquiry to Bridge & Value"))}` : null;

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="muted small"><Link href="/admin/enquiries/">Enquiries</Link></div>
          <h1>{s.fields.name || s.fields.email || "Enquiry"}</h1>
          <div className="sub">{s.form === "quote" ? "Free quote form" : "Contact form"} · {fmtDate(s.created_at)} · from <span className="mono">{s.page}</span></div>
        </div>
        <div className="row">
          {reply && <a className="btn" href={reply}>Reply by email</a>}
        </div>
      </div>
      <div className="card">
        <dl className="kv">
          {keys.map((k) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{LABELS[k] ?? k}</dt>
              <dd>{k === "email" && s.fields[k] ? <a href={`mailto:${s.fields[k]}`}>{s.fields[k]}</a> : s.fields[k] || <span className="muted">—</span>}</dd>
            </div>
          ))}
          <dt>Status</dt><dd><span className="badge">{s.status}</span></dd>
          {s.email_sent === false && (<><dt>Notification</dt><dd><span className="badge amber">WordPress failed to email this enquiry</span></dd></>)}
          {s.legacy_id && (<><dt>Source</dt><dd className="muted">Migrated from WordPress (Elementor submission #{s.legacy_id})</dd></>)}
        </dl>
      </div>
      <div className="row">
        {["new", "read", "archived"].filter((x) => x !== s.status).map((x) => (
          <form key={x} action={setEnquiryStatus}>
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="status" value={x} />
            <input type="hidden" name="return_to" value={x === "archived" ? "/admin/enquiries/?ok=Enquiry%20archived." : `/admin/enquiries/${s.id}/`} />
            <button className="btn secondary" type="submit">{x === "archived" ? "Archive" : x === "new" ? "Mark as unread" : "Mark as read"}</button>
          </form>
        ))}
        <span className="spacer" />
        {user.role === "admin" && (
          <form action={deleteEnquiry}>
            <input type="hidden" name="id" value={s.id} />
            <ConfirmButton confirmLabel="Click again to delete permanently">Delete permanently</ConfirmButton>
          </form>
        )}
      </div>
    </>
  );
}
