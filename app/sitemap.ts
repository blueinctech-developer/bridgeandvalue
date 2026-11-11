import type { MetadataRoute } from "next";
import { listSitemapPages, SITE_URL } from "@/lib/cms";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return (await listSitemapPages()).map((p) => ({ url: `${SITE_URL}${p.path}`, lastModified: p.updated_at }));
}
