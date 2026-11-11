import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getPostById } from "@/lib/blog";
import Notice from "../../Notice";
import PostEditor from "../PostEditor";

export const metadata = { title: "Edit post" };

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireUser();
  const post = await getPostById(Number((await params).id));
  if (!post) notFound();
  const termIds = (await sql<{ term_id: number }>(`SELECT term_id FROM post_terms WHERE post_id = $1`, [post.id])).map((r) => r.term_id);
  return (
    <>
      <div className="pagehead"><div><div className="muted small"><Link href="/admin/posts/">Blog posts</Link></div><h1>{post.title}</h1></div></div>
      <Notice sp={await searchParams} />
      <PostEditor post={{ ...post, term_ids: termIds }} isAdmin={user.role === "admin"} />
    </>
  );
}
