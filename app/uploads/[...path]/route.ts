import fs from "node:fs/promises";
import path from "node:path";

// Serves files uploaded through the admin (stored in .data/uploads).
// Production: replace with object storage (Vercel Blob / S3); see README.
const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf" };

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.some((p) => p === ".." || p.includes("\\") || p.startsWith("."))) return new Response("Not found", { status: 404 });
  const root = path.join(process.cwd(), ".data", "uploads");
  const file = path.join(root, ...parts);
  if (!file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(data, {
      headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
