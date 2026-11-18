"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, revokeSessions } from "@/lib/auth";
import { logActivity, one, sql, type BlockFields, type BlockRow, type PageRow } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password.mjs";
import { deleteUpload, saveUpload } from "@/lib/storage";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (url: string, msg: string, kind: "ok" | "err" = "ok"): never => {
  const [base, hash] = url.split("#");
  return redirect(`${base}${base.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}${hash ? "#" + hash : ""}`);
};
const revalidateAll = () => revalidatePath("/", "layout");

/* ---------------- Pages ---------------- */

export async function savePageSettings(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const page = await one<PageRow>(`SELECT * FROM pages WHERE id = $1`, [id]);
  if (!page) back("/admin/pages/", "Page not found.", "err");
  const title = str(formData, "title");
  if (!title) back(`/admin/pages/${id}/`, "The page title can't be empty.", "err");
  const status = formData.get("status") === "draft" ? "draft" : "published";
  if (page!.path === "/" && status === "draft") back(`/admin/pages/${id}/`, "The home page can't be unpublished.", "err");
  const canonical = str(formData, "canonical");
  if (canonical && !/^https:\/\/[^\s]+$/.test(canonical)) back(`/admin/pages/${id}/`, "Canonical URL must start with https://", "err");
  const noindex = formData.get("noindex") === "on";
  const robots = noindex ? "noindex, follow" : "max-image-preview:large";
  await sql(
    `UPDATE pages SET title=$2, meta_description=$3, canonical=$4, robots=$5, in_sitemap=$6, status=$7, updated_at=now(), updated_by=$8 WHERE id=$1`,
    [id, title, str(formData, "meta_description") || null, canonical || null, robots, formData.get("in_sitemap") === "on" && !noindex, status, user.id]
  );
  await logActivity(user.id, "updated page settings", "page", id, { path: page!.path });
  revalidatePath(page!.path);
  revalidatePath("/sitemap.xml");
  back(`/admin/pages/${id}/`, "Page settings saved.");
}

function fieldsFromForm(formData: FormData, original: BlockFields): BlockFields {
  if (typeof original.html === "string") return { html: String(formData.get("html") ?? "") };
  return {
    texts: (original.texts ?? []).map((_, i) => String(formData.get(`text_${i}`) ?? "")),
    links: (original.links ?? []).map((_, i) => ({ href: str(formData, `href_${i}`) })),
    images: (original.images ?? []).map((_, i) => ({ src: str(formData, `src_${i}`), alt: str(formData, `alt_${i}`) })),
  };
}

export async function saveBlock(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("block_id"));
  const returnTo = str(formData, "return_to") || "/admin/pages/";
  const block = await one<BlockRow & { path: string | null }>(
    `SELECT b.*, p.path FROM blocks b LEFT JOIN pages p ON p.id = b.page_id WHERE b.id = $1`,
    [id]
  );
  if (!block) back(returnTo, "Block not found.", "err");
  const reset = formData.get("reset") === "1";
  let content: BlockFields | null = reset ? null : fieldsFromForm(formData, block!.original);
  if (content && JSON.stringify(content) === JSON.stringify(block!.original)) content = null;
  for (const l of content?.links ?? []) {
    if (/^\s*(javascript|data|vbscript):/i.test(l.href)) back(returnTo, "That link address isn't allowed.", "err");
  }
  await sql(`UPDATE blocks SET content=$2, updated_at=now(), updated_by=$3 WHERE id=$1`, [id, content ? JSON.stringify(content) : null, user.id]);
  if (block!.page_id) await sql(`UPDATE pages SET updated_at=now(), updated_by=$2 WHERE id=$1`, [block!.page_id, user.id]);
  await logActivity(user.id, reset ? "reset content block" : "edited content block", block!.page_id ? "page" : "footer", block!.page_id ?? block!.element_id, {
    element: block!.element_id,
    label: block!.label,
  });
  if (block!.path) revalidatePath(block!.path);
  else revalidateAll();
  back(`${returnTo}#block-${id}`, reset ? "Block restored to the original content." : "Content saved and published.");
}

/* ---------------- Enquiries ---------------- */

export async function setEnquiryStatus(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const status = str(formData, "status");
  if (!["new", "read", "archived"].includes(status)) return;
  await sql(`UPDATE submissions SET status=$2 WHERE id=$1`, [id, status]);
  await logActivity(user.id, `marked enquiry ${status}`, "enquiry", id);
  revalidatePath("/admin", "layout");
  const returnTo = str(formData, "return_to");
  if (returnTo) redirect(returnTo);
}

export async function deleteEnquiry(formData: FormData) {
  const user = await requireUser("admin");
  const id = Number(formData.get("id"));
  await sql(`DELETE FROM submissions WHERE id=$1`, [id]);
  await logActivity(user.id, "deleted enquiry", "enquiry", id);
  back("/admin/enquiries/", "Enquiry deleted.");
}

/* ---------------- Media ---------------- */

export async function saveMediaAlt(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  await sql(`UPDATE media SET alt_text=$2, title=COALESCE(NULLIF($3,''), title) WHERE id=$1`, [id, str(formData, "alt_text").slice(0, 300), str(formData, "title").slice(0, 200)]);
  await logActivity(user.id, "updated media details", "media", id);
  revalidateAll();
  back(str(formData, "return_to") || "/admin/media/", "Media details saved.");
}

const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "application/pdf": ".pdf",
};

export async function uploadMedia(formData: FormData) {
  const user = await requireUser();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) back("/admin/media/", "Choose at least one file.", "err");
  const now = new Date();
  const sub = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  let n = 0;
  for (const f of files) {
    const ext = UPLOAD_TYPES[f.type];
    if (!ext) back("/admin/media/", `${f.name}: only JPG, PNG, WebP, GIF and PDF files can be uploaded.`, "err");
    if (f.size > 10 * 1024 * 1024) back("/admin/media/", `${f.name} is larger than 10 MB.`, "err");
    const base = f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
    const stored = await saveUpload(sub, base, ext, Buffer.from(await f.arrayBuffer()), f.type);
    await sql(`INSERT INTO media (path, mime_type, filesize, title, source) VALUES ($1,$2,$3,$4,'upload')`, [stored, f.type, f.size, base.replace(/-/g, " ")]);
    n++;
  }
  await logActivity(user.id, `uploaded ${n} file${n === 1 ? "" : "s"}`, "media");
  back("/admin/media/?source=upload", `${n} file${n === 1 ? "" : "s"} uploaded.`);
}

export async function deleteMedia(formData: FormData) {
  const user = await requireUser("admin");
  const id = Number(formData.get("id"));
  const m = await one<{ path: string; source: string }>(`SELECT path, source FROM media WHERE id=$1`, [id]);
  if (!m) back("/admin/media/", "File not found.", "err");
  if (m!.source !== "upload") back("/admin/media/", "Migrated WordPress files can't be deleted here (pages may still use them).", "err");
  await deleteUpload(m!.path);
  await sql(`DELETE FROM media WHERE id=$1`, [id]);
  await logActivity(user.id, "deleted media", "media", id, { path: m!.path });
  back("/admin/media/?source=upload", "File deleted.");
}

/* ---------------- Menu ---------------- */

export async function saveMenu(formData: FormData) {
  const user = await requireUser();
  const labels = formData.getAll("label").map(String);
  const urls = formData.getAll("url").map(String);
  const newTabs = new Set(formData.getAll("new_tab").map(String));
  const items = labels
    .map((label, i) => ({ label: label.trim(), url: (urls[i] ?? "").trim(), new_tab: newTabs.has(String(i)) }))
    .filter((it) => it.label && it.url);
  for (const it of items) {
    if (!/^(\/|https?:\/\/|mailto:|tel:)/.test(it.url)) back("/admin/menu/", `"${it.url}" isn't a valid link. Use /path/, https://… or mailto:`, "err");
  }
  await sql(`DELETE FROM menu_items WHERE menu='main'`);
  for (const [i, it] of items.entries()) {
    await sql(`INSERT INTO menu_items (menu, label, url, position, new_tab) VALUES ('main',$1,$2,$3,$4)`, [it.label, it.url, i + 1, it.new_tab]);
  }
  await logActivity(user.id, "updated the main menu", "menu", null, { items: items.length });
  revalidateAll();
  back("/admin/menu/", "Menu saved and published.");
}

/* ---------------- Redirects ---------------- */

const normaliseSource = (s: string) => {
  let p = s.trim().replace(/^https?:\/\/[^/]+/i, "");
  if (!p.startsWith("/")) p = "/" + p;
  if (!/\.[a-z0-9]+$/i.test(p) && !p.endsWith("/")) p += "/";
  return p;
};

export async function saveRedirect(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id") || 0);
  const source = normaliseSource(str(formData, "source"));
  const destination = str(formData, "destination");
  const code = Number(formData.get("status_code")) || 301;
  if (source === "/" || source.startsWith("/admin") || source.startsWith("/api/")) back("/admin/redirects/", "That source path can't be redirected.", "err");
  if (!destination || !/^(\/|https?:\/\/)/.test(destination)) back("/admin/redirects/", "Destination must be a /path/ or a full https:// address.", "err");
  if (destination === source) back("/admin/redirects/", "A redirect can't point to itself.", "err");
  const page = await one(`SELECT id FROM pages WHERE path=$1 AND status='published'`, [source]);
  if (page) back("/admin/redirects/", `${source} is a published page. Unpublish it first, or the page would become unreachable.`, "err");
  try {
    if (id) await sql(`UPDATE redirects SET source=$2, destination=$3, status_code=$4, note=$5 WHERE id=$1`, [id, source, destination, code, str(formData, "note")]);
    else await sql(`INSERT INTO redirects (source, destination, status_code, note) VALUES ($1,$2,$3,$4)`, [source, destination, code, str(formData, "note")]);
  } catch {
    back("/admin/redirects/", `A redirect from ${source} already exists.`, "err");
  }
  await logActivity(user.id, id ? "updated redirect" : "added redirect", "redirect", id || source, { source, destination, code });
  back("/admin/redirects/", "Redirect saved. It takes effect within 30 seconds.");
}

export async function deleteRedirect(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const r = await one<{ source: string }>(`DELETE FROM redirects WHERE id=$1 RETURNING source`, [id]);
  await logActivity(user.id, "deleted redirect", "redirect", id, r);
  back("/admin/redirects/", "Redirect deleted.");
}

/* ---------------- Users ---------------- */

export async function createUser(formData: FormData) {
  const admin = await requireUser("admin");
  const email = str(formData, "email").toLowerCase();
  const name = str(formData, "name");
  const role = formData.get("role") === "admin" ? "admin" : "editor";
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) back("/admin/users/", "Enter a name and a valid email.", "err");
  const problem = passwordProblem(password);
  if (problem) back("/admin/users/", problem, "err");
  try {
    await sql(`INSERT INTO users (email, name, role, password_hash) VALUES ($1,$2,$3,$4)`, [email, name, role, hashPassword(password)]);
  } catch {
    back("/admin/users/", "A user with that email already exists.", "err");
  }
  await logActivity(admin.id, "created user", "user", email, { role });
  back("/admin/users/", `${name} can now sign in.`);
}

export async function updateUser(formData: FormData) {
  const admin = await requireUser("admin");
  const id = Number(formData.get("id"));
  const role = formData.get("role") === "admin" ? "admin" : "editor";
  const active = formData.get("active") === "on";
  if (id === admin.id && (role !== "admin" || !active)) back("/admin/users/", "You can't remove your own administrator access.", "err");
  if (role !== "admin" || !active) {
    const others = await one<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE role='admin' AND active AND id <> $1`, [id]);
    if (!others?.n) back("/admin/users/", "At least one active administrator is required.", "err");
  }
  await sql(`UPDATE users SET role=$2, active=$3 WHERE id=$1`, [id, role, active]);
  if (!active) await revokeSessions(id);
  const password = String(formData.get("password") ?? "");
  if (password) {
    const problem = passwordProblem(password);
    if (problem) back("/admin/users/", problem, "err");
    await sql(`UPDATE users SET password_hash=$2 WHERE id=$1`, [id, hashPassword(password)]);
    if (id !== admin.id) await revokeSessions(id);
  }
  await logActivity(admin.id, "updated user", "user", id, { role, active, passwordReset: !!password });
  back("/admin/users/", "User updated.");
}

export async function changeOwnPassword(formData: FormData) {
  const user = await requireUser();
  const row = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id=$1`, [user.id]);
  if (!row || !verifyPassword(String(formData.get("current") ?? ""), row.password_hash)) back("/admin/account/", "Current password is incorrect.", "err");
  const next = String(formData.get("next") ?? "");
  const problem = passwordProblem(next);
  if (problem) back("/admin/account/", problem, "err");
  if (next !== String(formData.get("confirm") ?? "")) back("/admin/account/", "The new passwords don't match.", "err");
  await sql(`UPDATE users SET password_hash=$2 WHERE id=$1`, [user.id, hashPassword(next)]);
  await logActivity(user.id, "changed own password", "user", user.id);
  back("/admin/account/", "Password changed.");
}

/* ---------------- Settings ---------------- */

export async function saveSettings(formData: FormData) {
  const admin = await requireUser("admin");
  const email = str(formData, "contact_email");
  const recipient = str(formData, "notify_recipient");
  for (const e of [email, recipient]) if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) back("/admin/settings/", `"${e}" isn't a valid email.`, "err");
  // The brochure must be a PDF in the media library.
  const brochureUrl = str(formData, "brochure_url");
  if (brochureUrl && !(await sql(`SELECT 1 FROM media WHERE path = $1 AND mime_type = 'application/pdf'`, [brochureUrl])).length) {
    back("/admin/settings/", "Choose the brochure from the PDFs in Media.", "err");
  }
  const values = {
    site: { name: str(formData, "site_name") || "Bridge and Value", titleSuffix: " – " + (str(formData, "site_name") || "Bridge and Value") },
    contact: { email, address: str(formData, "contact_address") },
    seo: { googleVerification: str(formData, "google_verification").replace(/[^A-Za-z0-9_-]/g, "") },
    notifications: { recipient },
    brochure: { url: brochureUrl },
  };
  for (const [k, v] of Object.entries(values)) {
    await sql(`INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [k, JSON.stringify(v)]);
  }
  await logActivity(admin.id, "updated site settings", "settings");
  revalidateAll();
  back("/admin/settings/", "Settings saved.");
}
