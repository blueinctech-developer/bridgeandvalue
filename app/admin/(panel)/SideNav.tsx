"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const CONTENT = [
  { href: "/admin/", label: "Dashboard", exact: true },
  { href: "/admin/pages/", label: "Pages & services" },
  { href: "/admin/posts/", label: "Blog posts" },
  { href: "/admin/categories/", label: "Categories & tags" },
  { href: "/admin/footer/", label: "Footer" },
  { href: "/admin/enquiries/", label: "Enquiries", badge: true },
  { href: "/admin/media/", label: "Media" },
  { href: "/admin/menu/", label: "Menu" },
  { href: "/admin/popups/", label: "Pop-ups" },
];
const SITE = [
  { href: "/admin/seo/", label: "SEO overview" },
  { href: "/admin/redirects/", label: "Redirects" },
];
const ADMIN = [
  { href: "/admin/users/", label: "Users" },
  { href: "/admin/settings/", label: "Settings" },
  { href: "/admin/activity/", label: "Activity log" },
];

export default function SideNav({ isAdmin, unread }: { isAdmin: boolean; unread: number }) {
  const path = usePathname();
  const item = (l: { href: string; label: string; exact?: boolean; badge?: boolean }) => {
    const on = l.exact ? path === l.href || path === l.href.slice(0, -1) : path.startsWith(l.href);
    return (
      <Link key={l.href} href={l.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
        {l.label}
        {l.badge && unread > 0 && <span className="count">{unread}</span>}
      </Link>
    );
  };
  return (
    <nav aria-label="Admin">
      <div className="group">Content</div>
      {CONTENT.map(item)}
      <div className="group">Site</div>
      {SITE.map(item)}
      {isAdmin && <div className="group">Administration</div>}
      {isAdmin && ADMIN.map(item)}
    </nav>
  );
}
