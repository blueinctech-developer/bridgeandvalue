"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logActivity, one, sql } from "@/lib/db";
import { parisToUtc } from "@/lib/paris-time";
import { SAFE_URL, type PopupRow } from "@/lib/popups";

/** Admin → Pop-ups. Editors and administrators manage pop-ups; only administrators delete them. */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (url: string, msg: string, kind: "ok" | "err" = "ok"): never =>
  redirect(`${url}${url.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
// Every page may show a pop-up, and pages are cached: refresh them all.
const revalidateAll = () => revalidatePath("/", "layout");

const FREQUENCIES = ["always", "session", "day", "once"] as const;
const TARGETS = ["all", "home", "pages"] as const;

export async function savePopup(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id") || 0);
  const self = id ? `/admin/popups/${id}/` : "/admin/popups/new/";
  const current = id ? await one<PopupRow>(`SELECT * FROM popups WHERE id = $1`, [id]) : null;
  if (id && !current) back("/admin/popups/", "That pop-up no longer exists.", "err");
  const legacy = current?.kind === "elementor";

  const name = str(formData, "name").slice(0, 120);
  if (!name) back(self, "Give the pop-up a name (only shown here in the admin).", "err");

  const delay = Math.min(120, Math.max(0, Math.round(Number(formData.get("delay_seconds")) || 0)));
  const frequency = FREQUENCIES.find((f) => f === formData.get("frequency")) ?? "always";
  const startsInput = str(formData, "starts_at");
  const endsInput = str(formData, "ends_at");
  const startsAt = startsInput ? parisToUtc(startsInput) : null;
  const endsAt = endsInput ? parisToUtc(endsInput) : null;
  if ((startsInput && !startsAt) || (endsInput && !endsAt)) back(self, "Enter the dates as day and time.", "err");
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) back(self, "The end date must be after the start date.", "err");
  const enabled = formData.get("enabled") === "on";

  // Where it shows. The migrated pop-up's design lives in the home page's markup, so it stays there.
  let target: PopupRow["target"] = legacy ? "home" : TARGETS.find((t) => t === formData.get("target")) ?? "home";
  let paths: string[] = [];
  if (target === "pages") {
    const chosen = formData.getAll("paths").map(String);
    const valid = new Set((await sql<{ path: string }>(`SELECT path FROM pages WHERE status = 'published' AND kind <> 'system'`)).map((r) => r.path));
    paths = chosen.filter((p) => valid.has(p)).slice(0, 100);
    if (!paths.length) back(self, "Choose at least one page, or show the pop-up on all pages.", "err");
    if (paths.length === 1 && paths[0] === "/") { target = "home"; paths = []; }
  }

  // Content (pop-ups created here only; the migrated one is edited on the Home page).
  let content = {};
  if (!legacy) {
    const heading = str(formData, "heading").slice(0, 200);
    const bodyHtml = str(formData, "body_html").slice(0, 20000);
    const image = str(formData, "image") || null;
    const buttonText = str(formData, "button_text").slice(0, 60);
    const buttonUrl = str(formData, "button_url").slice(0, 500);
    if (!heading && !bodyHtml.replace(/<[^>]*>|&nbsp;/g, "").trim()) back(self, "Add a heading or some text.", "err");
    if (image && !(await one(`SELECT 1 FROM media WHERE path = $1`, [image]))) back(self, "Choose the image from Media.", "err");
    if (buttonText && !SAFE_URL.test(buttonUrl)) back(self, "The button link must start with /, https://, mailto: or tel:.", "err");
    content = { heading, body_html: bodyHtml, image, image_alt: str(formData, "image_alt").slice(0, 300), button_text: buttonText, button_url: buttonText ? buttonUrl : "" };
  }

  const values: Record<string, unknown> = { name, target, paths, delay_seconds: delay, frequency, starts_at: startsAt, ends_at: endsAt, enabled, ...content };
  const cols = Object.keys(values);
  let savedId = id;
  if (id) {
    await sql(`UPDATE popups SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`, [id, ...Object.values(values)]);
  } else {
    const position = (await one<{ n: number }>(`SELECT COALESCE(max(position), -1) + 1 AS n FROM popups`))?.n ?? 0;
    const row = await one<{ id: number }>(
      `INSERT INTO popups (kind, ${cols.join(", ")}, position) VALUES ('custom', ${cols.map((_, i) => `$${i + 1}`).join(", ")}, $${cols.length + 1}) RETURNING id`,
      [...Object.values(values), position]
    );
    savedId = row!.id;
  }
  await logActivity(user.id, id ? "updated pop-up" : "created pop-up", "popup", savedId, { name, enabled });
  revalidateAll();
  back(`/admin/popups/${savedId}/`, id ? "Pop-up saved." : "Pop-up created.");
}

/** On/off from the list. */
export async function togglePopup(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const row = await one<{ name: string; enabled: boolean }>(`UPDATE popups SET enabled = NOT enabled, updated_at = now() WHERE id = $1 RETURNING name, enabled`, [id]);
  if (!row) back("/admin/popups/", "That pop-up no longer exists.", "err");
  await logActivity(user.id, row!.enabled ? "turned on pop-up" : "turned off pop-up", "popup", id, { name: row!.name });
  revalidateAll();
  back("/admin/popups/", `“${row!.name}” is ${row!.enabled ? "on" : "off"}.`);
}

/** Up or down in the order (the first pop-up that matches a page is the one shown). */
export async function movePopup(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const rows = await sql<{ id: number }>(`SELECT id FROM popups ORDER BY position, id`);
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) back("/admin/popups/", "Already at the end of the list.", "err");
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [pos, r] of rows.entries()) await sql(`UPDATE popups SET position = $2 WHERE id = $1`, [r.id, pos]);
  revalidateAll();
  back("/admin/popups/", "Order saved.");
}

export async function deletePopup(formData: FormData) {
  const user = await requireUser("admin");
  const id = Number(formData.get("id"));
  const row = await one<{ name: string; kind: string }>(`SELECT name, kind FROM popups WHERE id = $1`, [id]);
  if (!row) back("/admin/popups/", "That pop-up no longer exists.", "err");
  if (row!.kind === "elementor") back("/admin/popups/", "The pop-up from WordPress can't be deleted; turn it off instead.", "err");
  await sql(`DELETE FROM popups WHERE id = $1`, [id]);
  await logActivity(user.id, "deleted pop-up", "popup", id, { name: row!.name });
  revalidateAll();
  back("/admin/popups/", `“${row!.name}” deleted.`);
}
