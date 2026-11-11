import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDate } from "../format";

export const metadata = { title: "Activity log" };
const PER = 50;

export default async function Activity({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireUser("admin");
  const page = Math.max(1, Number((await searchParams).p) || 1);
  const rows = await sql<{ id: number; action: string; entity: string; entity_id: string | null; detail: Record<string, unknown> | null; created_at: string; name: string | null }>(
    `SELECT a.*, u.name FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT ${PER + 1} OFFSET ${(page - 1) * PER}`
  );
  const more = rows.length > PER;
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Activity log</h1>
          <div className="sub">Who changed what, and when.</div>
        </div>
      </div>
      <table className="list">
        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
        <tbody>
          {rows.slice(0, PER).map((r) => (
            <tr key={r.id}>
              <td className="small muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
              <td className="small">{r.name ?? "System"}</td>
              <td className="small">{r.action} <span className="muted">{r.entity}{r.entity_id ? ` #${r.entity_id}` : ""}</span></td>
              <td className="small muted mono" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.detail ? JSON.stringify(r.detail) : ""}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="muted">Nothing yet.</td></tr>}
        </tbody>
      </table>
      <div className="pager">
        {page > 1 && <Link className="btn secondary small" href={`/admin/activity/?p=${page - 1}`}>← Newer</Link>}
        {more && <Link className="btn secondary small" href={`/admin/activity/?p=${page + 1}`}>Older →</Link>}
      </div>
    </>
  );
}
