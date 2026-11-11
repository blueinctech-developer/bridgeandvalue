import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * Receives submissions from the migrated forms (Elementor contact form and
 * Contact Form 7 "Get A Free Quote") and stores them for the admin inbox.
 * Email notification is not configured yet (email_sent stays NULL).
 */
const FORMS: Record<string, { required: string[]; email: string[] }> = {
  contact: { required: ["email"], email: ["email"] }, // Elementor form on /contact-us/
  quote: { required: ["your-name", "your-email"], email: ["your-email"] }, // CF7 on service pages
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Basic abuse protection: 10 submissions per IP per 10 minutes.
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 10) return NextResponse.json({ ok: false, message: "Too many submissions." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  let body: { form?: string; page?: string; fields?: Record<string, string>; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const def = body.form ? FORMS[body.form] : undefined;
  if (!def || !body.fields) return NextResponse.json({ ok: false, message: "Unknown form." }, { status: 400 });
  if (body.website) return NextResponse.json({ ok: true }); // honeypot filled: silently drop

  const fields = Object.fromEntries(
    Object.entries(body.fields).slice(0, 20).map(([k, v]) => [k.slice(0, 100), String(v ?? "").slice(0, 5000).trim()])
  );
  const invalid: Record<string, string> = {};
  for (const k of def.required) if (!fields[k]) invalid[k] = "This field is required.";
  for (const k of def.email) if (fields[k] && !EMAIL_RE.test(fields[k])) invalid[k] = "Please enter a valid email address.";
  if (Object.keys(invalid).length) return NextResponse.json({ ok: false, invalid }, { status: 422 });

  // Normalise the quote form's CF7 field names for the inbox.
  const normalised =
    body.form === "quote"
      ? { name: fields["your-name"], email: fields["your-email"], message: fields["your-message"] ?? "" }
      : fields;
  await sql(`INSERT INTO submissions (form, page, fields) VALUES ($1, $2, $3)`, [
    body.form, String(body.page ?? "").slice(0, 300), JSON.stringify(normalised),
  ]);
  return NextResponse.json({ ok: true });
}
