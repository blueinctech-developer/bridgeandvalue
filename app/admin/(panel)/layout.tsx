import Link from "next/link";
import { redirect } from "next/navigation";
import { logout, requireUser } from "@/lib/auth";
import { logActivity, one } from "@/lib/db";
import SideNav from "./SideNav";

async function signOut() {
  "use server";
  const user = await requireUser();
  await logActivity(user.id, "signed out", "user", user.id);
  await logout();
  redirect("/admin/login/");
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = (await one<{ n: number }>(`SELECT count(*)::int AS n FROM submissions WHERE status = 'new'`))?.n ?? 0;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span>B</span> Bridge &amp; Value</div>
        <SideNav isAdmin={user.role === "admin"} unread={unread} />
      </aside>
      <div className="main">
        <div className="topbar">
          <a href="/" target="_blank" rel="noopener">View website ↗</a>
          <div className="row">
            <span className="who">
              <Link href="/admin/account/">{user.name}</Link> · {user.role === "admin" ? "Administrator" : "Editor"}
            </span>
            <form action={signOut}>
              <button className="btn secondary small" type="submit">Sign out</button>
            </form>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
