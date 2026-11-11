"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logActivity, one, sql, type PageRow } from "@/lib/db";
import { sanitizeHtml } from "@/lib/blocks.mjs";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (url: string, msg: string, kind: "ok" | "err" = "ok"): never => {
  const [base, hash] = url.split("#");
  return redirect(`${base}${base.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}${hash ? "#" + hash : ""}`);
};
const revalidateSite = () => revalidatePath("/", "layout");

/** URL-safe slug: lowercase ASCII, hyphens. */
export async function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// First path segments used by the site itself or kept for WordPress URLs.
const RESERVED = new Set([
  "admin", "api", "blog", "category", "tag", "search", "uploads", "wp-content", "wp-includes", "wp-admin", "wp-login.php",
  "feed", "page", "author", "project", "services", "project-cat", "elementor-hf", "sitemap.xml", "robots.txt", "_next", "home",
]);

/** Returns an error message if /slug/ is not free for a new post or page. */
async function slugProblem(slug: string, own: { postId?: number; pageId?: number } = {}) {
  if (!slug) return "Enter a URL slug (letters, numbers and hyphens).";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "The slug can only contain lowercase letters, numbers and hyphens.";
  if (RESERVED.has(slug)) return `/${slug}/ is reserved by the website. Choose another slug.`;
  const page = await one<{ id: number }>(`SELECT id FROM pages WHERE path = $1`, [`/${slug}/`]);
  if (page && page.id !== own.pageId) return `/${slug}/ is already used by a page.`;
  const post = await one<{ id: number }>(`SELECT id FROM posts WHERE slug = $1`, [slug]);
  if (post && post.id !== own.postId) return `/${slug}/ is already used by a blog post.`;
  const red = await one(`SELECT 1 FROM redirects WHERE source = $1`, [`/${slug}/`]);
  if (red) return `/${slug}/ is a redirect. Delete the redirect first if you want to reuse this address.`;
  return null;
}

/** "2026-11-12T09:30" entered in Paris time → ISO UTC. */
function parisToUtc(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const asUtc = new Date(local + ":00Z");
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(asUtc);
  const g = (t: string) => parts.find((p) => p.type === t)?.value;
  const parisOfUtc = new Date(`${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:00Z`);
  return new Date(asUtc.getTime() - (parisOfUtc.getTime() - asUtc.getTime())).toISOString();
}

/* ---------------- Posts ---------------- */

export async function savePost(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id") || 0);
  const title = str(formData, "title");
  const self = id ? `/admin/posts/${id}/` : "/admin/posts/new/";
  if (!title) back(self, "Give the post a title.", "err");
  const slug = str(formData, "slug") || (await slugify(title));
  const problem = await slugProblem(slug, { postId: id });
  if (problem) back(self, problem, "err");

  const intent = str(formData, "intent"); // save | publish | unpublish
  const current = id ? await one<{ status: string; published_at: string | null }>(`SELECT status, published_at FROM posts WHERE id = $1`, [id]) : null;
  let status = current?.status ?? "draft";
  if (intent === "publish") status = "published";
  if (intent === "unpublish") status = "draft";
  const dateInput = str(formData, "published_at");
  let publishedAt = dateInput ? parisToUtc(dateInput) : current?.published_at ?? null;
  if (dateInput && !publishedAt) back(self, "The publish date isn't valid.", "err");
  if (status === "published" && !publishedAt) publishedAt = new Date().toISOString();

  const content = sanitizeHtml(String(formData.get("content_html") ?? ""));
  const values = [
    slug, title, str(formData, "excerpt").slice(0, 600), content, str(formData, "featured_image") || null, str(formData, "featured_alt").slice(0, 300),
    status, publishedAt, str(formData, "meta_title").slice(0, 200) || null, str(formData, "meta_description").slice(0, 320) || null,
    formData.get("noindex") === "on", user.id,
  ];
  let postId = id;
  if (id) {
    await sql(
      `UPDATE posts SET slug=$1, title=$2, excerpt=$3, content_html=$4, featured_image=$5, featured_alt=$6, status=$7, published_at=$8,
              meta_title=$9, meta_description=$10, noindex=$11, updated_by=$12, updated_at=now() WHERE id=$13`,
      [...values, id]
    );
  } else {
    const r = await one<{ id: number }>(
      `INSERT INTO posts (slug, title, excerpt, content_html, featured_image, featured_alt, status, published_at, meta_title, meta_description, noindex, updated_by, author_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`,
      values
    );
    postId = r!.id;
  }
  const termIds = formData.getAll("terms").map(Number).filter(Boolean);
  await sql(`DELETE FROM post_terms WHERE post_id = $1`, [postId]);
  for (const t of termIds) await sql(`INSERT INTO post_terms (post_id, term_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [postId, t]);

  await logActivity(user.id, id ? (intent === "publish" ? "published post" : intent === "unpublish" ? "unpublished post" : "updated post") : "created post", "post", postId, { slug, status });
  revalidateSite();
  const scheduled = status === "published" && publishedAt && new Date(publishedAt) > new Date();
  const msg = status === "published" ? (scheduled ? "Post scheduled. It will appear on the blog at the publish date (within an hour)." : "Post published.") : intent === "unpublish" ? "Post moved back to draft." : "Draft saved.";
  back(`/admin/posts/${postId}/`, msg);
}

export async function deletePost(formData: FormData) {
  const user = await requireUser("admin");
  const id = Number(formData.get("id"));
  const p = await one<{ slug: string; title: string }>(`DELETE FROM posts WHERE id = $1 RETURNING slug, title`, [id]);
  await logActivity(user.id, "deleted post", "post", id, p);
  revalidateSite();
  back("/admin/posts/", "Post deleted. Consider adding a redirect from its old address if it was published.");
}

/* ---------------- Categories & tags ---------------- */

export async function saveTerm(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id") || 0);
  const taxonomy = formData.get("taxonomy") === "tag" ? "tag" : "category";
  const name = str(formData, "name");
  if (!name) back("/admin/categories/", "Enter a name.", "err");
  const slug = str(formData, "slug") || (await slugify(name));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) back("/admin/categories/", "The slug can only contain lowercase letters, numbers and hyphens.", "err");
  try {
    if (id) await sql(`UPDATE terms SET name=$2, slug=$3, description=$4 WHERE id=$1`, [id, name, slug, str(formData, "description")]);
    else await sql(`INSERT INTO terms (taxonomy, name, slug, description) VALUES ($1,$2,$3,$4)`, [taxonomy, name, slug, str(formData, "description")]);
  } catch {
    back("/admin/categories/", `A ${taxonomy} with the slug "${slug}" already exists.`, "err");
  }
  await logActivity(user.id, id ? `updated ${taxonomy}` : `created ${taxonomy}`, taxonomy, id || slug, { name, slug });
  revalidateSite();
  back("/admin/categories/", `${taxonomy === "tag" ? "Tag" : "Category"} saved.`);
}

export async function deleteTerm(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const t = await one<{ taxonomy: string; name: string }>(`DELETE FROM terms WHERE id = $1 RETURNING taxonomy, name`, [id]);
  await logActivity(user.id, `deleted ${t?.taxonomy ?? "term"}`, t?.taxonomy ?? "term", id, t);
  revalidateSite();
  back("/admin/categories/", "Deleted. Posts that used it are unchanged otherwise.");
}

/* ---------------- New pages ---------------- */

export async function createPage(formData: FormData) {
  const user = await requireUser();
  const title = str(formData, "title");
  if (!title) back("/admin/pages/new/", "Give the page a title.", "err");
  const slug = str(formData, "slug") || (await slugify(title));
  const problem = await slugProblem(slug);
  if (problem) back("/admin/pages/new/", problem, "err");
  const shell = await one<PageRow>(`SELECT stylesheets, inline_styles FROM pages WHERE path = '/blog/'`);
  const r = await one<{ id: number }>(
    `INSERT INTO pages (path, slug, kind, status, title, canonical, robots, in_sitemap, body_class, stylesheets, inline_styles, html, content_html, updated_by)
     VALUES ($1,$2,'custom','draft',$3,$4,'max-image-preview:large',true,'',$5,$6,'','<p></p>',$7) RETURNING id`,
    [`/${slug}/`, slug, `${title} – Bridge and Value`, `https://bridgeandvalue.com/${slug}/`, JSON.stringify(shell?.stylesheets ?? []), shell?.inline_styles ?? "", user.id]
  );
  await logActivity(user.id, "created page", "page", r!.id, { path: `/${slug}/` });
  back(`/admin/pages/${r!.id}/`, "Page created as a draft. Add your content, then publish it.");
}

export async function saveCustomPage(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const page = await one<PageRow>(`SELECT * FROM pages WHERE id = $1 AND kind = 'custom'`, [id]);
  if (!page) back("/admin/pages/", "Page not found.", "err");
  const self = `/admin/pages/${id}/`;
  const title = str(formData, "title");
  if (!title) back(self, "Give the page a title.", "err");
  const slug = str(formData, "slug") || page!.slug;
  const problem = await slugProblem(slug, { pageId: id });
  if (problem) back(self, problem, "err");
  const intent = str(formData, "intent");
  const status = intent === "publish" ? "published" : intent === "unpublish" ? "draft" : page!.status;
  const noindex = formData.get("noindex") === "on";
  const fullTitle = /–\s*Bridge and Value$/.test(title) ? title : `${title} – Bridge and Value`;
  await sql(
    `UPDATE pages SET path=$2, slug=$3, title=$4, meta_description=$5, content_html=$6, hero_image=$7, status=$8,
            robots=$9, in_sitemap=$10, canonical=$11, updated_at=now(), updated_by=$12 WHERE id=$1`,
    [id, `/${slug}/`, slug, fullTitle, str(formData, "meta_description").slice(0, 320) || null, sanitizeHtml(String(formData.get("content_html") ?? "")),
     str(formData, "hero_image") || null, status, noindex ? "noindex, follow" : "max-image-preview:large", !noindex, `https://bridgeandvalue.com/${slug}/`, user.id]
  );
  if (page!.path !== `/${slug}/` && page!.status === "published") {
    // Keep the old address working.
    await sql(`INSERT INTO redirects (source, destination, status_code, note) VALUES ($1,$2,301,'Page address changed') ON CONFLICT (source) DO UPDATE SET destination = EXCLUDED.destination`, [page!.path, `/${slug}/`]);
  }
  await logActivity(user.id, intent === "publish" ? "published page" : intent === "unpublish" ? "unpublished page" : "updated page", "page", id, { path: `/${slug}/` });
  revalidateSite();
  back(self, status === "published" ? (intent === "publish" ? "Page published." : "Page saved and live.") : intent === "unpublish" ? "Page moved back to draft." : "Draft saved.");
}

export async function deleteCustomPage(formData: FormData) {
  const user = await requireUser("admin");
  const id = Number(formData.get("id"));
  const p = await one<{ path: string }>(`DELETE FROM pages WHERE id = $1 AND kind = 'custom' RETURNING path`, [id]);
  if (!p) back("/admin/pages/", "Only pages created in this admin can be deleted.", "err");
  await logActivity(user.id, "deleted page", "page", id, p);
  revalidateSite();
  back("/admin/pages/?kind=custom", "Page deleted. Consider adding a redirect from its old address if it was published.");
}

/* One action per button: React doesn't reliably send the clicked button's
   name/value when the form also contains a button with its own formAction. */
const withIntent = (fn: (f: FormData) => Promise<void>, intent: string) => async (f: FormData) => {
  f.set("intent", intent);
  return fn(f);
};
export async function savePostDraft(f: FormData) { return withIntent(savePost, "save")(f); }
export async function publishPost(f: FormData) { return withIntent(savePost, "publish")(f); }
export async function unpublishPost(f: FormData) { return withIntent(savePost, "unpublish")(f); }
export async function saveCustomPageDraft(f: FormData) { return withIntent(saveCustomPage, "save")(f); }
export async function publishCustomPage(f: FormData) { return withIntent(saveCustomPage, "publish")(f); }
export async function unpublishCustomPage(f: FormData) { return withIntent(saveCustomPage, "unpublish")(f); }
