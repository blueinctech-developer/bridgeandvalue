import Link from "next/link";
import { sql } from "@/lib/db";
import { parisLocal } from "@/lib/paris-time";
import { FREQUENCY_LABEL, type PopupRow } from "@/lib/popups";
import { deletePopup, savePopup } from "../popup-actions";
import { ImageField } from "../MediaPicker";
import RichEditor from "../RichEditor";
import ConfirmButton from "../ConfirmButton";

/** Create or edit a pop-up. The pop-up migrated from WordPress keeps its design: only its timing is edited here. */
export default async function PopupForm({ popup, isAdmin }: { popup: PopupRow | null; isAdmin: boolean }) {
  const legacy = popup?.kind === "elementor";
  const pages = await sql<{ path: string; title: string }>(
    `SELECT path, title FROM pages WHERE status = 'published' AND kind <> 'system' AND path NOT LIKE '/author/%' ORDER BY (path = '/') DESC, path`
  );
  const chosen = new Set(popup?.paths ?? []);
  const target = popup?.target ?? "home";
  const title = (t: string) => t.replace(/\s+[–-]\s+Bridge and Value$/, "");
  return (
    <>
      <form action={savePopup}>
        <input type="hidden" name="id" value={popup?.id ?? ""} />
        <div className="card">
          <div className="field"><label htmlFor="name">Name (only shown here in the admin)</label><input id="name" name="name" type="text" required maxLength={120} defaultValue={popup?.name} placeholder="e.g. Paris mission 2027 registrations" /></div>
          <label className="check"><input type="checkbox" name="enabled" defaultChecked={popup?.enabled ?? true} /> Pop-up is on</label>
        </div>

        {legacy ? (
          <div className="card">
            <h2>Content</h2>
            <p className="muted" style={{ margin: 0 }}>
              This pop-up came from the WordPress site and keeps its original design. Edit its text, button and image on the{" "}
              <Link href="/admin/pages/">Home page</Link> (its blocks are listed at the end). It shows on the home page only.
            </p>
          </div>
        ) : (
          <div className="card">
            <h2>Content</h2>
            <div className="field"><label htmlFor="heading">Heading</label><input id="heading" name="heading" type="text" maxLength={200} defaultValue={popup?.heading} placeholder="e.g. Register for our next trade mission" /></div>
            <RichEditor name="body_html" label="Text" defaultValue={popup?.body_html ?? ""} />
            <ImageField name="image" altName="image_alt" defaultValue={popup?.image} defaultAlt={popup?.image_alt} label="Image (optional; shown beside the text, above it on phones)" />
            <div className="grid k2">
              <div className="field"><label htmlFor="button_text">Button text (optional)</label><input id="button_text" name="button_text" type="text" maxLength={60} defaultValue={popup?.button_text} placeholder="e.g. Register now" /></div>
              <div className="field"><label htmlFor="button_url">Button link</label><input id="button_url" name="button_url" type="text" className="mono" maxLength={500} defaultValue={popup?.button_url} placeholder="/business-mission/ or https://…" /><div className="hint">A page on this site (/…), a web address, mailto: or tel:.</div></div>
            </div>
          </div>
        )}

        <div className="card">
          <h2>Where and when</h2>
          {legacy ? (
            <p className="muted" style={{ marginTop: 0 }}>Shows on: Home page</p>
          ) : (
            <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
              <legend style={{ fontWeight: 600, marginBottom: 6 }}>Show on</legend>
              <label className="check"><input type="radio" name="target" value="all" defaultChecked={target === "all"} /> All pages</label>
              <label className="check"><input type="radio" name="target" value="home" defaultChecked={target === "home"} /> Home page only</label>
              <label className="check"><input type="radio" name="target" value="pages" defaultChecked={target === "pages"} /> Only the pages ticked below</label>
              <details style={{ marginTop: 8 }} open={target === "pages"}>
                <summary className="small">Choose pages ({pages.length})</summary>
                <div className="grid k2" style={{ gap: 4, marginTop: 8 }}>
                  {pages.map((p) => (
                    <label key={p.path} className="check small">
                      <input type="checkbox" name="paths" value={p.path} defaultChecked={chosen.has(p.path)} /> {title(p.title)} <span className="muted mono">{p.path}</span>
                    </label>
                  ))}
                </div>
              </details>
            </fieldset>
          )}
          <div className="grid k2">
            <div className="field">
              <label htmlFor="delay_seconds">Open after (seconds on the page)</label>
              <input id="delay_seconds" name="delay_seconds" type="number" min={0} max={120} defaultValue={popup?.delay_seconds ?? 5} style={{ width: 100 }} />
            </div>
            <div className="field">
              <label htmlFor="frequency">How often a visitor sees it</label>
              <select id="frequency" name="frequency" defaultValue={popup?.frequency ?? "session"}>
                {Object.entries(FREQUENCY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid k2">
            <div className="field"><label htmlFor="starts_at">Start showing (Paris time, optional)</label><input id="starts_at" name="starts_at" type="datetime-local" defaultValue={parisLocal(popup?.starts_at)} /></div>
            <div className="field"><label htmlFor="ends_at">Stop showing (Paris time, optional)</label><input id="ends_at" name="ends_at" type="datetime-local" defaultValue={parisLocal(popup?.ends_at)} /></div>
          </div>
          <div className="hint">Only one pop-up opens per page view: when several could show on a page, the first in the Pop-ups list wins.</div>
        </div>
        <div className="row">
          <button className="btn" type="submit">{popup ? "Save pop-up" : "Create pop-up"}</button>
          <Link className="btn secondary" href="/admin/popups/">Back to the list</Link>
        </div>
      </form>
      {popup && !legacy && isAdmin && (
        <form action={deletePopup} style={{ marginTop: 24 }}>
          <input type="hidden" name="id" value={popup.id} />
          <ConfirmButton className="btn danger small" confirmLabel="Confirm delete">Delete this pop-up</ConfirmButton>
        </form>
      )}
    </>
  );
}
