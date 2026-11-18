import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSettings, sql } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { saveSettings } from "../actions";
import Notice from "../Notice";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("admin");
  const sp = await searchParams;
  const s = await getSettings();
  const pdfs = await sql<{ path: string; title: string }>(`SELECT path, title FROM media WHERE mime_type = 'application/pdf' ORDER BY created_at DESC, id DESC`);
  const fileName = (p: string) => decodeURIComponent(p.split("/").pop() ?? p);
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Settings</h1>
          <div className="sub">Site-wide settings. Values were carried over from WordPress.</div>
        </div>
      </div>
      <Notice sp={sp} />
      <form action={saveSettings}>
        <div className="card">
          <h2>General</h2>
          <div className="grid k2">
            <div className="field"><label htmlFor="site_name">Site name</label><input id="site_name" name="site_name" type="text" defaultValue={s.site?.name} /></div>
            <div className="field"><label htmlFor="contact_email">Public contact email</label><input id="contact_email" name="contact_email" type="email" defaultValue={s.contact?.email} /></div>
          </div>
          <div className="field"><label htmlFor="contact_address">Office address</label><input id="contact_address" name="contact_address" type="text" defaultValue={s.contact?.address} /></div>
          <p className="muted small">Contact details shown inside page content are edited on each page (Pages → content blocks).</p>
        </div>
        <div className="card">
          <h2>Pop-ups</h2>
          <p className="muted" style={{ margin: 0 }}>Pop-ups, including the Business Mission one, are turned on and off, scheduled and created under <Link href="/admin/popups/">Pop-ups</Link>.</p>
        </div>
        <div className="card">
          <h2>Enquiry notifications</h2>
          <div className="field"><label htmlFor="notify_recipient">Send new enquiries to</label><input id="notify_recipient" name="notify_recipient" type="email" defaultValue={s.notifications?.recipient} /></div>
          {mailConfigured ? (
            <div className="notice ok" style={{ margin: 0 }}>New enquiries are emailed through Amazon SES to this address (or the public contact email if it&apos;s empty), and are always saved in the admin inbox.</div>
          ) : (
            <div className="notice warn" style={{ margin: 0 }}>Email sending isn&apos;t connected yet (Amazon SES settings). Enquiries are saved in the admin inbox.</div>
          )}
        </div>
        <div className="card">
          <h2>Brochure</h2>
          <div className="field">
            <label htmlFor="brochure_url">Brochure emailed from the footer&apos;s &ldquo;Request our Brochure&rdquo; form</label>
            <select id="brochure_url" name="brochure_url" defaultValue={s.brochure?.url ?? ""}>
              <option value="">None: notify us and we reply by hand</option>
              {pdfs.map((p) => (
                <option key={p.path} value={p.path}>{p.title && p.title !== fileName(p.path) ? `${p.title} (${fileName(p.path)})` : fileName(p.path)}</option>
              ))}
            </select>
            <div className="hint">Upload the PDF under Media first, then choose it here. Visitors get an email with a download link; every request also arrives in Enquiries.</div>
          </div>
        </div>
        <div className="card">
          <h2>Search engines</h2>
          <div className="field"><label htmlFor="google_verification">Google Search Console verification code</label><input id="google_verification" name="google_verification" type="text" className="mono" defaultValue={s.seo?.googleVerification} /><div className="hint">The content value of the google-site-verification meta tag.</div></div>
        </div>
        <button className="btn" type="submit">Save settings</button>
      </form>
    </>
  );
}
