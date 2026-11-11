"use client";

import { useEffect, useRef, useState } from "react";
import { MediaPickerModal } from "./MediaPicker";

/*
 * Lightweight WYSIWYG editor for posts and pages. Produces simple semantic
 * HTML (p, h2–h4, strong, em, u, a, ul/ol/li, blockquote, img, br) that the
 * theme already styles. The server sanitises everything again on save.
 */

const ALLOWED: Record<string, string[]> = {
  P: [], H2: [], H3: [], H4: [], STRONG: [], B: [], EM: [], I: [], U: [], BR: [], UL: [], OL: [], LI: [], BLOCKQUOTE: [],
  A: ["href", "target", "rel"], IMG: ["src", "alt"], FIGURE: [], FIGCAPTION: [],
};

/** Keep only allowed tags/attributes (used for pasted content, e.g. from Word or Google Docs). */
function clean(html: string) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      walk(child);
      const tag = child.tagName;
      if (!(tag in ALLOWED)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "META", "LINK"].includes(tag)) child.remove();
        else if (tag === "DIV" || tag === "SECTION") {
          const p = doc.createElement("p");
          p.append(...Array.from(child.childNodes));
          child.replaceWith(p);
        } else child.replaceWith(...Array.from(child.childNodes)); // unwrap span, font, etc.
        continue;
      }
      for (const a of Array.from(child.attributes)) if (!ALLOWED[tag].includes(a.name)) child.removeAttribute(a.name);
      if (tag === "A" && /^\s*javascript:/i.test(child.getAttribute("href") ?? "")) child.removeAttribute("href");
    }
  };
  const root = doc.body.firstElementChild!;
  walk(root);
  return root.innerHTML.replace(/<p>\s*<\/p>/g, "");
}

export default function RichEditor({ name, defaultValue, label }: { name: string; defaultValue: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue);
  const [source, setSource] = useState(false);
  const [picking, setPicking] = useState(false);
  const saved = useRef<Range | null>(null);

  useEffect(() => {
    if (ref.current && !source) ref.current.innerHTML = html || "<p></p>";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const sync = () => ref.current && setHtml(ref.current.innerHTML);
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    sync();
  };
  const block = (tag: string) => exec("formatBlock", tag);
  const link = () => {
    const url = window.prompt("Link address (https://… or /page/)");
    if (url === null) return;
    if (!url) return exec("unlink");
    if (/^\s*javascript:/i.test(url)) return;
    exec("createLink", url);
  };
  const saveSelection = () => {
    const sel = window.getSelection();
    saved.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  };
  const insertImage = (path: string, alt: string) => {
    setPicking(false);
    ref.current?.focus();
    if (saved.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(saved.current);
    }
    const safeAlt = alt.replace(/"/g, "&quot;").replace(/</g, "&lt;");
    document.execCommand("insertHTML", false, `<p><img src="${path}" alt="${safeAlt}"></p>`);
    sync();
  };

  const B = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={source}>
      {children}
    </button>
  );

  return (
    <div className="field">
      <label>{label}</label>
      <div className="rte">
        <div className="rte-bar" role="toolbar" aria-label="Formatting">
          <B title="Paragraph" onClick={() => block("P")}>¶</B>
          <B title="Heading 2" onClick={() => block("H2")}>H2</B>
          <B title="Heading 3" onClick={() => block("H3")}>H3</B>
          <B title="Heading 4" onClick={() => block("H4")}>H4</B>
          <span className="sep" />
          <B title="Bold" onClick={() => exec("bold")}><strong>B</strong></B>
          <B title="Italic" onClick={() => exec("italic")}><em>I</em></B>
          <B title="Underline" onClick={() => exec("underline")}><u>U</u></B>
          <span className="sep" />
          <B title="Bulleted list" onClick={() => exec("insertUnorderedList")}>• List</B>
          <B title="Numbered list" onClick={() => exec("insertOrderedList")}>1. List</B>
          <B title="Quote" onClick={() => block("BLOCKQUOTE")}>❝</B>
          <span className="sep" />
          <B title="Link" onClick={link}>Link</B>
          <B title="Insert image" onClick={() => { saveSelection(); setPicking(true); }}>Image</B>
          <B title="Clear formatting" onClick={() => exec("removeFormat")}>Clear</B>
          <span className="spacer" />
          <button type="button" className={source ? "on" : ""} onClick={() => { if (!source) sync(); setSource(!source); }} title="Edit HTML">
            {source ? "Visual" : "HTML"}
          </button>
        </div>
        {source ? (
          <textarea className="code rte-source" value={html} onChange={(e) => setHtml(e.target.value)} aria-label={`${label} (HTML)`} />
        ) : (
          <div
            ref={ref}
            className="rte-area entry-content"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={label}
            onInput={sync}
            onBlur={sync}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text/html");
              if (!pasted) return; // plain text pastes normally
              e.preventDefault();
              document.execCommand("insertHTML", false, clean(pasted));
              sync();
            }}
          />
        )}
        <textarea name={name} value={html} readOnly hidden />
      </div>
      {picking && <MediaPickerModal onClose={() => setPicking(false)} onSelect={(m) => insertImage(m.path, m.alt_text)} />}
    </div>
  );
}
