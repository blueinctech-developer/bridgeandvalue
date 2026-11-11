"use client";

import { useEffect, useState } from "react";

type Item = { path: string; alt_text: string; title: string };

/** Modal listing images from the media library. */
export function MediaPickerModal({ onSelect, onClose }: { onSelect: (item: Item) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/admin/api/media/?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setItems)
        .catch(() => setItems([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose an image" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Choose an image</h2>
          <span className="spacer" />
          <input type="search" placeholder="Search media" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search media" style={{ width: 220 }} />
          <button type="button" className="btn secondary small" onClick={onClose}>Close</button>
        </div>
        {!items && <p className="muted">Loading…</p>}
        {items && !items.length && <p className="muted">No images found. Upload images under Media.</p>}
        <div className="picker-grid">
          {items?.map((m) => (
            <button type="button" key={m.path} className="picker-item" onClick={() => onSelect(m)} title={m.path}>
              <span style={{ backgroundImage: `url("${m.path}")` }} />
              <small>{m.path.split("/").pop()}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Form field: an image path with preview, "Choose" and "Remove". */
export function ImageField({ name, altName, defaultValue, defaultAlt, label }: { name: string; altName?: string; defaultValue?: string | null; defaultAlt?: string; label: string }) {
  const [src, setSrc] = useState(defaultValue ?? "");
  const [alt, setAlt] = useState(defaultAlt ?? "");
  const [open, setOpen] = useState(false);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row" style={{ alignItems: "flex-start" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ width: 160, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} />
        ) : (
          <div style={{ width: 160, height: 100, borderRadius: 6, border: "1px dashed #cfd6df", display: "grid", placeItems: "center" }} className="muted small">No image</div>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <input type="hidden" name={name} value={src} />
          <div className="row" style={{ marginBottom: 8 }}>
            <button type="button" className="btn secondary small" onClick={() => setOpen(true)}>Choose from Media</button>
            {src && <button type="button" className="btn secondary small" onClick={() => setSrc("")}>Remove</button>}
          </div>
          {altName && <input type="text" name={altName} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text (describe the image)" aria-label={`${label} alt text`} />}
        </div>
      </div>
      {open && (
        <MediaPickerModal
          onClose={() => setOpen(false)}
          onSelect={(m) => {
            setSrc(m.path);
            if (!alt && m.alt_text) setAlt(m.alt_text);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
