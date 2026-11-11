import { notFound, redirect } from "next/navigation";
import LegacyPage from "@/components/LegacyPage";
import { getCurrentUser } from "@/lib/auth";
import { one, type PageRow } from "@/lib/db";
import { renderCustomPage } from "@/lib/blog";

// Private preview of a draft page created in the admin (signed-in users only).
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) redirect("/admin/login/");
  const page = await one<PageRow>(`SELECT * FROM pages WHERE id = $1 AND kind = 'custom'`, [Number((await params).id)]);
  if (!page) notFound();
  return <LegacyPage page={await renderCustomPage(page)} />;
}
