import "server-only";
import { getClient } from "./client.mjs";

/** Run a parameterised SQL query and return its rows. */
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await getClient();
  const res = await db.query<T>(text, params);
  return res.rows;
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await sql<T>(text, params))[0] ?? null;
}

export type User = { id: number; email: string; name: string; role: "admin" | "editor"; active: boolean; created_at: string; last_login_at: string | null };

export type PageRow = {
  id: number; path: string; slug: string; kind: string; status: "published" | "draft"; title: string;
  meta_description: string | null; canonical: string | null; robots: string | null; in_sitemap: boolean;
  body_class: string; stylesheets: string[]; inline_styles: string; sliders: unknown[]; html: string;
  wp_id: number | null; updated_at: string; updated_by: number | null;
  content_html: string | null; hero_image: string | null;
};

export type BlockFields = { html?: string; texts?: string[]; links?: { href: string }[]; images?: { src: string; alt: string }[] };
export type BlockRow = {
  id: number; page_id: number | null; element_id: string; widget_type: string; position: number; label: string;
  original: BlockFields; content: BlockFields | null; updated_at: string | null;
};

export type Settings = {
  site: { name: string; titleSuffix: string };
  contact: { email: string; address: string };
  seo: { googleVerification: string };
  popup: { enabled: boolean; delaySeconds: number };
  notifications: { recipient: string };
  /** The PDF emailed to visitors who use the footer's "Request our Brochure" form. */
  brochure?: { url: string };
};

export async function getSettings(): Promise<Settings> {
  const rows = await sql<{ key: keyof Settings; value: unknown }>(`SELECT key, value FROM settings`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as unknown as Settings;
}

export async function logActivity(userId: number | null, action: string, entity: string, entityId?: string | number | null, detail?: unknown) {
  await sql(`INSERT INTO activity (user_id, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5)`, [
    userId, action, entity, entityId == null ? null : String(entityId), detail == null ? null : JSON.stringify(detail),
  ]);
}
