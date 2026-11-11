import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "libsql";

/** A prepared statement, typed by its parameters `P` and the rows `R` it returns. */
export type Statement<P extends unknown[], R> = {
  run(...params: P): { changes: number };
  get(...params: P): R | undefined;
  all(...params: P): R[];
};
/** The part of the database the app uses. */
export type Db = {
  prepare<P extends unknown[] = unknown[], R = unknown>(sql: string): Statement<P, R>;
  exec(sql: string): void;
  /** Wraps `fn` so that all its writes happen, or none. */
  transaction<A extends unknown[], T>(fn: (...args: A) => T): (...args: A) => T;
  close(): void;
};

/**
 * SQLite through libsql, which has better-sqlite3's API. Chosen for its binaries: they are
 * built once per platform and work on every Node version, where better-sqlite3 needs a build
 * per Node version and its current release crashes on Node 20.
 */
export function openDb(file = "data/agent.db"): Db {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return {
    prepare<P extends unknown[], R>(sql: string): Statement<P, R> {
      const statement = db.prepare<P>(sql);
      return {
        run: (...params) => statement.run(...params),
        all: (...params) => statement.all(...params) as R[],
        // Not libsql's own get(): that adds a `_metadata` field to the row.
        get: (...params) => statement.all(...params)[0] as R | undefined,
      };
    },
    exec: (sql) => void db.exec(sql),
    transaction: (fn) => db.transaction(fn),
    close: () => void db.close(),
  };
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
    .prepare<[], { version: string; fts5: number }>(
      "SELECT sqlite_version() AS version, sqlite_compileoption_used('ENABLE_FTS5') AS fts5",
    )
    .get();
  return { version: row?.version ?? "", fts5: row?.fts5 === 1 };
}
