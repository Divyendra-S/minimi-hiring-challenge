import assert from "node:assert/strict";
import { test } from "node:test";
import type { NewMemory } from "@/core/memory/memories";
import { logTurn, stores } from "./fakes";

const neon19: NewMemory = {
  kind: "claim",
  text: "Neon's Launch plan costs $19/month.",
  topic: "Postgres hosting",
  entities: ["Neon"],
  sourceUrl: "https://neon.com/pricing",
};

test("saves each memory once and finds it by stemmed keyword, for its user only", () => {
  const { store, memories } = stores();
  const turn = logTurn(store, "u1", "2026-11-03T09:00:00.000Z");
  assert.equal(memories.save("u1", turn, [neon19]), 1);
  assert.equal(
    memories.save("u1", turn, [{ ...neon19, text: "Neon's launch plan costs $19/month" }]),
    0,
  );

  const [found] = memories.matching("u1", '"plans"', 8); // stemmed, so "plans" finds "plan"
  assert.equal(found?.text, neon19.text);
  assert.equal(found?.sourceUrl, neon19.sourceUrl);
  assert.equal(found?.observedAt, turn.at);
  assert.equal(memories.matching("u1", '"hosted"', 8).length, 1); // the topic says "hosting"
  assert.deepEqual(memories.matching("u2", '"hosting"', 8), []);
});

test("a changed price is a new memory, and entity lookups return the newest first", () => {
  const { store, memories } = stores();
  memories.save("u1", logTurn(store, "u1", "2026-11-03T09:00:00.000Z"), [neon19]);
  const later = logTurn(store, "u1", "2026-11-11T09:00:00.000Z");
  memories.save("u1", later, [{ ...neon19, text: "Neon's Launch plan costs $25/month." }]);

  const neon = memories.entities("u1").find((e) => e.norm === "neon");
  assert.ok(neon);
  assert.deepEqual(
    memories
      .linkedTo("u1", [neon.id], 5)
      .map((m) => m.text)
      .sort(),
    ["Neon's Launch plan costs $19/month.", "Neon's Launch plan costs $25/month."],
  );
  assert.deepEqual(
    memories.linkedTo("u1", [neon.id], 1).map((m) => m.observedAt),
    [later.at],
  );
});

test("answers are pending until extraction has seen them, and reset starts over", () => {
  const { store, memories } = stores();
  const turn = logTurn(store, "u1", "2026-11-03T09:00:00.000Z");
  assert.deepEqual(memories.pending("u1"), [turn]);
  memories.save("u1", turn, []); // nothing worth keeping still counts as done
  assert.deepEqual(memories.pending("u1"), []);

  memories.save("u1", logTurn(store, "u1", "2026-11-04T09:00:00.000Z"), [neon19]);
  memories.reset();
  assert.equal(memories.pending("u1").length, 2);
  assert.deepEqual(memories.entities("u1"), []);
  assert.deepEqual(memories.matching("u1", '"neon"', 8), []);
});
