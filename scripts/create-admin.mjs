// Creates (or resets the password of) an administrator account.
// Reads ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD from the environment or
// from .env.local, so the password never needs to appear on the command line.
//
// Usage (local):      node scripts/create-admin.mjs
// Usage (production): npm run admin:create:prod  (reads .env.prod.local)
import fs from "node:fs";
import { getClient } from "../lib/db/client.mjs";
import { hashPassword, passwordProblem } from "../lib/password.mjs";

// Only for the local database: never apply the local test login to a hosted (production) database.
if (!process.env.DATABASE_URL && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const name = process.env.ADMIN_NAME || "Administrator";
const password = process.env.ADMIN_PASSWORD || "";
if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (e.g. in .env.local).");
  process.exit(1);
}
const problem = passwordProblem(password);
if (problem) {
  console.error("Password rejected: " + problem);
  process.exit(1);
}
const db = await getClient();
const { rows } = await db.query(
  `INSERT INTO users (email, name, role, password_hash) VALUES ($1,$2,'admin',$3)
   ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='admin', active=true
   RETURNING id, (xmax = 0) AS created`,
  [email, name, hashPassword(password)]
);
console.log(rows[0].created ? `Created administrator #${rows[0].id} (${email}).` : `Reset password for administrator #${rows[0].id} (${email}).`);
await db.close();
