import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContext, keywordQuery } from "@/core/memory/context";
import { logTurn, stores } from "./fakes";

const now = new Date("2026-11-11T09:30:00Z"); // Wed 11 Nov, 15:00 in India
const timeZone = "Asia/Kolkata";

test("on an empty history, every section says that nothing was found", () => {
  const { store, memories } = stores();
  const sessionId = store.createSession("u1", "New chat", now.toISOString());
  const message = "What did I ask you on 3 November? Is your answer still correct today?";
  const context = buildContext(
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

test("recalls the conversations of a day in the user's time zone, except this one", () => {
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

  const context = buildContext(
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

test("finds memories by keyword, and by entities named in the last few messages", () => {
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

  const byKeyword = context("Has Postgres hosting got more expensive?");
  assert.ok(
    byKeyword.includes(
      "- Tue, 3 Nov 2026, claim: Neon's Launch plan costs $19/month. (source: https://neon.com/pricing)",
    ),
    byKeyword,
  );
  assert.ok(!byKeyword.includes("HubSpot"), byKeyword);

  // "them" refers to tools named in the previous answer.
  const byEntity = context("Has either of them changed?", ["HubSpot starts at $20 per seat."]);
  assert.ok(byEntity.includes("decision: The user shortlisted HubSpot and Close"), byEntity);
  assert.ok(!byEntity.includes("Neon"), byEntity);
});

test("keyword queries keep the meaningful words, quoted", () => {
  assert.equal(
    keywordQuery("Has any of Neon's pricing changed since then?"),
    '"neon" OR "pricing" OR "changed"',
  );
  assert.equal(keywordQuery("What did you say?"), null);
});
