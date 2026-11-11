import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContext, keywordQuery } from "@/core/memory/context";
import { logTurn, stores } from "./fakes";

const now = new Date("2026-11-11T09:30:00Z"); // Wed 11 Nov, 15:00 in India
const timeZone = "Asia/Kolkata";
const contextText = async (...args: Parameters<typeof buildContext>) =>
  (await buildContext(...args)).text;

test("on an empty history, every section says that nothing was found", async () => {
  const { store, memories } = stores();
  const sessionId = store.createSession("u1", "New chat", now.toISOString());
  const message = "What did I ask you on 3 November? Is your answer still correct today?";
  const context = await contextText(
    { store, memories },
    { userId: "u1", sessionId, message, recent: [], now, timeZone },
  );
  assert.equal(
    context,
    [
      "Now: Wednesday, 11 November 2026 at 15:00 (Asia/Kolkata)",
      '"on 3 November" means Tue, 3 Nov 2026.',
      "Conversations on Tue, 3 Nov 2026, apart from this one: none.",
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

  const context = await contextText(
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
    contextText(
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
  // Not matched by this message; it is still listed further down, under "About the user".
  assert.ok(!byKeyword.split("About the user")[0]?.includes("HubSpot"), byKeyword);

  // "them" refers to tools named in the previous answer.
  const byEntity = await context("Has either of them changed?", [
    "HubSpot starts at $20 per seat.",
  ]);
  assert.ok(
    byEntity.includes('in "Chat", decision: The user shortlisted HubSpot and Close'),
    byEntity,
  );
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
  const context = await contextText(
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
  const context = await contextText(
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
  const context = await contextText(
    { store, memories, embedder },
    { userId: "u1", sessionId: "none", message: "What's my diet?", recent: [], now, timeZone },
  );
  const [matched = "", about = ""] = context.split("About the user");
  assert.ok(matched.includes("preference: The user is vegetarian."), context);
  assert.ok(!matched.includes("support team"), context);
  // What recall did not match still rides along, as who the user is.
  assert.ok(about.includes("Thu, 8 Oct 2026: The user's support team has 6 people."), context);
  // The lists are complete: a matched memory is in its list too.
  assert.ok(about.includes("The user is vegetarian."), context);
});

test("about the user: a fact that a newer one replaced is left out", async () => {
  const { store, memories } = stores();
  const size = (n: number) => ({
    kind: "fact" as const,
    text: `The sales team has ${n} people.`,
    topic: "t",
    entities: [],
    subject: "sales team size",
  });
  memories.save("u1", logTurn(store, "u1", "2026-11-09T05:00:00.000Z"), [size(20)]);
  memories.save("u1", logTurn(store, "u1", "2026-11-10T05:00:00.000Z"), [size(25)]);
  const context = await contextText(
    { store, memories },
    { userId: "u1", sessionId: "none", message: "hello", recent: [], now, timeZone },
  );
  assert.ok(context.includes("Facts:\n- Tue, 10 Nov 2026: The sales team has 25 people."), context);
  assert.ok(!context.includes("20 people"), context);
});

test("a long history also says how many conversations there are, and the first", async () => {
  const { store, memories } = stores();
  for (let day = 1; day <= 25; day++) {
    const at = `2026-10-${String(day).padStart(2, "0")}T09:00:00.000Z`;
    store.setTitle("u1", logTurn(store, "u1", at).sessionId, `Chat ${day}`);
  }
  const context = await contextText(
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

test("a newer memory about the same subject marks the older one as replaced", async () => {
  const { store, memories } = stores();
  const neon = (text: string) => ({
    kind: "claim" as const,
    text,
    topic: "Postgres hosting",
    entities: ["Neon"],
    sourceUrl: "https://neon.com/pricing",
    subject: "Neon Launch plan price",
  });
  memories.save("u1", logTurn(store, "u1", "2026-11-03T09:00:00.000Z"), [
    neon("Neon's Launch plan costs $19/month."),
    {
      kind: "claim",
      text: "Supabase Pro costs $25/month.",
      topic: "Postgres hosting",
      entities: ["Supabase"],
      sourceUrl: "https://supabase.com/pricing",
    },
  ]);
  // Spelled another way, and found by neither date nor keyword: its subject brings it in.
  memories.save("u1", logTurn(store, "u1", "2026-11-06T09:00:00.000Z"), [
    {
      ...neon("The Launch tier is now $5 minimum."),
      subject: "neon launch plan PRICE",
      entities: [],
    },
  ]);
  const context = await buildContext(
    { store, memories },
    {
      userId: "u1",
      sessionId: "none",
      message: "What did Neon and Supabase cost on 3 November?",
      recent: [],
      now,
      timeZone,
    },
  );
  assert.ok(
    context.text.includes(
      "Neon's Launch plan costs $19/month. (source: https://neon.com/pricing) [replaced on Fri, 6 Nov 2026]",
    ),
    context.text,
  );
  assert.ok(
    context.text.includes(
      "The Launch tier is now $5 minimum. (source: https://neon.com/pricing) [current]",
    ),
    context.text,
  );
  assert.match(context.text, /Supabase Pro costs \$25\/month\. \(source: \S+\)\n/); // unmarked
  // Each page is paired with the claim that stands now, not the one it replaced.
  assert.deepEqual(
    context.claims.sort((a, b) => a.url.localeCompare(b.url)),
    [
      { url: "https://neon.com/pricing", text: "The Launch tier is now $5 minimum." },
      { url: "https://supabase.com/pricing", text: "Supabase Pro costs $25/month." },
    ],
  );
});

test("quotes in full a past answer that no memory holds, found by keyword in the log", async () => {
  const { store, memories } = stores();
  const late = "Book Pena Palace online in advance, with a timed entry slot.";
  logTurn(store, "u1", "2026-10-24T09:00:00.000Z", {
    question: "How do we get to Sintra?",
    answer: `Take the train from Rossio [1]. ${"It takes 40 minutes. ".repeat(30)}${late}`,
    sources: [{ n: 1, title: "CP", url: "https://www.cp.pt" }],
  });
  logTurn(store, "u1", "2026-10-25T09:00:00.000Z", {
    question: "Which standing desk is good?",
    answer: "The Flexispot E7.",
  });
  const sessionId = store.createSession("u1", "New chat", now.toISOString());
  const ask = (userId: string) =>
    contextText(
      { store, memories },
      { userId, sessionId, message: "sintra tickets again?", recent: [], now, timeZone },
    );
  const context = await ask("u1");
  assert.match(context, /Earlier answers in full/);
  assert.ok(context.includes('- Sat, 24 Oct 2026, in "Chat"\n  User: How do we get to Sintra?'));
  assert.ok(context.includes(`Take the train from Rossio. It takes`)); // citation numbers removed
  assert.ok(context.includes(`${late}\n  Pages cited: https://www.cp.pt`));
  assert.ok(!context.includes("Flexispot"));
  assert.doesNotMatch(await ask("u2"), /Earlier answers in full/); // another user's log
});

test("asked if an old answer is still correct today, today's chats are not what gets re-checked", async () => {
  const { store, memories } = stores();
  const claim = (text: string, sourceUrl: string) => ({
    kind: "claim" as const,
    text,
    topic: "t",
    entities: [],
    sourceUrl,
  });
  const old = logTurn(store, "u1", "2026-11-03T06:00:00.000Z", { question: "Postgres hosts?" });
  memories.save("u1", old, [claim("Neon Launch costs $19.", "https://neon.com/pricing")]);
  const today = logTurn(store, "u1", "2026-11-11T05:00:00.000Z", { question: "Cricket news?" });
  memories.save("u1", today, [claim("Kohli has 86 centuries.", "https://cricket.example/kohli")]);
  const sessionId = store.createSession("u1", "New chat", now.toISOString());
  const message = "What did I ask you on 3 November? Is your answer still correct today?";
  const context = await buildContext(
    { store, memories },
    { userId: "u1", sessionId, message, recent: [], now, timeZone },
  );
  assert.deepEqual(
    context.claims.map((c) => c.url),
    ["https://neon.com/pricing"],
  );
  assert.ok(!context.text.includes("Conversations on Wed, 11 Nov 2026"));
});
