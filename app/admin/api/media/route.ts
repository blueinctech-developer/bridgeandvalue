import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

// Image list for the admin media picker.
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json([], { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const rows = await sql(
    `SELECT path, alt_text, title FROM media
      WHERE mime_type LIKE 'image/%' AND ($1 = '' OR path ILIKE $2 OR title ILIKE $2 OR alt_text ILIKE $2)
      ORDER BY source = 'upload' DESC, created_at DESC LIMIT 80`,
    [q, `%${q}%`]
  );
  return NextResponse.json(rows, { headers: { "cache-control": "no-store" } });
}
