import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

export function openDb(file = "data/agent.db"): Db {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// Next.js dev re-evaluates modules on every edit; keep one connection per process.
const cache = globalThis as typeof globalThis & { agentDb?: Db };

export function getDb(): Db {
  cache.agentDb ??= openDb();
  return cache.agentDb;
}

export function sqliteInfo(db: Db): { version: string; fts5: boolean } {
  // A SELECT without FROM always returns exactly one row.
  const row = db
    .prepare("SELECT sqlite_version() AS version, sqlite_compileoption_used('ENABLE_FTS5') AS fts5")
    .get() as { version: string; fts5: number };
  return { version: row.version, fts5: row.fts5 === 1 };
}
