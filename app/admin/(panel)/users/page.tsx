import { requireUser } from "@/lib/auth";
import { sql, type User } from "@/lib/db";
import { createUser, updateUser } from "../actions";
import { fmtDate } from "../format";
import Notice from "../Notice";

export const metadata = { title: "Users" };

export default async function Users({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireUser("admin");
  const sp = await searchParams;
  const users = await sql<User>(`SELECT id, email, name, role, active, created_at, last_login_at FROM users ORDER BY active DESC, name`);
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Users</h1>
          <div className="sub">Administrators can do everything. Editors can edit content, media, menu, redirects and read enquiries, but can&apos;t manage users or settings, or delete enquiries.</div>
        </div>
      </div>
      <Notice sp={sp} />
      <table className="list" style={{ marginBottom: 16 }}>
        <thead><tr><th>User</th><th>Role &amp; access</th><th>New password (optional)</th><th>Last sign-in</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><strong>{u.name}</strong>{u.id === me.id && <span className="muted"> (you)</span>}<div className="muted small">{u.email}</div></td>
              <td colSpan={3} style={{ padding: 0 }}>
                <form action={updateUser} className="row" style={{ padding: "10px 12px" }} id={`u${u.id}`}>
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} aria-label={`Role for ${u.name}`} style={{ width: 130 }}>
                    <option value="admin">Administrator</option>
                    <option value="editor">Editor</option>
                  </select>
                  <label className="check"><input type="checkbox" name="active" defaultChecked={u.active} /> Active</label>
                  <input type="password" name="password" autoComplete="new-password" placeholder="Leave blank to keep" aria-label={`New password for ${u.name}`} style={{ width: 200 }} />
                  <span className="muted small">{fmtDate(u.last_login_at)}</span>
                </form>
              </td>
              <td><button className="btn secondary small" type="submit" form={`u${u.id}`}>Save</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={createUser} className="card">
        <h2>Add a user</h2>
        <div className="grid k2">
          <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" type="text" required /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="off" /></div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue="editor"><option value="editor">Editor</option><option value="admin">Administrator</option></select>
          </div>
          <div className="field"><label htmlFor="password">Temporary password</label><input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" /><div className="hint">At least 12 characters. Share it privately; they can change it under their account.</div></div>
        </div>
        <button className="btn" type="submit">Add user</button>
      </form>
    </>
  );
}
