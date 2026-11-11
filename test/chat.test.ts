import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import type { Llm } from "@/adapters/llm";
import { chat } from "@/core/chat";
import {
  answerOf,
  drain,
  fakeRead,
  fakeSearch,
  logTurn,
  scriptedLlm,
  searchCall,
  stores,
} from "./fakes";

const now = () => new Date("2026-11-11T09:30:00Z");

test("saves the question and the cited answer, and streams start first and done last", async () => {
  const { store, memories } = stores();
  const { llm, requests } = scriptedLlm([
    { text: "", toolCalls: [searchCall({ searches: [{ query: "neon pricing" }] })] },
    { text: "Neon Launch is $19/month [1].", toolCalls: [] },
  ]);
  const input = { userId: "u1", message: "Neon pricing?", timezone: "Asia/Kolkata" };
  const { events } = await drain(
    chat({ store, memories, llm, search: fakeSearch, read: fakeRead, now }, input),
  );

  const start = events[0];
  assert.ok(start?.type === "start");
  assert.equal(events.at(-1)?.type, "done");
  // The ids announced up front are the ids the messages are saved under.
  const saved = store.messages("u1", start.sessionId);
  assert.deepEqual(
    saved.map((m) => [m.id, m.role]),
    [
      [start.questionId, "user"],
      [start.answerId, "assistant"],
    ],
  );
  assert.equal(saved[1]?.sources[0]?.url, "https://example.com/neon pricing");
  // The current time reaches the model in the user's time zone: 09:30 UTC is 15:00 in India.
  const context = String(requests[0]?.messages.at(-1)?.content);
  assert.match(context, /11 November 2026.*15:00 \(Asia\/Kolkata\)/);
});

test("a question about a day with no conversations tells the model there were none", async () => {
  const { store, memories } = stores();
  const { llm, requests } = scriptedLlm([{ text: "I have no record of that.", toolCalls: [] }]);
  const message = "What did I ask you on 3 November?";
  const input = { userId: "u1", message, timezone: "UTC" };
  await drain(chat({ store, memories, llm, search: fakeSearch, read: fakeRead, now }, input));
  const context = String(requests[0]?.messages.at(-1)?.content);
  assert.match(context, /Conversations on Tue, 3 Nov 2026, apart from this one: none\./);
  assert.match(context, /<\/context>\n\nWhat did I ask you on 3 November\?$/);
});

test("a follow-up sees earlier turns, including their sources", async () => {
  const { store, memories } = stores();
  const first = scriptedLlm([
    { text: "", toolCalls: [searchCall({ searches: [{ query: "neon" }] })] },
    { text: "Neon is $19 [1].", toolCalls: [] },
  ]);
  const deps = { store, memories, search: fakeSearch, read: fakeRead, now };
  const input = { userId: "u1", message: "Neon?", timezone: "UTC" };
  const { events } = await drain(chat({ ...deps, llm: first.llm }, input));
  const sessionId = events[0]?.type === "start" ? events[0].sessionId : "";

  const second = scriptedLlm([{ text: "It is.", toolCalls: [] }]);
  await drain(chat({ ...deps, llm: second.llm }, { ...input, sessionId, message: "Still?" }));
  const history = second.requests[0]?.messages.map((m) => String(m.content)) ?? [];
  assert.equal(history.length, 4); // system, user, assistant, new user
  assert.match(history[2] ?? "", /Sources:\n\[1\] About neon - https:\/\/example.com\/neon/);
});

test("another user can't continue someone else's session", async () => {
  const { store, memories } = stores();
  const id = store.createSession("u1", "Mine", now().toISOString());
  const { llm } = scriptedLlm([{ text: "Hi", toolCalls: [] }]);
  const input = { userId: "u2", sessionId: id, message: "Hi", timezone: "UTC" };
  const { events } = await drain(
    chat({ store, memories, llm, search: fakeSearch, read: fakeRead, now }, input),
  );
  assert.notEqual(events[0]?.type === "start" && events[0].sessionId, id);
  assert.deepEqual(store.messages("u2", id), []);
});

test("Stop saves the part of the answer already streamed", async () => {
  const { store, memories } = stores();
  // A model that streams a few words, then waits until it is aborted.
  const llm: Llm = async function* ({ signal }) {
    yield { type: "delta", text: "Neon costs" };
    await setTimeout(60_000, undefined, { signal }); // rejects at once if already aborted
    return { text: "", toolCalls: [] };
  };
  const controller = new AbortController();
  const input = { userId: "u1", message: "Neon?", timezone: "UTC" };
  const events = chat(
    { store, memories, llm, search: fakeSearch, read: fakeRead, now },
    input,
    controller.signal,
  );
  const start = (await events.next()).value;
  assert.ok(start?.type === "start");
  await events.next(); // the first delta

  // Saved by the abort itself, while the generator is still paused at its last yield.
  controller.abort();
  assert.deepEqual(
    store.messages("u1", start.sessionId).map((m) => [m.id, m.content]),
    [
      [start.questionId, "Neon?"],
      [start.answerId, "Neon costs"],
    ],
  );
  // The stream then ends quietly: no error, no done.
  assert.deepEqual(await events.next(), { done: true, value: undefined });
});

test("asked if a remembered price still holds, fetches its source before the model runs", async () => {
  const { store, memories } = stores();
  memories.save("u1", logTurn(store, "u1", "2026-11-03T09:00:00.000Z"), [
    {
      kind: "claim",
      text: "Neon's Launch plan costs $19/month.",
      topic: "Postgres hosting",
      entities: ["Neon"],
      sourceUrl: "https://neon.com/pricing",
    },
  ]);
  const ask = async (message: string) => {
    const { llm, requests } = scriptedLlm([{ text: "Still $19 [1].", toolCalls: [] }]);
    const deps = { store, memories, llm, search: fakeSearch, read: fakeRead, now };
    const { events } = await drain(chat(deps, { userId: "u1", message, timezone: "UTC" }));
    return {
      prompt: String(requests[0]?.messages.at(-1)?.content),
      calls: requests.length,
      events,
    };
  };

  const checked = await ask("Has Neon's price changed since then?");
  assert.match(
    checked.prompt,
    /<pages_now>\n\[1\] https:\/\/neon\.com\/pricing\nThe page at https:\/\/neon\.com\/pricing now\n<\/pages_now>/,
  );
  assert.equal(checked.calls, 1); // old and new are both in the prompt: no call spent on a search
  assert.deepEqual(answerOf(checked.events).sources, [
    { n: 1, title: "neon.com/pricing", url: "https://neon.com/pricing" },
  ]);

  // Recalling what was said needs no page.
  const recalled = await ask("What did you tell me about Neon?");
  assert.ok(!recalled.prompt.includes("<pages_now>"), recalled.prompt);
});

test("a failed re-check is skipped, and the model can still search", async () => {
  const { store, memories } = stores();
  memories.save("u1", logTurn(store, "u1", "2026-11-03T09:00:00.000Z"), [
    {
      kind: "claim",
      text: "Neon's Launch plan costs $19/month.",
      topic: "Postgres hosting",
      entities: ["Neon"],
      sourceUrl: "https://neon.com/pricing",
    },
  ]);
  const { llm, requests } = scriptedLlm([
    { text: "", toolCalls: [searchCall({ searches: [{ query: "neon pricing" }] })] },
    { text: "Still $19 [1].", toolCalls: [] },
  ]);
  const read = async () => {
    throw new Error("down");
  };
  const deps = { store, memories, llm, search: fakeSearch, read, now };
  const input = { userId: "u1", message: "Has Neon's price changed?", timezone: "UTC" };
  const { events } = await drain(chat(deps, input));
  assert.ok(!String(requests[0]?.messages.at(-1)?.content).includes("<pages_now>"));
  assert.equal(answerOf(events).text, "Still $19 [1].");
});
