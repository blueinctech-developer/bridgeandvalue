import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { saveSettings } from "../actions";
import Notice from "../Notice";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("admin");
  const sp = await searchParams;
  const s = await getSettings();
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
          <h2>Business Mission pop-up (home page)</h2>
          <div className="row">
            <label className="check"><input type="checkbox" name="popup_enabled" defaultChecked={s.popup?.enabled} /> Show the pop-up</label>
            <label htmlFor="popup_delay" style={{ margin: 0 }}>after</label>
            <input id="popup_delay" name="popup_delay" type="number" min={0} max={60} defaultValue={s.popup?.delaySeconds} style={{ width: 80 }} />
            <span>seconds</span>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>The pop-up&apos;s text is edited on the Home page (its blocks are listed at the end).</p>
        </div>
        <div className="card">
          <h2>Enquiry notifications</h2>
          <div className="field"><label htmlFor="notify_recipient">Send new enquiries to</label><input id="notify_recipient" name="notify_recipient" type="email" defaultValue={s.notifications?.recipient} /></div>
          <div className="notice warn" style={{ margin: 0 }}>Email sending isn&apos;t connected yet. Enquiries are saved in the admin inbox. Connecting needs an email account (WordPress used Amazon SES).</div>
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
