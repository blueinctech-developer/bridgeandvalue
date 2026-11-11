import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/cms";

// Reads ALLOW_INDEXING at request time (see middleware.ts).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== "true") {
    // Preview / pre-cutover deployments: keep crawlers out entirely.
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", disallow: ["/wp-admin/", "/admin/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
