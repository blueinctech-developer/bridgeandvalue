// Minimal SQL migrator shared by the app and the scripts. Applies every
// lib/db/migrations/*.sql file once, in filename order, inside a transaction.
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "lib", "db", "migrations");

/** @param {{ exec(sql: string): Promise<unknown>, query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> }} client */
export async function migrate(client) {
  await client.exec(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await client.query(`SELECT name FROM _migrations`)).rows.map((r) => r.name));
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(DIR, file), "utf8");
    await client.exec(`BEGIN;\n${sql}\nINSERT INTO _migrations (name) VALUES ('${file.replace(/'/g, "''")}');\nCOMMIT;`);
  }
}
