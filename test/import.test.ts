import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { StructuredLlm } from "@/adapters/llm";
import { memorize } from "@/core/memory/extract";
import { ImportedChats, importChats } from "@/core/memory/import";
import { stores } from "./fakes";

const chats = [
  {
    date: "2026-11-03",
    messages: [
      { role: "user", content: "What does Neon cost?" },
      {
        role: "assistant",
        content: "Neon's Launch plan is $19 a month [1].",
        sources: [{ url: "https://neon.com/pricing" }],
      },
      { role: "user", content: "And is there a free plan?" },
      { role: "assistant", content: "Yes, with 0.5 GB of storage [1]." },
    ],
  },
];

test("imported chats are logged on their own dates and go through the usual extraction", async () => {
  const { store, memories } = stores();
  const imported = importChats(store, "u1", ImportedChats.parse(chats));
  assert.deepEqual(imported, { chats: 1, turns: 2 });

  const [session] = store.listSessions("u1");
  assert.equal(session?.title, "What does Neon cost?");
  const messages = store.messages("u1", session?.id ?? "");
  assert.deepEqual(
    messages.map((message) => message.createdAt.slice(0, 16)),
    ["2026-11-03T12:00", "2026-11-03T12:01", "2026-11-03T12:02", "2026-11-03T12:03"],
  );
  assert.deepEqual(messages[1]?.sources, [
    { n: 1, title: "https://neon.com/pricing", url: "https://neon.com/pricing" },
  ]);

  // Nothing is remembered until extraction has run: one call per turn, as after a live turn.
  assert.equal(memories.pending("u1").length, 2);
  let calls = 0;
  const llm: StructuredLlm = async (request) => {
    calls++;
    const claim = {
      kind: "claim",
      text: "Neon's Launch plan costs $19 a month.",
      topic: "Postgres hosting",
      entities: ["Neon"],
      subject: "Neon Launch plan price",
      source: 1,
    };
    return request.schema.parse({ title: null, memories: calls === 1 ? [claim] : [] });
  };
  await memorize({ store, memories, llm }, "u1");
  assert.equal(calls, 2);
  assert.equal(memories.pending("u1").length, 0);
});

test("a chat that doesn't alternate user and assistant is refused", () => {
  const twoQuestions = [
    { date: "2026-11-03", messages: [chats[0]?.messages[0], chats[0]?.messages[2]] },
  ];
  assert.equal(ImportedChats.safeParse(twoQuestions).success, false);
  assert.equal(ImportedChats.safeParse([{ ...chats[0], date: "last Tuesday" }]).success, false);
});

test("the example file is a valid import", () => {
  const example = JSON.parse(readFileSync("examples/chats.json", "utf8"));
  assert.equal(ImportedChats.safeParse(example).success, true);
});
