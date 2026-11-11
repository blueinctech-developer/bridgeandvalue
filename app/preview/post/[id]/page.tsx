import { notFound, redirect } from "next/navigation";
import LegacyPage from "@/components/LegacyPage";
import { getCurrentUser } from "@/lib/auth";
import { getPostById, renderPost } from "@/lib/blog";

// Private preview of a draft or scheduled post (signed-in users only).
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PreviewPost({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) redirect("/admin/login/");
  const post = await getPostById(Number((await params).id));
  if (!post) notFound();
  const page = await renderPost(post.slug, true);
  if (!page) notFound();
  return <LegacyPage page={page} />;
}
