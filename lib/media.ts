/**
 * Media on Amazon S3. When S3_MEDIA_BUCKET is set, the migrated WordPress images
 * (copied to the bucket at the same paths, wp-content/uploads/…, by
 * scripts/move-media-to-s3.mjs) are served from the bucket instead of this app. The
 * copies under public/wp-content stay as a fallback, so old direct links and the
 * theme's stylesheets keep working. Without the setting nothing changes.
 */

/** The bucket's public address, without a trailing slash; empty when S3 isn't set up. */
export function mediaBase(): string {
  const set = (process.env.NEXT_PUBLIC_MEDIA_URL || "").replace(/\/+$/, "");
  if (set) return set;
  const bucket = process.env.S3_MEDIA_BUCKET;
  if (!bucket) return "";
  const region = process.env.S3_REGION || process.env.SES_REGION || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

/** File types moved to the bucket. Fonts and stylesheets stay with the app (browsers block cross-site fonts). */
export const MEDIA_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "pdf"];

/**
 * Points every /wp-content/uploads/… image or PDF address in page HTML or CSS at the
 * bucket: src, srcset, data-* backgrounds and url(…), whether written as a path or with
 * the old https://bridgeandvalue.com host.
 */
const UPLOADS = new RegExp(
  String.raw`(^|["'(\s,=]|&quot;)(?:https?://(?:www\.)?bridgeandvalue\.com)?(/wp-content/uploads/[^"'\s(),&<>]+?\.(?:${MEDIA_EXTENSIONS.join("|")}))(?=["'\s(),&<>?#]|$)`,
  "gi",
);
export function withMediaHost(text: string): string {
  const base = mediaBase();
  return base ? text.replace(UPLOADS, (_m, before: string, file: string) => `${before}${base}${file}`) : text;
}

/** An image address usable outside the page (social previews, structured data). */
export function absoluteMedia(src: string, siteUrl: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return withMediaHost(src) === src ? siteUrl + src : withMediaHost(src);
}
