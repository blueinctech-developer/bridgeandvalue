import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Read by middleware.ts. Redirect rules are public information (they are
// observable by requesting the source URLs), so no authentication is needed.
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await sql<{ source: string; destination: string; status_code: number }>(
    `SELECT source, destination, status_code FROM redirects`
  );
  return NextResponse.json(rows);
}
