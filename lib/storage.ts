import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { mediaBase } from "./media";

/**
 * Storage for files uploaded in the admin, in this order:
 * - Amazon S3 (S3_MEDIA_BUCKET plus an AWS key under its S3_* or SES_* names): the
 *   public bucket; the stored path is the file's https address in the bucket.
 * - Vercel Blob (BLOB_READ_WRITE_TOKEN): uploads made before the move to S3 can still be deleted.
 * - Local: .data/uploads, served by app/uploads/[...path]/route.ts at /uploads/....
 */
const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

const aws = {
  region: () => process.env.S3_REGION || process.env.SES_REGION || "us-east-1",
  accessKeyId: () => process.env.S3_ACCESS_KEY_ID || process.env.SES_ACCESS_KEY_ID || "",
  secretAccessKey: () => process.env.S3_SECRET_ACCESS_KEY || process.env.SES_SECRET_ACCESS_KEY || "",
  bucket: () => process.env.S3_MEDIA_BUCKET || "",
};
const useS3 = () => Boolean(aws.bucket() && aws.accessKeyId() && aws.secretAccessKey());
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Where new uploads go, and which settings are missing for S3 (names only), for the admin. */
export function storageStatus(): { store: "s3" | "blob" | "local"; bucket?: string; missingS3: string[] } {
  const missingS3 = [
    !aws.accessKeyId() && "S3_ACCESS_KEY_ID (or SES_ACCESS_KEY_ID)",
    !aws.secretAccessKey() && "S3_SECRET_ACCESS_KEY (or SES_SECRET_ACCESS_KEY)",
    !aws.bucket() && "S3_MEDIA_BUCKET",
  ].filter(Boolean) as string[];
  if (!missingS3.length) return { store: "s3", bucket: aws.bucket(), missingS3 };
  return { store: useBlob() ? "blob" : "local", missingS3 };
}

let s3: import("@aws-sdk/client-s3").S3Client | null = null;
async function s3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  s3 ??= new S3Client({ region: aws.region(), credentials: { accessKeyId: aws.accessKeyId(), secretAccessKey: aws.secretAccessKey() } });
  return s3;
}

export async function saveUpload(sub: string, base: string, ext: string, data: Buffer, contentType: string): Promise<string> {
  if (useS3()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    // A short random suffix keeps every upload's address unique, so it can be cached for a year.
    const key = `uploads/${sub}/${base}-${crypto.randomBytes(3).toString("hex")}${ext}`;
    await (await s3Client()).send(
      new PutObjectCommand({ Bucket: aws.bucket(), Key: key, Body: data, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }),
    );
    return `${mediaBase()}/${key}`;
  }
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
  const base = mediaBase();
  if (useS3() && base && stored.startsWith(`${base}/`)) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3Client()).send(new DeleteObjectCommand({ Bucket: aws.bucket(), Key: stored.slice(base.length + 1) }));
    return;
  }
  if (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(stored)) {
    const { del } = await import("@vercel/blob");
    await del(stored);
    return;
  }
  await fs.rm(path.join(LOCAL_ROOT, stored.replace(/^\/uploads\//, "")), { force: true });
}
