import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegacyPage from "@/components/LegacyPage";
import { listPublicPaths, SITE_URL } from "@/lib/cms";
import { excerptOf, postPath } from "@/lib/blog";
import { resolvePath } from "@/lib/routes";
import { absoluteMedia } from "@/lib/media";
import { popupsFor } from "@/lib/popups";

type Props = { params: Promise<{ slug?: string[] }> };

// Pre-rendered, and re-rendered when content is edited in the admin.
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await listPublicPaths()).map((p) => ({ slug: p.path.split("/").filter(Boolean) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await resolvePath((await params).slug ?? []);
  if (!page) return {};
  const post = page.post;
  return {
    title: { absolute: page.title },
    description: page.meta_description || undefined,
    // WordPress only printed canonicals on singular pages; mirror that exactly.
    alternates: page.canonical ? { canonical: page.canonical } : undefined,
    robots: page.robots ?? undefined,
    openGraph: post
      ? {
          type: "article",
          url: SITE_URL + postPath(post.slug),
          title: post.meta_title || post.title,
          description: page.meta_description || undefined,
          siteName: "Bridge and Value",
          publishedTime: post.published_at ?? undefined,
          modifiedTime: post.updated_at,
          // Uploaded images are stored as full addresses (S3 or Blob); migrated ones as paths.
          images: post.featured_image ? [{ url: absoluteMedia(post.featured_image, SITE_URL), alt: post.featured_alt || post.title }] : undefined,
        }
      : undefined,
  };
}

export default async function Page({ params }: Props) {
  const page = await resolvePath((await params).slug ?? []);
  if (!page) notFound();
  const post = page.post;
  const jsonLd = post && {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: excerptOf(post, 28),
    datePublished: post.published_at,
    dateModified: post.updated_at,
    mainEntityOfPage: SITE_URL + postPath(post.slug),
    image: post.featured_image ? absoluteMedia(post.featured_image, SITE_URL) : undefined,
    author: post.author_name ? { "@type": "Person", name: post.author_name } : undefined,
    publisher: { "@type": "Organization", name: "Bridge and Value", logo: { "@type": "ImageObject", url: `${SITE_URL}/wp-content/uploads/2024/01/logo.svg` } },
  };
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <LegacyPage page={page} popups={await popupsFor(page.path)} />
    </>
  );
}
