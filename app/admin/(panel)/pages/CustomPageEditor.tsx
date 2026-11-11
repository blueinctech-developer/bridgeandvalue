import type { PageRow } from "@/lib/db";
import { deleteCustomPage, publishCustomPage, saveCustomPage, saveCustomPageDraft, unpublishCustomPage } from "../content-actions";
import { ImageField } from "../MediaPicker";
import RichEditor from "../RichEditor";
import ConfirmButton from "../ConfirmButton";
import { fmtDate } from "../format";

/** Editor for pages created in the admin (kind = 'custom'). */
export default function CustomPageEditor({ page, isAdmin }: { page: PageRow & { editor: string | null }; isAdmin: boolean }) {
  const live = page.status === "published";
  return (
    <form action={saveCustomPage}>
      <input type="hidden" name="id" value={page.id} />
      <div className="editor-grid">
        <div>
          <div className="card">
            <div className="field">
              <label htmlFor="title">Page title</label>
              <input id="title" name="title" type="text" defaultValue={page.title.replace(/ – Bridge and Value$/, "")} required maxLength={150} style={{ fontSize: 20, fontWeight: 600 }} />
            </div>
            <div className="field">
              <label htmlFor="slug">Web address</label>
              <div className="row" style={{ gap: 4 }}>
                <span className="muted mono">bridgeandvalue.com/</span>
                <input id="slug" name="slug" type="text" className="mono" defaultValue={page.slug} required style={{ flex: 1, minWidth: 160 }} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="lowercase letters, numbers and hyphens" />
                <span className="muted mono">/</span>
              </div>
              {live && <div className="hint">If you change the address of a live page, a 301 redirect from the old address is added automatically.</div>}
            </div>
            <RichEditor name="content_html" label="Content" defaultValue={page.content_html ?? ""} />
          </div>
          <div className="card">
            <h2>SEO</h2>
            <div className="field">
              <label htmlFor="meta_description">Meta description</label>
              <textarea id="meta_description" name="meta_description" defaultValue={page.meta_description ?? ""} rows={2} maxLength={320} placeholder="Aim for 120–160 characters." />
            </div>
            <label className="check"><input type="checkbox" name="noindex" defaultChecked={(page.robots ?? "").includes("noindex")} /> Hide from search engines (noindex)</label>
          </div>
        </div>
        <div>
          <div className="card">
            <h2>Publish</h2>
            <p className="small">Status: {live ? <span className="badge green">Published</span> : <span className="badge amber">Draft</span>}</p>
            <div className="row">
              <button className="btn secondary" type="submit" formAction={saveCustomPageDraft}>{live ? "Update" : "Save draft"}</button>
              {!live && <button className="btn" type="submit" formAction={publishCustomPage}>Publish</button>}
              {live && <button className="btn secondary" type="submit" formAction={unpublishCustomPage}>Unpublish</button>}
            </div>
            <p className="small" style={{ marginTop: 12 }}>
              {live ? <a href={page.path} target="_blank" rel="noopener">View page ↗</a> : <a href={`/preview/page/${page.id}/`} target="_blank" rel="noopener">Preview ↗</a>}
              <br /><span className="muted">Last saved {fmtDate(page.updated_at)}{page.editor ? ` by ${page.editor}` : ""}</span>
            </p>
            <p className="small muted">To show it in the navigation, add it under Menu.</p>
          </div>
          <div className="card">
            <h2>Banner image</h2>
            <ImageField name="hero_image" defaultValue={page.hero_image} label="Background behind the page title (optional)" />
          </div>
        </div>
      </div>
      {isAdmin && (
        <div className="row end">
          <ConfirmButton formAction={deleteCustomPage} confirmLabel="Click again to delete permanently">Delete page</ConfirmButton>
        </div>
      )}
    </form>
  );
}
