import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Admin guard: /admin/* requires a session cookie (the session itself is
 *    verified against the database in the admin layout).
 * 2. Redirects managed in the admin, loaded from /api/redirects and cached
 *    for 30 seconds per server instance.
 */
type Redirect = { source: string; destination: string; status_code: number };
let cache: { at: number; map: Map<string, Redirect> } | null = null;

async function redirectMap(origin: string) {
  if (cache && Date.now() - cache.at < 30_000) return cache.map;
  try {
    const res = await fetch(`${origin}/api/redirects/`, { headers: { "x-internal": "1" } });
    const list: Redirect[] = res.ok ? await res.json() : [];
    cache = { at: Date.now(), map: new Map(list.map((r) => [r.source, r])) };
  } catch {
    cache = { at: Date.now(), map: cache?.map ?? new Map() };
  }
  return cache.map;
}

// Until the domain cutover, keep every deployment (e.g. *.vercel.app) out of
// search engines so it can't compete with the live WordPress site.
// Set ALLOW_INDEXING=true on the production deployment at cutover.
const indexable = process.env.ALLOW_INDEXING === "true";
const finish = (res: NextResponse) => {
  if (!indexable) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
};

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // WordPress search URLs (/?s=term) → search page, keeping the URL.
  if (pathname === "/" && searchParams.has("s")) {
    const url = req.nextUrl.clone();
    url.pathname = "/search/";
    return finish(NextResponse.rewrite(url));
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!req.cookies.get("bv_session")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const map = await redirectMap(req.nextUrl.origin);
  const r = map.get(pathname) ?? map.get(pathname.endsWith("/") ? pathname.slice(0, -1) : pathname + "/");
  if (r) {
    const dest = new URL(r.destination, req.nextUrl.origin);
    return NextResponse.redirect(dest, r.status_code);
  }
  return finish(NextResponse.next());
}

export const config = {
  // Skip static assets, Next internals and APIs.
  matcher: ["/((?!_next/|api/|wp-content/|wp-includes/|uploads/|favicon|robots.txt|sitemap.xml).*)"],
};
