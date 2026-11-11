import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContext, keywordQuery } from "@/core/memory/context";
import { logTurn, stores } from "./fakes";

const now = new Date("2026-11-11T09:30:00Z"); // Wed 11 Nov, 15:00 in India
const timeZone = "Asia/Kolkata";

test("on an empty history, every section says that nothing was found", async () => {
  const { store, memories } = stores();
  const sessionId = store.createSession("u1", "New chat", now.toISOString());
  const message = "What did I ask you on 3 November? Is your answer still correct today?";
  const context = await buildContext(
    { store, memories },
    { userId: "u1", sessionId, message, recent: [], now, timeZone },
  );
  assert.equal(
    context,
    [
      "Now: Wednesday, 11 November 2026 at 15:00 (Asia/Kolkata)",
      '"on 3 November" means Tue, 3 Nov 2026.',
      "Conversations on Tue, 3 Nov 2026, apart from this one: none.",
      '"today" means Wed, 11 Nov 2026.',
      "Conversations on Wed, 11 Nov 2026, apart from this one: none.",
      "Saved memories: none match this message.",
      "Earlier conversations: none. This is the first one.",
    ].join("\n\n"),
  );
});

test("recalls the conversations of a day in the user's time zone, except this one", async () => {
  const { store, memories } = stores();
  // 23:30 on 3 Nov in India is still 3 Nov there, though 18:00 in UTC.
  const postgres = logTurn(store, "u1", "2026-11-03T18:00:00.000Z", {
    question: "Which Postgres host is cheapest?",
    answer: "Neon's Launch plan is $19/month [1].",
    sources: [{ n: 1, title: "Neon pricing", url: "https://neon.com/pricing" }],
  });
  store.setTitle("u1", postgres.sessionId, "Postgres hosting");
  logTurn(store, "u1", "2026-11-03T19:00:00.000Z", { question: "Already 4 Nov in India" });
  const current = logTurn(store, "u1", "2026-11-03T10:00:00.000Z", { question: "This session" });

  const context = await buildContext(
    { store, memories },
    {
      userId: "u1",
      sessionId: current.sessionId,
      message: "What did I ask on 3 November?",
      recent: [],
      now,
      timeZone,
    },
  );
  assert.ok(
    context.includes(
      [
        "Conversations on Tue, 3 Nov 2026, apart from this one:",
        '- "Postgres hosting"',
        "  23:30 User: Which Postgres host is cheapest?",
        "  23:30 You: Neon's Launch plan is $19/month.",
        "  Pages cited: https://neon.com/pricing",
      ].join("\n"),
    ),
    context,
  );
  assert.ok(!context.includes("Already 4 Nov") && !context.includes("This session"), context);
  assert.match(
    context,
    /Recent conversations.*\n- Wed, 4 Nov 2026: Chat\n- Tue, 3 Nov 2026: Postgres/,
  );
});

test("finds memories by keyword, and by entities named in the last few messages", async () => {
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
  memories.save("u1", logTurn(store, "u1", "2026-11-09T09:00:00.000Z"), [
    {
      kind: "decision",
      text: "The user shortlisted HubSpot and Close as CRM tools.",
      topic: "CRM tools",
      entities: ["HubSpot", "Close"],
    },
  ]);
  const context = (message: string, recent: string[] = []) =>
    buildContext(
      { store, memories },
      {
        userId: "u1",
        sessionId: "none",
        message,
        recent: recent.map((content) => ({
          id: "m",
          role: "assistant",
          content,
          sources: [],
          createdAt: "",
        })),
        now,
        timeZone,
      },
    );

  const byKeyword = await context("Has Postgres hosting got more expensive?");
  assert.ok(
    byKeyword.includes(
      '- Tue, 3 Nov 2026, in "Chat", claim: Neon\'s Launch plan costs $19/month. (source: https://neon.com/pricing)',
    ),
    byKeyword,
  );
  assert.ok(!byKeyword.includes("HubSpot"), byKeyword);

  // "them" refers to tools named in the previous answer.
  const byEntity = await context("Has either of them changed?", [
    "HubSpot starts at $20 per seat.",
  ]);
  assert.ok(byEntity.includes("decision: The user shortlisted HubSpot and Close"), byEntity);
  assert.ok(!byEntity.includes("Neon"), byEntity);
});

test("a conversation found by date brings in its memories, with no keyword match", async () => {
  const { store, memories } = stores();
  // Its answer is quoted cut short, so the prices it gave come in as memories.
  const turn = logTurn(store, "u1", "2026-11-03T09:00:00.000Z", { question: "Which CRMs fit?" });
  memories.save("u1", turn, [
    {
      kind: "claim",
      text: "Pipedrive Growth costs $34 per user per month.",
      topic: "CRM tools",
      entities: ["Pipedrive"],
    },
  ]);
  const message = "What did I ask you on 3 November?";
  const context = await buildContext(
    { store, memories },
    { userId: "u1", sessionId: "none", message, recent: [], now, timeZone },
  );
  assert.ok(context.includes("claim: Pipedrive Growth costs $34 per user per month."), context);
});

test("one hop further: a memory found by keyword brings what else is known of its products", async () => {
  const { store, memories } = stores();
  memories.save("u1", logTurn(store, "u1", "2026-10-07T09:00:00.000Z"), [
    {
      kind: "claim",
      text: "Vercel Pro costs $20 per user per month.",
      topic: "Hosting",
      entities: ["Vercel"],
    },
    {
      kind: "decision",
      text: "The user decided to host the side project on Vercel Pro.",
      topic: "Hosting",
      entities: ["Vercel"],
    },
  ]);
  // Another conversation, about another product: not brought in.
  memories.save("u1", logTurn(store, "u1", "2026-10-08T09:00:00.000Z"), [
    {
      kind: "claim",
      text: "Netlify Pro costs $19 per member per month.",
      topic: "Hosting",
      entities: ["Netlify"],
    },
  ]);
  const message = "What have I decided on for my side project?";
  const context = await buildContext(
    { store, memories },
    { userId: "u1", sessionId: "none", message, recent: [], now, timeZone },
  );
  assert.ok(context.includes("Vercel Pro costs $20"), context);
  assert.ok(!context.includes("Netlify"), context);
});

test("finds a memory by meaning when no word matches, unless it is too far off", async () => {
  const { store, memories } = stores();
  memories.save("u1", logTurn(store, "u1", "2026-10-07T09:00:00.000Z"), [
    { kind: "preference", text: "The user is vegetarian.", topic: "Dinner ideas", entities: [] },
  ]);
  memories.save("u1", logTurn(store, "u1", "2026-10-08T09:00:00.000Z"), [
    {
      kind: "fact",
      text: "The user's support team has 6 people.",
      topic: "Help desk",
      entities: [],
    },
  ]);
  const pending = memories.unembedded("u1");
  const vegetarian = pending.find((m) => m.text.includes("vegetarian"));
  const support = pending.find((m) => m.text.includes("support"));
  assert.ok(vegetarian && support);
  memories.saveVectors([
    { id: vegetarian.id, vector: new Float32Array([1, 0]) },
    { id: support.id, vector: new Float32Array([0, 1]) },
  ]);
  assert.deepEqual(memories.unembedded("u1"), []);
  // A stand-in for the model: this question points almost the same way as the first memory.
  const embedder = { embedIfReady: async () => new Float32Array([0.9, 0.1]) };
  const context = await buildContext(
    { store, memories, embedder },
    { userId: "u1", sessionId: "none", message: "What's my diet?", recent: [], now, timeZone },
  );
  assert.ok(context.includes("The user is vegetarian."), context);
  assert.ok(!context.includes("support team"), context);
});

test("a long history also says how many conversations there are, and the first", async () => {
  const { store, memories } = stores();
  for (let day = 1; day <= 25; day++) {
    const at = `2026-10-${String(day).padStart(2, "0")}T09:00:00.000Z`;
    store.setTitle("u1", logTurn(store, "u1", at).sessionId, `Chat ${day}`);
  }
  const context = await buildContext(
    { store, memories },
    { userId: "u1", sessionId: "none", message: "Hello", recent: [], now, timeZone },
  );
  assert.ok(!context.includes(": Chat 5\n"), context);
  assert.ok(
    context.includes("There are 25 conversations in all. The first was on Thu, 1 Oct 2026: Chat 1"),
    context,
  );
});

test("keyword queries keep the meaningful words, quoted", () => {
  assert.equal(
    keywordQuery("Has any of Neon's pricing changed since then?"),
    '"neon" OR "pricing" OR "changed"',
  );
  assert.equal(keywordQuery("What did you say?"), null);
});
