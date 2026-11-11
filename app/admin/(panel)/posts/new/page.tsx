import Link from "next/link";
import { requireUser } from "@/lib/auth";
import Notice from "../../Notice";
import PostEditor from "../PostEditor";

export const metadata = { title: "New post" };

export default async function NewPost({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireUser();
  return (
    <>
      <div className="pagehead"><div><div className="muted small"><Link href="/admin/posts/">Blog posts</Link></div><h1>New post</h1></div></div>
      <Notice sp={await searchParams} />
      <PostEditor post={null} isAdmin={user.role === "admin"} />
    </>
  );
}
