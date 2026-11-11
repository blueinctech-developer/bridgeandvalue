import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { one, sql, type User } from "./db";
import { verifyPassword } from "./password.mjs";

export const SESSION_COOKIE = "bv_session";
const SESSION_HOURS = 12;

const tokenHash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** The signed-in user for this request, or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return one<User>(
    `SELECT u.id, u.email, u.name, u.role, u.active, u.created_at, u.last_login_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.active`,
    [tokenHash(token)]
  );
});

/** Use at the top of every admin page/action. Editors are refused admin-only areas. */
export async function requireUser(role: "admin" | "editor" = "editor"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login/");
  if (role === "admin" && user.role !== "admin") redirect("/admin/?denied=1");
  return user;
}

// Simple in-memory throttle: 5 failed attempts per email+IP per 15 minutes.
const failures = new Map<string, { n: number; until: number }>();

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${email.toLowerCase()}|${ip}`;
  const f = failures.get(key);
  if (f && f.n >= 5 && f.until > Date.now()) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };

  const user = await one<{ id: number; password_hash: string; active: boolean }>(
    `SELECT id, password_hash, active FROM users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    failures.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    return { ok: false, error: "Email or password is incorrect." };
  }
  failures.delete(key);

  const token = crypto.randomBytes(32).toString("base64url");
  await sql(`DELETE FROM sessions WHERE expires_at < now()`);
  await sql(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' hours')::interval)`, [
    tokenHash(token), user.id, String(SESSION_HOURS),
  ]);
  await sql(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.ALLOW_INSECURE_COOKIES,
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql(`DELETE FROM sessions WHERE id = $1`, [tokenHash(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Sign out every session of a user (after a password change or deactivation). */
export async function revokeSessions(userId: number) {
  await sql(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}
