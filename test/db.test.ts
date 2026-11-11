import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb, sqliteInfo } from "@/adapters/db";

test("the bundled SQLite has FTS5", () => {
  assert.equal(sqliteInfo(openDb(":memory:")).fts5, true);
});

test("FTS5 with the porter tokenizer matches word variants", () => {
  const db = openDb(":memory:");
  db.exec("CREATE VIRTUAL TABLE notes USING fts5(body, tokenize='porter unicode61')");
  db.prepare("INSERT INTO notes (body) VALUES (?)").run("Neon changed its pricing");
  assert.equal(db.prepare("SELECT body FROM notes WHERE notes MATCH ?").all("price").length, 1);
});
