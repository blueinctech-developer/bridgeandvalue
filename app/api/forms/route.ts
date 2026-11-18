import { NextResponse } from "next/server";
import { getSettings, one, sql } from "@/lib/db";
import { brochureEmail, enquiryEmail, mailConfigured, sendMail } from "@/lib/mail";

/**
 * Receives submissions from the migrated forms (Elementor contact form, Contact
 * Form 7 "Get A Free Quote" and the footer's "Request our Brochure"), stores them
 * for the admin inbox and, when Amazon SES is set up (lib/mail.ts), emails them to
 * Admin → Settings → "Send new enquiries to" (or the public contact email).
 * A brochure request also emails the visitor a link to the brochure chosen in
 * Settings. email_sent records whether staff were notified; it stays NULL while
 * email isn't set up. An email failure never fails the submission.
 */
const FORMS: Record<string, { required: string[]; email: string[] }> = {
  contact: { required: ["email"], email: ["email"] }, // Elementor form on /contact-us/
  quote: { required: ["your-name", "your-email"], email: ["your-email"] }, // CF7 on service pages
  brochure: { required: ["email"], email: ["email"] }, // footer "Request our Brochure" (lib/brochure.ts)
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
  // Honeypot filled (sent alongside the form or among its fields): silently drop.
  if (body.website || body.fields.website) return NextResponse.json({ ok: true });

  const fields = Object.fromEntries(
    Object.entries(body.fields)
      .filter(([k]) => k !== "website")
      .slice(0, 20)
      .map(([k, v]) => [k.slice(0, 100), String(v ?? "").slice(0, 5000).trim()])
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
  const page = String(body.page ?? "").slice(0, 300);
  const row = await one<{ id: number }>(`INSERT INTO submissions (form, page, fields) VALUES ($1, $2, $3) RETURNING id`, [
    body.form, page, JSON.stringify(normalised),
  ]);

  let brochureSent = false;
  if (row && mailConfigured) {
    let sent = false;
    const s = await getSettings().catch(() => null);
    // The visitor's brochure first, so their email isn't held up by the staff notification.
    if (body.form === "brochure" && s?.brochure?.url) {
      try {
        const { subject, text } = brochureEmail({ url: s.brochure.url, siteUrl: new URL(req.url).origin, contactEmail: s.contact?.email });
        await sendMail({ to: normalised.email, subject, text, replyTo: s.notifications?.recipient || s.contact?.email || undefined });
        brochureSent = true;
      } catch (err) {
        console.error("[forms] brochure email not sent", err);
      }
    }
    try {
      const to = s?.notifications?.recipient || s?.contact?.email;
      if (to) {
        const visitor = EMAIL_RE.test(normalised.email ?? "") ? normalised.email : undefined;
        const { subject, text } = enquiryEmail({ id: row.id, form: body.form!, page, fields: normalised, siteUrl: new URL(req.url).origin, brochureSent });
        await sendMail({ to, subject, text, replyTo: visitor });
        sent = true;
      } else console.warn("[forms] no enquiry recipient set (Admin → Settings)");
    } catch (err) {
      console.error("[forms] enquiry email not sent", err);
    }
    await sql(`UPDATE submissions SET email_sent = $2 WHERE id = $1`, [row.id, sent]);
  }
  // The footer form tells the visitor whether the brochure is already on its way.
  return NextResponse.json(body.form === "brochure" ? { ok: true, brochureSent } : { ok: true });
}
