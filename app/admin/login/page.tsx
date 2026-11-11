import { redirect } from "next/navigation";
import { getCurrentUser, login } from "@/lib/auth";
import { logActivity, one } from "@/lib/db";

export const metadata = { title: "Sign in" };

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const res = await login(email, String(formData.get("password") ?? ""));
  if (!res.ok) redirect(`/admin/login/?error=${encodeURIComponent(res.error)}`);
  const u = await one<{ id: number }>(`SELECT id FROM users WHERE email = $1`, [email.trim().toLowerCase()]);
  await logActivity(u?.id ?? null, "signed in", "user", u?.id);
  redirect("/admin/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/admin/");
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/wp-content/uploads/2024/01/logo.svg" alt="Bridge & Value" />
        <h1 style={{ textAlign: "center", marginBottom: 18 }}>Sign in to the admin</h1>
        {error && <div className="notice err" role="alert">{error}</div>}
        <form action={signIn}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }}>Sign in</button>
        </form>
      </div>
    </main>
  );
}
