import type { BlockFields, BlockRow } from "@/lib/db";
import { saveBlock } from "./actions";
import { fmtDate } from "./format";

/** One collapsible editor per content block (Elementor widget). */
export default function BlockEditor({ block, returnTo }: { block: BlockRow & { editor?: string | null }; returnTo: string }) {
  const o = block.original;
  const c: BlockFields = block.content ?? o;
  const edited = !!block.content;
  const type = block.widget_type.replace(/\.default$/, "").replace(/^tg-/, "");
  const [, ...rest] = block.label.split(": ");
  return (
    <details className="block" id={`block-${block.id}`}>
      <summary>
        <span className="badge">{type}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rest.join(": ") || block.label}</span>
        {edited && <span className="badge blue" title={`Edited ${fmtDate(block.updated_at)}`}>Edited</span>}
      </summary>
      <div className="body">
        <form action={saveBlock}>
          <input type="hidden" name="block_id" value={block.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          {typeof o.html === "string" ? (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor={`html-${block.id}`}>Text (HTML)</label>
              <textarea id={`html-${block.id}`} name="html" className="code" defaultValue={c.html} rows={8} />
              <div className="hint">Paragraphs use &lt;p&gt;…&lt;/p&gt;; bold &lt;strong&gt;; links &lt;a href=&quot;…&quot;&gt;. Scripts are removed automatically.</div>
            </div>
          ) : (
            <>
              {(o.texts ?? []).length > 0 && <h3 style={{ marginTop: 12 }}>Text</h3>}
              {(o.texts ?? []).map((t, i) => {
                const v = c.texts?.[i] ?? t;
                const long = t.length > 80;
                return (
                  <div className="field" key={`t${i}`}>
                    {long ? (
                      <textarea name={`text_${i}`} defaultValue={v} aria-label={`Text ${i + 1}`} rows={3} />
                    ) : (
                      <input type="text" name={`text_${i}`} defaultValue={v} aria-label={`Text ${i + 1}`} />
                    )}
                  </div>
                );
              })}
              {(o.links ?? []).length > 0 && <h3>Links</h3>}
              {(o.links ?? []).map((l, i) => (
                <div className="field" key={`l${i}`}>
                  <input type="text" className="mono" name={`href_${i}`} defaultValue={c.links?.[i]?.href ?? l.href} aria-label={`Link ${i + 1} address`} />
                </div>
              ))}
              {(o.images ?? []).length > 0 && <h3>Images</h3>}
              {(o.images ?? []).map((img, i) => {
                const cur = c.images?.[i] ?? img;
                return (
                  <div className="row" key={`i${i}`} style={{ alignItems: "flex-start", marginBottom: 12 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="thumb" src={cur.src} alt="" />
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <input type="text" className="mono" name={`src_${i}`} defaultValue={cur.src} aria-label={`Image ${i + 1} file`} style={{ marginBottom: 6 }} />
                      <input type="text" name={`alt_${i}`} defaultValue={cur.alt} placeholder="Alt text (describe the image for screen readers and Google)" aria-label={`Image ${i + 1} alt text`} />
                    </div>
                  </div>
                );
              })}
              <div className="hint muted small">To use another image, copy its address from Media.</div>
            </>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" type="submit">Save &amp; publish</button>
            {edited && (
              <button className="btn secondary" type="submit" name="reset" value="1" formNoValidate>
                Restore original
              </button>
            )}
            <span className="spacer" />
            <span className="muted small">Element {block.element_id}</span>
          </div>
        </form>
      </div>
    </details>
  );
}
