import Link from "next/link";
import { requireUser } from "@/lib/auth";
import Notice from "../../Notice";
import PopupForm from "../PopupForm";

export const metadata = { title: "New pop-up" };

export default async function NewPopup({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireUser();
  return (
    <>
      <div className="pagehead"><div><div className="muted small"><Link href="/admin/popups/">Pop-ups</Link></div><h1>New pop-up</h1></div></div>
      <Notice sp={await searchParams} />
      <PopupForm popup={null} isAdmin={user.role === "admin"} />
    </>
  );
}
