import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import type { Llm } from "@/adapters/llm";
import { chat } from "@/core/chat";
import { drain, fakeSearch, scriptedLlm, searchCall, stores } from "./fakes";

const now = () => new Date("2026-11-11T09:30:00Z");

test("saves the question and the cited answer, and streams start first and done last", async () => {
  const { store, memories } = stores();
  const { llm, requests } = scriptedLlm([
    { text: "", toolCalls: [searchCall({ queries: ["neon pricing"] })] },
    { text: "Neon Launch is $19/month [1].", toolCalls: [] },
  ]);
  const input = { userId: "u1", message: "Neon pricing?", timezone: "Asia/Kolkata" };
  const { events } = await drain(chat({ store, memories, llm, search: fakeSearch, now }, input));

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
  await drain(chat({ store, memories, llm, search: fakeSearch, now }, input));
  const context = String(requests[0]?.messages.at(-1)?.content);
  assert.match(context, /Conversations on Tue, 3 Nov 2026, apart from this one: none\./);
  assert.match(context, /<\/context>\n\nWhat did I ask you on 3 November\?$/);
});

test("a follow-up sees earlier turns, including their sources", async () => {
  const { store, memories } = stores();
  const first = scriptedLlm([
    { text: "", toolCalls: [searchCall({ queries: ["neon"] })] },
    { text: "Neon is $19 [1].", toolCalls: [] },
  ]);
  const deps = { store, memories, search: fakeSearch, now };
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
  const { events } = await drain(chat({ store, memories, llm, search: fakeSearch, now }, input));
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
  const events = chat({ store, memories, llm, search: fakeSearch, now }, input, controller.signal);
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
