import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deleteMedia, saveMediaAlt, uploadMedia } from "../actions";
import Notice from "../Notice";
import ConfirmButton from "../ConfirmButton";
import { storageStatus } from "@/lib/storage";

export const metadata = { title: "Media" };

const PER = 48;

export default async function Media({ searchParams }: { searchParams: Promise<{ filter?: string; source?: string; q?: string; p?: string; ok?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const where: string[] = [];
  const params: unknown[] = [];
  if (sp.filter === "noalt") where.push(`alt_text = '' AND mime_type LIKE 'image/%'`);
  if (sp.source === "upload") where.push(`source = 'upload'`);
  if (sp.q) { params.push(`%${sp.q}%`); where.push(`(path ILIKE $${params.length} OR title ILIKE $${params.length} OR alt_text ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM media ${w}`, params))[0].n;
  const rows = await sql<{ id: number; path: string; mime_type: string; width: number | null; height: number | null; filesize: number | null; title: string; alt_text: string; source: string }>(
    `SELECT * FROM media ${w} ORDER BY created_at DESC, id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`,
    params
  );
  const self = `/admin/media/?${new URLSearchParams(Object.entries({ filter: sp.filter, source: sp.source, q: sp.q, p: page > 1 ? String(page) : undefined }).filter(([, v]) => v) as [string, string][])}`;
  const link = (o: Record<string, string | undefined>) =>
    `/admin/media/?${new URLSearchParams(Object.entries({ filter: sp.filter, source: sp.source, q: sp.q, ...o }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Media</h1>
          <div className="sub">All 244 files migrated from WordPress plus your uploads. Alt text you add here is applied to images on the site that have none.</div>
        </div>
      </div>
      <Notice sp={sp} />
      <div className="card">
        <form action={uploadMedia} className="row">
          <input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" aria-label="Files to upload" required />
          <button className="btn" type="submit">Upload</button>
          <span className="muted small">JPG, PNG, WebP, GIF or PDF, up to 10 MB each.</span>
        </form>
        <p className="muted small" style={{ margin: "8px 0 0" }}>
          {(() => {
            const s = storageStatus();
            return s.store === "s3"
              ? `New uploads are stored in Amazon S3 (${s.bucket}).`
              : `New uploads are stored in ${s.store === "blob" ? "Vercel Blob" : "this computer’s .data folder"}. To use Amazon S3, add ${s.missingS3.join(", ")} in the hosting settings and redeploy.`;
          })()}
        </p>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="filters" style={{ margin: 0 }}>
          <Link href="/admin/media/" className={!sp.filter && !sp.source ? "on" : ""}>All</Link>
          <Link href="/admin/media/?filter=noalt" className={sp.filter === "noalt" ? "on" : ""}>Missing alt text</Link>
          <Link href="/admin/media/?source=upload" className={sp.source === "upload" ? "on" : ""}>Uploaded here</Link>
        </div>
        <span className="spacer" />
        <form className="row" action="/admin/media/">
          <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search file name or alt text" aria-label="Search media" style={{ width: 230 }} />
          <button className="btn secondary small" type="submit">Search</button>
        </form>
      </div>
      <div className="media-grid">
        {rows.map((m) => (
          <div className="media-card" key={m.id}>
            {m.mime_type.startsWith("image/") ? (
              <div className="img" style={{ backgroundImage: `url("${m.path}")` }} role="img" aria-label={m.alt_text || m.title} />
            ) : (
              <div className="img" style={{ display: "grid", placeItems: "center" }}><span className="badge">{m.mime_type.split("/")[1]?.toUpperCase()}</span></div>
            )}
            <form className="meta" action={saveMediaAlt}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="return_to" value={self} />
              <div className="mono" style={{ wordBreak: "break-all" }} title={m.path}>{m.path.split("/").pop()}</div>
              <div className="muted">{m.width && m.height ? `${m.width}×${m.height} · ` : ""}{m.filesize ? `${Math.round(m.filesize / 1024)} KB` : ""}{m.source === "upload" ? " · uploaded" : ""}</div>
              {m.mime_type.startsWith("image/") && (
                <input type="text" name="alt_text" defaultValue={m.alt_text} placeholder="Alt text" aria-label={`Alt text for ${m.path.split("/").pop()}`} maxLength={300} />
              )}
              <input type="hidden" name="title" value="" />
              <div className="row">
                <button className="btn secondary small" type="submit">Save</button>
                <a className="small" href={m.path} target="_blank" rel="noopener">Open</a>
              </div>
            </form>
            {user.role === "admin" && m.source === "upload" && (
              <form action={deleteMedia} style={{ padding: "0 10px 10px" }}>
                <input type="hidden" name="id" value={m.id} />
                <ConfirmButton className="btn danger small" confirmLabel="Confirm delete">Delete</ConfirmButton>
              </form>
            )}
          </div>
        ))}
      </div>
      {!rows.length && <div className="card muted">No files match.</div>}
      <div className="pager">
        {page > 1 && <Link className="btn secondary small" href={link({ p: String(page - 1) })}>← Previous</Link>}
        <span className="muted small">{total} files · page {page} of {Math.max(1, Math.ceil(total / PER))}</span>
        {page * PER < total && <Link className="btn secondary small" href={link({ p: String(page + 1) })}>Next →</Link>}
      </div>
    </>
  );
}
