import "server-only";
import { sql } from "@/lib/db";
import { sanitizeHtml } from "@/lib/blocks.mjs";
import { withMediaHost } from "@/lib/media";

/** A row of the popups table (lib/db/migrations/0004_popups.sql). */
export type PopupRow = {
  id: number;
  kind: "custom" | "elementor";
  name: string;
  elementor_id: string | null;
  heading: string;
  body_html: string;
  image: string | null;
  image_alt: string;
  button_text: string;
  button_url: string;
  target: "all" | "home" | "pages";
  paths: string[];
  delay_seconds: number;
  frequency: "always" | "session" | "day" | "once";
  starts_at: string | null;
  ends_at: string | null;
  enabled: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

/** What the browser needs to open a pop-up (components/SiteBehaviors.tsx). */
export type PopupConfig = {
  id: number;
  kind: "custom" | "elementor";
  elementorId: string | null;
  /** Custom pop-ups: their ready-made markup. */
  html: string | null;
  delaySeconds: number;
  frequency: PopupRow["frequency"];
  startsAt: string | null;
  endsAt: string | null;
  /** Changes when the pop-up is edited, so "once" / "once a day" start again for a new version. */
  version: string;
};

export const FREQUENCY_LABEL: Record<PopupRow["frequency"], string> = {
  always: "Every page view",
  session: "Once per visit",
  day: "Once a day",
  once: "Only once",
};

/** Links a pop-up button may use: site paths, web addresses, email and phone. */
export const SAFE_URL = /^(\/(?!\/)|https?:\/\/|mailto:|tel:)/i;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Where a pop-up shows, in words, for the admin list. */
export function targetLabel(p: Pick<PopupRow, "target" | "paths">): string {
  if (p.target === "all") return "All pages";
  if (p.target === "home") return "Home page";
  return p.paths.length ? p.paths.join(", ") : "No pages chosen";
}

/** Live, scheduled, ended or off, for the admin list. */
export function popupStatus(p: Pick<PopupRow, "enabled" | "starts_at" | "ends_at">, now = new Date()): "live" | "scheduled" | "ended" | "off" {
  if (!p.enabled) return "off";
  if (p.ends_at && new Date(p.ends_at) <= now) return "ended";
  if (p.starts_at && new Date(p.starts_at) > now) return "scheduled";
  return "live";
}

/** Markup of a pop-up created in the admin; styled by public/bv-popup.css. */
export function customPopupHtml(p: PopupRow): string {
  const image = p.image ? `<div class="bv-popup__media"><img src="${esc(withMediaHost(p.image))}" alt="${esc(p.image_alt)}" loading="lazy" /></div>` : "";
  const button =
    p.button_text && SAFE_URL.test(p.button_url)
      ? `<a class="bv-popup__button" href="${esc(p.button_url)}"${/^https?:\/\//i.test(p.button_url) ? ' target="_blank" rel="noopener"' : ""}>${esc(p.button_text)}</a>`
      : "";
  return `<div class="bv-popup${image ? "" : " bv-popup--text"}" data-elementor-type="popup" data-elementor-id="bv-${p.id}" role="document" aria-labelledby="bv-popup-${p.id}-title">
${image}<div class="bv-popup__body">
${p.heading ? `<h2 class="bv-popup__title" id="bv-popup-${p.id}-title">${esc(p.heading)}</h2>` : ""}
<div class="bv-popup__text">${sanitizeHtml(p.body_html)}</div>
${button}
</div></div>`;
}

/**
 * The pop-ups that may appear on a page, in display order. Whether one is within its dates is
 * checked again in the browser, because pages are cached for up to an hour.
 */
export async function popupsFor(path: string): Promise<PopupConfig[]> {
  let rows: PopupRow[];
  try {
    rows = await sql<PopupRow>(
      `SELECT * FROM popups WHERE enabled AND (ends_at IS NULL OR ends_at > now()) ORDER BY position, id`
    );
  } catch {
    return []; // before the migration has run
  }
  return rows
    .filter((p) => p.target === "all" || (p.target === "home" ? path === "/" : p.paths.includes(path)))
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      elementorId: p.elementor_id,
      html: p.kind === "custom" ? customPopupHtml(p) : null,
      delaySeconds: p.delay_seconds,
      frequency: p.frequency,
      startsAt: p.starts_at ? new Date(p.starts_at).toISOString() : null,
      endsAt: p.ends_at ? new Date(p.ends_at).toISOString() : null,
      version: `${p.id}-${new Date(p.updated_at).getTime()}`,
    }));
}
