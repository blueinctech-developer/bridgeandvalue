/**
 * Copies media to the S3 media bucket (lib/media.ts, lib/storage.ts).
 *
 *   node --env-file=.env.prod.local scripts/move-media-to-s3.mjs           report only
 *   node --env-file=.env.prod.local scripts/move-media-to-s3.mjs --apply   copy and check
 *
 * 1. The migrated WordPress images and PDFs in public/wp-content/uploads are copied to
 *    the bucket at the same paths (wp-content/uploads/…). Pages point at them once
 *    S3_MEDIA_BUCKET is set on the site; the copies in public/ stay as a fallback.
 * 2. With DATABASE_URL set, admin uploads still on Vercel Blob are copied to uploads/…
 *    and every link to them (media, pages, blocks, posts, settings) is switched in one
 *    transaction, only after every file was copied and checked. Blob files stay in place.
 *
 * Needs S3_MEDIA_BUCKET and an AWS key (S3_* or SES_* names).
 */
import fs from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const APPLY = process.argv.includes("--apply");
const env = process.env;
const bucket = env.S3_MEDIA_BUCKET;
const region = env.S3_REGION || env.SES_REGION || "us-east-1";
const accessKeyId = env.S3_ACCESS_KEY_ID || env.SES_ACCESS_KEY_ID;
const secretAccessKey = env.S3_SECRET_ACCESS_KEY || env.SES_SECRET_ACCESS_KEY;
if (!bucket || !accessKeyId || !secretAccessKey) {
  console.error("Set S3_MEDIA_BUCKET and an AWS key (S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY or the SES_* names).");
  process.exit(1);
}
const base = (env.NEXT_PUBLIC_MEDIA_URL || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/+$/, "");
const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });

const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml", pdf: "application/pdf" };
const ROOT = path.join(process.cwd(), "public");
const files = fs
  .readdirSync(path.join(ROOT, "wp-content", "uploads"), { recursive: true })
  .map((f) => String(f).replace(/\\/g, "/"))
  .filter((f) => TYPES[f.split(".").pop().toLowerCase()] && fs.statSync(path.join(ROOT, "wp-content", "uploads", f)).isFile())
  .map((f) => `wp-content/uploads/${f}`);

/** Uploads one object and checks it loads publicly; a few tries for network hiccups. */
async function copy(key, body, type) {
  let last = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: type, CacheControl: "public, max-age=31536000, immutable" }));
      const check = await fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "HEAD" });
      if (!check.ok) throw new Error(`new address HTTP ${check.status}`);
      return "";
    } catch (e) {
      last = e.message;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return last;
}

async function pool(items, fn, n = 6) {
  let i = 0;
  const failed = [];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const item = items[i++];
        const err = await fn(item);
        if (err) failed.push(`${item.label ?? item}: ${err}`);
      }
    }),
  );
  return failed;
}

// 1. Migrated images and PDFs.
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
console.log(`→ ${base}`);
console.log(`Migrated media: ${files.length} images/PDFs (${(bytes / 1048576).toFixed(1)} MB) from public/wp-content/uploads.`);

// 2. Admin uploads on Vercel Blob (needs the production database).
let blobRows = [];
let db = null;
if (env.DATABASE_URL) {
  const { getClient } = await import("../lib/db/client.mjs");
  db = await getClient();
  blobRows = (await db.query(`SELECT id, path, mime_type FROM media WHERE path ~ '^https://[^/]+\\.public\\.blob\\.vercel-storage\\.com/' ORDER BY id`)).rows;
  console.log(`Admin uploads on Vercel Blob: ${blobRows.length}.`);
} else console.log("Admin uploads on Vercel Blob: not checked (no DATABASE_URL).");

if (!APPLY) {
  console.log("Report only. Run with --apply to copy.");
  await db?.close();
  process.exit(0);
}

const failed = await pool(files, (key) => copy(key, fs.readFileSync(path.join(ROOT, key)), TYPES[key.split(".").pop().toLowerCase()]));
console.log(`Migrated media: ${files.length - failed.length} copied and checked.`);
if (failed.length) console.error(`${failed.length} failed:\n${failed.join("\n")}`);

if (blobRows.length) {
  const moved = new Map();
  const blobFailed = await pool(blobRows.map((r) => ({ ...r, label: r.path })), async (r) => {
    try {
      const res = await fetch(r.path);
      if (!res.ok) return `download HTTP ${res.status}`;
      const key = new URL(r.path).pathname.replace(/^\/+/, "");
      const err = await copy(key, Buffer.from(await res.arrayBuffer()), res.headers.get("content-type")?.split(";")[0] || r.mime_type);
      if (!err) moved.set(r.path, `${base}/${key}`);
      return err;
    } catch (e) {
      return e.message;
    }
  });
  if (blobFailed.length) {
    console.error(`${blobFailed.length} Blob uploads failed; no links were changed:\n${blobFailed.join("\n")}`);
  } else {
    await db.exec("BEGIN");
    try {
      for (const [from, to] of moved) {
        await db.query(`UPDATE media SET path = $2 WHERE path = $1`, [from, to]);
        await db.query(`UPDATE pages SET html = replace(html, $1, $2), content_html = replace(content_html, $1, $2), hero_image = replace(hero_image, $1, $2) WHERE html LIKE '%' || $1 || '%' OR content_html LIKE '%' || $1 || '%' OR hero_image = $1`, [from, to]);
        await db.query(`UPDATE blocks SET content = replace(content::text, $1, $2)::jsonb WHERE content::text LIKE '%' || $1 || '%'`, [from, to]);
        await db.query(`UPDATE posts SET content_html = replace(content_html, $1, $2), featured_image = replace(featured_image, $1, $2) WHERE content_html LIKE '%' || $1 || '%' OR featured_image = $1`, [from, to]);
        await db.query(`UPDATE settings SET value = replace(value::text, $1, $2)::jsonb WHERE value::text LIKE '%' || $1 || '%'`, [from, to]);
      }
      await db.exec("COMMIT");
      console.log(`Admin uploads: ${moved.size} moved; links switched.`);
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
  }
}
await db?.close();
if (failed.length) process.exit(1);
