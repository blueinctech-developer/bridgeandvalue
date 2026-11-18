import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { FREQUENCY_LABEL, popupStatus, targetLabel, type PopupRow } from "@/lib/popups";
import { movePopup, togglePopup } from "../popup-actions";
import { fmtDate } from "../format";
import Notice from "../Notice";

export const metadata = { title: "Pop-ups" };

const STATUS = {
  live: { label: "Live", cls: "green" },
  scheduled: { label: "Scheduled", cls: "blue" },
  ended: { label: "Ended", cls: "" },
  off: { label: "Off", cls: "" },
} as const;

export default async function Popups({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const rows = await sql<PopupRow>(`SELECT * FROM popups ORDER BY position, id`);
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Pop-ups</h1>
          <div className="sub">Pop-ups open over a page after a few seconds. Only one opens per page view: the first in this list that may show there.</div>
        </div>
        <Link className="btn" href="/admin/popups/new/">New pop-up</Link>
      </div>
      <Notice sp={sp} />
      <table className="list">
        <thead><tr><th>Order</th><th>Pop-up</th><th>Shows on</th><th>When</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((p, i) => {
            const st = STATUS[popupStatus(p)];
            return (
              <tr key={p.id}>
                <td>
                  {/* One small form per arrow: a clicked button's name/value isn't reliably sent with a server action. */}
                  <div className="row" style={{ gap: 4 }}>
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={movePopup}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button className="btn secondary small" type="submit" disabled={dir === "up" ? i === 0 : i === rows.length - 1} aria-label={`Move ${p.name} ${dir}`}>
                          {dir === "up" ? "↑" : "↓"}
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
                <td>
                  <Link href={`/admin/popups/${p.id}/`}><strong>{p.name}</strong></Link>
                  {p.kind === "elementor" && <div className="small muted">From WordPress (original design)</div>}
                </td>
                <td className="small">{targetLabel(p)}</td>
                <td className="small">
                  After {p.delay_seconds}s · {FREQUENCY_LABEL[p.frequency]}
                  {(p.starts_at || p.ends_at) && (
                    <div className="muted">{p.starts_at ? `From ${fmtDate(p.starts_at)}` : ""}{p.starts_at && p.ends_at ? " " : ""}{p.ends_at ? `until ${fmtDate(p.ends_at)}` : ""}</div>
                  )}
                </td>
                <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                <td>
                  <form action={togglePopup}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn secondary small" type="submit">{p.enabled ? "Turn off" : "Turn on"}</button>
                  </form>
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={6} className="muted">No pop-ups yet.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
