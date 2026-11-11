import assert from "node:assert/strict";
import { test } from "node:test";
import type { StructuredLlm } from "@/adapters/llm";
import { EXTRACTION_PROMPT, memorize } from "@/core/memory/extract";
import { logTurn, stores } from "./fakes";

type Request = Parameters<StructuredLlm>[0];

/** A structured model that returns fixed outputs (or throws them) and records its requests. */
function scriptedExtractor(outputs: unknown[]) {
  const requests: Request[] = [];
  const llm: StructuredLlm = async (request) => {
    requests.push(request);
    const output = outputs[requests.length - 1];
    if (output instanceof Error) throw output;
    return request.schema.parse(output);
  };
  return { llm, requests };
}

const sources = [
  { n: 1, title: "Neon pricing", url: "https://neon.com/pricing" },
  { n: 2, title: "Supabase pricing", url: "https://supabase.com/pricing" },
];
const claim = (text: string, source: number | null) => ({
  kind: "claim",
  text,
  topic: "Postgres hosting",
  entities: [text.split("'")[0]],
  subject: `${text.split("'")[0]} plan price`,
  source,
});

test("turns a finished turn into memories, with each claim tied to the page it cites", async () => {
  const { store, memories } = stores();
  const turn = logTurn(store, "u1", "2026-11-03T09:00:00.000Z", {
    question: "Neon or Supabase for a side project?",
    answer: "Neon's Launch plan is $19/month [1]; Supabase Pro is $25/month [2].",
    sources,
  });
  const { llm, requests } = scriptedExtractor([
    {
      title: "Postgres hosting for a side project",
      memories: [
        claim("Neon's Launch plan costs $19/month.", 1),
        claim("Supabase's Pro plan costs $25/month.", 7), // cites no real source: dropped
        {
          kind: "fact",
          text: "The user is building a side project.",
          topic: "Postgres hosting",
          entities: [],
          subject: null,
          source: null,
        },
      ],
    },
  ]);
  await memorize({ store, memories, llm }, "u1");

  assert.equal(requests[0]?.messages[0]?.content, EXTRACTION_PROMPT);
  const prompt = String(requests[0]?.messages[1]?.content);
  assert.match(prompt, /Date of the conversation: 2026-11-03/);
  assert.match(prompt, /First turn of the conversation: yes/);
  assert.match(prompt, /\[1\] Neon pricing - https:\/\/neon\.com\/pricing/);
  assert.match(prompt, /Subjects already in use:\n\(none\)/);

  const saved = memories.matching("u1", '"neon" OR "supabase" OR "project"', 10);
  assert.deepEqual(saved.map((m) => [m.kind, m.sourceUrl, m.observedAt]).sort(), [
    ["claim", "https://neon.com/pricing", turn.at],
    ["fact", null, turn.at],
  ]);
  assert.equal(store.listSessions("u1")[0]?.title, "Postgres hosting for a side project");
  assert.deepEqual(memories.pending("u1"), []);
});

test("later turns see what was already saved, and keep the session title", async () => {
  const { store, memories } = stores();
  const first = logTurn(store, "u1", "2026-11-03T09:00:00.000Z", { sources });
  const { llm, requests } = scriptedExtractor([
    { title: "Postgres hosting", memories: [claim("Neon's Launch plan costs $19/month.", 1)] },
    { title: "Ignored on later turns", memories: [] },
  ]);
  await memorize({ store, memories, llm }, "u1");
  logTurn(store, "u1", "2026-11-03T09:05:00.000Z", {
    sessionId: first.sessionId,
    question: "And Supabase?",
  });
  await memorize({ store, memories, llm }, "u1");

  const prompt = String(requests[1]?.messages[1]?.content);
  assert.match(prompt, /First turn of the conversation: no/);
  assert.match(prompt, /Earlier in the conversation:\nUser: Q\nAssistant: A/);
  assert.match(
    prompt,
    /Already saved from this conversation:\n- Neon's Launch plan costs \$19\/month\./,
  );
  assert.match(prompt, /Subjects already in use:\n- neon plan price/);
  assert.equal(store.listSessions("u1")[0]?.title, "Postgres hosting");
});

test("a failed extraction is logged once and not retried", async (t) => {
  const { store, memories } = stores();
  logTurn(store, "u1", "2026-11-03T09:00:00.000Z");
  const logged = t.mock.method(console, "error", () => {});
  const { llm, requests } = scriptedExtractor([new Error("OpenRouter: 429 Rate limited")]);

  await memorize({ store, memories, llm }, "u1");
  await memorize({ store, memories, llm }, "u1");
  assert.equal(requests.length, 1);
  assert.equal(logged.mock.callCount(), 1);
  assert.deepEqual(memories.pending("u1"), []);
});
