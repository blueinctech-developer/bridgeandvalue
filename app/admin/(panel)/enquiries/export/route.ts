import { getCurrentUser } from "@/lib/auth";
import { logActivity, sql } from "@/lib/db";

// CSV export of enquiries (respects the current filters).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  const status = sp.get("status") ?? "inbox";
  if (status === "inbox") where.push(`status <> 'archived'`);
  else if (["new", "read", "archived"].includes(status)) { params.push(status); where.push(`status = $${params.length}`); }
  if (sp.get("form")) { params.push(sp.get("form")); where.push(`form = $${params.length}`); }
  if (sp.get("q")) { params.push(`%${sp.get("q")}%`); where.push(`fields::text ILIKE $${params.length}`); }
  const rows = await sql<{ id: number; form: string; page: string; fields: Record<string, string>; status: string; created_at: string }>(
    `SELECT * FROM submissions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`,
    params
  );
  // Quote every cell; neutralise spreadsheet formulas (CSV injection).
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ["id", "received_utc", "form", "page", "status", "name", "email", "phone", "subject", "message"];
  const lines = [head.join(",")].concat(
    rows.map((r) =>
      [r.id, new Date(r.created_at).toISOString(), r.form, r.page, r.status, r.fields.name, r.fields.email, r.fields.phone, r.fields.subject, r.fields.message].map(cell).join(",")
    )
  );
  await logActivity(user.id, `exported ${rows.length} enquiries`, "enquiry");
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bridgeandvalue-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
