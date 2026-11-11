import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "@/adapters/db";
import { createStore } from "@/core/memory/store";

test("messages come back oldest first, and a limit keeps the newest", () => {
  const store = createStore(openDb(":memory:"));
  const sessionId = store.createSession("u1", "Chat", "2026-11-11T09:00:00Z");
  for (const content of ["one", "two", "three"]) {
    store.addMessage({
      sessionId,
      userId: "u1",
      role: "user",
      content,
      createdAt: "2026-11-11T09:00:00Z",
    });
  }
  assert.deepEqual(
    store.messages("u1", sessionId).map((m) => m.content),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    store.messages("u1", sessionId, 2).map((m) => m.content),
    ["two", "three"],
  );
});

test("sessions are listed per user, most recently active first", () => {
  const store = createStore(openDb(":memory:"));
  const older = store.createSession("u1", "Older", "2026-11-01T09:00:00Z");
  store.createSession("u1", "Newer", "2026-11-02T09:00:00Z");
  store.createSession("u2", "Someone else", "2026-11-03T09:00:00Z");
  store.addMessage({
    sessionId: older,
    userId: "u1",
    role: "user",
    content: "hi",
    createdAt: "2026-11-05T09:00:00Z",
  });

  assert.deepEqual(
    store.listSessions("u1").map((s) => s.title),
    ["Older", "Newer"],
  );
  assert.equal(store.hasSession("u2", older), false);
});
