// Database connection.
//
// - Production (Vercel): set DATABASE_URL to a hosted PostgreSQL (Neon). Uses
//   the Neon serverless driver over WebSockets.
// - Local development: no DATABASE_URL → embedded PostgreSQL (PGlite) stored
//   in .data/pglite.
//
// Both expose the same minimal interface: query(text, params) → { rows },
// exec(sql), close(). Migrations run automatically on first connection.
import fs from "node:fs";
import path from "node:path";
import { migrate } from "./migrate.mjs";

const g = globalThis;

/** Connection string, under any of the names Vercel's Neon integration may use. */
function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGE_URL || // integration installed with the default "STORAGE" prefix
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  );
}

async function hosted(url) {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  if (!neonConfig.webSocketConstructor) {
    // Node 22+ has a global WebSocket; older runtimes use the ws package.
    neonConfig.webSocketConstructor = typeof WebSocket !== "undefined" ? WebSocket : (await import("ws")).default;
  }
  const pool = new Pool({ connectionString: url, max: 5 });
  // Serialise migrations across concurrent serverless instances.
  const conn = await pool.connect();
  try {
    await conn.query("SELECT pg_advisory_lock(727001)");
    await migrate({ exec: (s) => conn.query(s), query: (t, p) => conn.query(t, p) });
  } finally {
    await conn.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    conn.release();
  }
  return {
    query: (text, params) => pool.query(text, params),
    exec: (s) => pool.query(s),
    close: () => pool.end(),
  };
}

async function embedded() {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  await migrate(client);
  return client;
}

/** @returns {Promise<{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>, exec: (sql: string) => Promise<unknown>, close: () => Promise<void> }>} */
export function getClient() {
  if (!g.__bvDb) {
    const url = databaseUrl();
    if (!url && process.env.VERCEL) {
      // Never fall back to the embedded database on Vercel (its disk is not persistent).
      return Promise.reject(new Error("No database connection: set DATABASE_URL in the Vercel project's Environment Variables."));
    }
    g.__bvDb = (url ? hosted(url) : embedded()).catch((e) => {
      g.__bvDb = undefined; // allow a retry on the next request
      throw e;
    });
  }
  return g.__bvDb;
}
