import { requireUser } from "@/lib/auth";
import { changeOwnPassword } from "../actions";
import Notice from "../Notice";

export const metadata = { title: "Your account" };

export default async function Account({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Your account</h1>
          <div className="sub">{user.name} · {user.email} · {user.role === "admin" ? "Administrator" : "Editor"}</div>
        </div>
      </div>
      <Notice sp={sp} />
      <form action={changeOwnPassword} className="card" style={{ maxWidth: 480 }}>
        <h2>Change password</h2>
        <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
        <div className="field"><label htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required /><div className="hint">At least 12 characters.</div></div>
        <div className="field"><label htmlFor="confirm">Repeat new password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></div>
        <button className="btn" type="submit">Change password</button>
      </form>
    </>
  );
}
