import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import type { PopupRow } from "@/lib/popups";
import Notice from "../../Notice";
import PopupForm from "../PopupForm";

export const metadata = { title: "Edit pop-up" };

export default async function EditPopup({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireUser();
  const popup = await one<PopupRow>(`SELECT * FROM popups WHERE id = $1`, [Number((await params).id) || 0]);
  if (!popup) notFound();
  return (
    <>
      <div className="pagehead"><div><div className="muted small"><Link href="/admin/popups/">Pop-ups</Link></div><h1>{popup.name}</h1></div></div>
      <Notice sp={await searchParams} />
      <PopupForm popup={popup} isAdmin={user.role === "admin"} />
    </>
  );
}
