import assert from "node:assert/strict";
import { test } from "node:test";
import type { Search } from "@/adapters/tavily";
import { runAgent } from "@/core/agent/loop";
import { answerOf, drain, fakeSearch, scriptedLlm, searchCall } from "./fakes";

const question = [{ role: "user" as const, content: "Compare Neon and Supabase pricing" }];

test("searches, numbers sources once per URL, then answers", async () => {
  const { llm, requests } = scriptedLlm([
    { text: "", toolCalls: [searchCall({ queries: ["neon", "supabase"] })] },
    { text: "Neon is cheaper [1][3].", toolCalls: [] },
  ]);
  const { events } = await drain(runAgent({ llm, search: fakeSearch }, question));

  assert.deepEqual(
    events.map((e) => e.type),
    ["searching", "sources", "delta"],
  );
  const { text, sources } = answerOf(events);
  // The shared page appears in both queries but gets a single number.
  assert.deepEqual(
    sources.map((s) => [s.n, s.url]),
    [
      [1, "https://example.com/neon"],
      [2, "https://example.com/shared"],
      [3, "https://example.com/supabase"],
    ],
  );
  assert.equal(text, "Neon is cheaper [1][3].");
  const toolMessage = requests[1]?.messages.at(-1);
  assert.equal(toolMessage?.role, "tool");
  assert.match(String(toolMessage?.content), /<search_results>[\s\S]*\[3\] About supabase/);
});

test("one page under several addresses, or mirrored, gets a single number", async () => {
  const pricing = {
    title: "Neon pricing",
    content: "Neon's paid plans are usage-based: you pay for compute hours and storage you use.",
  };
  const search: Search = async () => [
    { ...pricing, url: "https://neon.tech/pricing" },
    { ...pricing, url: "http://www.neon.tech/pricing/" },
    { ...pricing, url: "https://fyi.neon.tech/pricing" }, // a mirror with the same text
    { title: "Neon docs", url: "https://neon.tech/docs", content: "Branching" },
  ];
  const { llm } = scriptedLlm([
    { text: "", toolCalls: [searchCall({ queries: ["neon pricing", "neon"] })] },
    { text: "Usage-based [1].", toolCalls: [] },
  ]);
  const { events } = await drain(runAgent({ llm, search }, question));
  assert.deepEqual(
    answerOf(events).sources.map((s) => s.url),
    ["https://neon.tech/pricing", "https://neon.tech/docs"],
  );
});

test("runs several tool calls from one reply together, with one numbering", async () => {
  const { llm, requests } = scriptedLlm([
    {
      text: "",
      toolCalls: [
        searchCall({ queries: ["neon"] }, "a"),
        searchCall({ queries: ["supabase"] }, "b"),
      ],
    },
    { text: "Done.", toolCalls: [] },
  ]);
  const { events } = await drain(runAgent({ llm, search: fakeSearch }, question));

  assert.deepEqual(events[0], { type: "searching", queries: ["neon", "supabase"] });
  assert.deepEqual(
    answerOf(events).sources.map((s) => s.url),
    ["https://example.com/neon", "https://example.com/shared", "https://example.com/supabase"],
  );
  const toolMessages = requests[1]?.messages.filter((m) => m.role === "tool") ?? [];
  assert.deepEqual(
    toolMessages.map((m) => m.tool_call_id),
    ["a", "b"],
  );
});

test("text written before a search becomes its own paragraph", async () => {
  const { llm } = scriptedLlm([
    { text: "Let me check.", toolCalls: [searchCall({ queries: ["neon"] })] },
    { text: "Neon is $19 [1].", toolCalls: [] },
  ]);
  const { events } = await drain(runAgent({ llm, search: fakeSearch }, question));
  assert.equal(answerOf(events).text, "Let me check.\n\nNeon is $19 [1].");
});

test("answers without searching when the model doesn't call the tool", async () => {
  const { llm, requests } = scriptedLlm([{ text: "Hi! How can I help?", toolCalls: [] }]);
  const { events } = await drain(runAgent({ llm, search: fakeSearch }, question));
  assert.deepEqual(
    events.map((e) => e.type),
    ["delta"],
  );
  assert.equal(requests.length, 1);
});

test("rejects bad tool arguments without searching", async () => {
  const { llm, requests } = scriptedLlm([
    { text: "", toolCalls: [searchCall({ queries: [] })] },
    { text: "Sorry.", toolCalls: [] },
  ]);
  const { events } = await drain(runAgent({ llm, search: fakeSearch }, question));
  assert.ok(!events.some((e) => e.type === "searching"));
  assert.match(String(requests[1]?.messages.at(-1)?.content), /Invalid tool call/);
});

test("forces an answer after three search rounds", async () => {
  const search = { text: "", toolCalls: [searchCall({ queries: ["again"] })] };
  const { llm, requests } = scriptedLlm([search, search, search, search]);
  await drain(runAgent({ llm, search: fakeSearch }, question));
  assert.equal(requests.length, 4);
  assert.equal(requests[3]?.toolChoice, "none");
});

test("a Stop during a search ends the turn instead of asking the model again", async () => {
  const controller = new AbortController();
  const search: Search = async (query, options) => {
    controller.abort();
    return fakeSearch(query, options);
  };
  const { llm, requests } = scriptedLlm([
    { text: "", toolCalls: [searchCall({ queries: ["neon"] })] },
  ]);
  await assert.rejects(drain(runAgent({ llm, search }, question, controller.signal)), {
    name: "AbortError",
  });
  assert.equal(requests.length, 1);
});
