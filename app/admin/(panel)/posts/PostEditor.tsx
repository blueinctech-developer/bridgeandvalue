import Link from "next/link";
import { sql } from "@/lib/db";
import type { Post } from "@/lib/blog";
import { deletePost, publishPost, savePost, savePostDraft, unpublishPost } from "../content-actions";
import { ImageField } from "../MediaPicker";
import RichEditor from "../RichEditor";
import ConfirmButton from "../ConfirmButton";
import { fmtDate } from "../format";

/** Value for <input type="datetime-local"> in Paris time. */
function parisLocal(iso: string | null) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export default async function PostEditor({ post, isAdmin }: { post: (Post & { term_ids: number[] }) | null; isAdmin: boolean }) {
  const terms = await sql<{ id: number; taxonomy: string; name: string }>(`SELECT id, taxonomy, name FROM terms ORDER BY taxonomy, name`);
  const has = new Set(post?.term_ids ?? []);
  const live = post?.status === "published";
  const scheduled = live && post?.published_at && new Date(post.published_at) > new Date();
  return (
    <form action={savePost}>
      {post && <input type="hidden" name="id" value={post.id} />}
      <div className="editor-grid">
        <div>
          <div className="card">
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" type="text" defaultValue={post?.title} required maxLength={200} style={{ fontSize: 20, fontWeight: 600 }} />
            </div>
            <div className="field">
              <label htmlFor="slug">Web address</label>
              <div className="row" style={{ gap: 4 }}>
                <span className="muted mono">bridgeandvalue.com/</span>
                <input id="slug" name="slug" type="text" className="mono" defaultValue={post?.slug} placeholder="created from the title" style={{ flex: 1, minWidth: 160 }} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="lowercase letters, numbers and hyphens" />
                <span className="muted mono">/</span>
              </div>
              {live && <div className="hint">Changing the address of a published post breaks existing links. Add a redirect if you do.</div>}
            </div>
            <RichEditor name="content_html" label="Content" defaultValue={post?.content_html ?? ""} />
            <div className="field">
              <label htmlFor="excerpt">Excerpt (summary shown on the blog page)</label>
              <textarea id="excerpt" name="excerpt" defaultValue={post?.excerpt} rows={3} maxLength={600} placeholder="Leave empty to use the first sentences of the post" />
            </div>
          </div>
          <div className="card">
            <h2>SEO</h2>
            <div className="field">
              <label htmlFor="meta_title">SEO title</label>
              <input id="meta_title" name="meta_title" type="text" defaultValue={post?.meta_title ?? ""} placeholder="Defaults to the post title" maxLength={200} />
              <div className="hint">“ – Bridge and Value” is added automatically, as on the rest of the site.</div>
            </div>
            <div className="field">
              <label htmlFor="meta_description">Meta description</label>
              <textarea id="meta_description" name="meta_description" defaultValue={post?.meta_description ?? ""} rows={2} maxLength={320} placeholder="Defaults to the excerpt. Aim for 120–160 characters." />
            </div>
            <label className="check"><input type="checkbox" name="noindex" defaultChecked={post?.noindex} /> Hide from search engines (noindex)</label>
          </div>
        </div>
        <div>
          <div className="card">
            <h2>Publish</h2>
            <p className="small">
              Status: {post ? (post.status === "draft" ? <span className="badge amber">Draft</span> : scheduled ? <span className="badge blue">Scheduled</span> : <span className="badge green">Published</span>) : <span className="badge">New</span>}
            </p>
            <div className="field">
              <label htmlFor="published_at">Publish date (Paris time)</label>
              <input id="published_at" name="published_at" type="datetime-local" defaultValue={parisLocal(post?.published_at ?? null)} />
              <div className="hint">Empty = now. A future date schedules the post.</div>
            </div>
            <div className="row">
              <button className="btn secondary" type="submit" formAction={savePostDraft}>{live ? "Update" : "Save draft"}</button>
              {!live && <button className="btn" type="submit" formAction={publishPost}>Publish</button>}
              {live && <button className="btn secondary" type="submit" formAction={unpublishPost}>Unpublish</button>}
            </div>
            {post && (
              <p className="small" style={{ marginTop: 12 }}>
                {live && !scheduled ? <a href={`/${post.slug}/`} target="_blank" rel="noopener">View post ↗</a> : <a href={`/preview/post/${post.id}/`} target="_blank" rel="noopener">Preview ↗</a>}
                <br /><span className="muted">Last saved {fmtDate(post.updated_at)}</span>
              </p>
            )}
          </div>
          <div className="card">
            <h2>Featured image</h2>
            <ImageField name="featured_image" altName="featured_alt" defaultValue={post?.featured_image} defaultAlt={post?.featured_alt} label="Shown on the blog page and at the top of the post" />
          </div>
          <div className="card">
            <h2>Categories</h2>
            <div className="check-list">
              {terms.filter((t) => t.taxonomy === "category").map((t) => (
                <label key={t.id} className="check"><input type="checkbox" name="terms" value={t.id} defaultChecked={has.has(t.id)} /> {t.name}</label>
              ))}
            </div>
            <h2 style={{ marginTop: 16 }}>Tags</h2>
            <div className="check-list">
              {terms.filter((t) => t.taxonomy === "tag").map((t) => (
                <label key={t.id} className="check"><input type="checkbox" name="terms" value={t.id} defaultChecked={has.has(t.id)} /> {t.name}</label>
              ))}
            </div>
            <p className="small" style={{ marginTop: 8 }}><Link href="/admin/categories/">Manage categories &amp; tags</Link></p>
          </div>
        </div>
      </div>
      {post && isAdmin && (
        <div className="row end">
          <ConfirmButton formAction={deletePost} confirmLabel="Click again to delete permanently">Delete post</ConfirmButton>
        </div>
      )}
    </form>
  );
}
