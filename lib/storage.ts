import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Storage for files uploaded in the admin.
 * - Vercel (BLOB_READ_WRITE_TOKEN set): Vercel Blob; the stored path is the public https URL.
 * - Local: .data/uploads, served by app/uploads/[...path]/route.ts at /uploads/....
 */
const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function saveUpload(sub: string, base: string, ext: string, data: Buffer, contentType: string): Promise<string> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${sub}/${base}${ext}`, data, { access: "public", contentType, addRandomSuffix: true });
    return blob.url;
  }
  const dir = path.join(LOCAL_ROOT, sub);
  await fs.mkdir(dir, { recursive: true });
  let name = base + ext;
  try {
    await fs.access(path.join(dir, name));
    name = `${base}-${crypto.randomBytes(3).toString("hex")}${ext}`;
  } catch {
    /* name is free */
  }
  await fs.writeFile(path.join(dir, name), data);
  return `/uploads/${sub}/${name}`;
}

export async function deleteUpload(stored: string) {
  if (/^https:\/\//.test(stored)) {
    const { del } = await import("@vercel/blob");
    await del(stored);
    return;
  }
  await fs.rm(path.join(LOCAL_ROOT, stored.replace(/^\/uploads\//, "")), { force: true });
}
