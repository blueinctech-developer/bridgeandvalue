import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createPage } from "../../content-actions";
import Notice from "../../Notice";

export const metadata = { title: "New page" };

export default async function NewPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser();
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="muted small"><Link href="/admin/pages/">Pages &amp; services</Link></div>
          <h1>New page</h1>
          <div className="sub">New pages use the site&apos;s header, footer and menu, with a title banner and your content below it.</div>
        </div>
      </div>
      <Notice sp={await searchParams} />
      <form action={createPage} className="card" style={{ maxWidth: 640 }}>
        <div className="field">
          <label htmlFor="title">Page title</label>
          <input id="title" name="title" type="text" required maxLength={150} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="slug">Web address</label>
          <div className="row" style={{ gap: 4 }}>
            <span className="muted mono">bridgeandvalue.com/</span>
            <input id="slug" name="slug" type="text" className="mono" placeholder="created from the title" style={{ flex: 1, minWidth: 160 }} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="lowercase letters, numbers and hyphens" />
            <span className="muted mono">/</span>
          </div>
        </div>
        <button className="btn" type="submit">Create draft page</button>
      </form>
    </>
  );
}
