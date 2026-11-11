// The eval set: one user message per case, asked on Wed 11 Nov 2026 at 15:00 in New York.
// "demo" history is the demo chats (src/core/memory/demo.ts) on that clock:
//   Thu 29 Oct 16:40  Laptop for programming (2 turns; decided on the MacBook Air)
//   Tue 3 Nov 20:15   Postgres hosting (already Wed 4 Nov in UTC)
//   Mon 9 Nov 10:30   CRM shortlist: five tools for a 20-person sales team (2 turns)
//
// `context` is checked on every run, offline: it is what the read path puts in front of the model.
// `answer` is checked on live runs only: what the model did with it.

export const GROUPS = {
  s: "The brief's own examples",
  a: "Traps: things that never were",
  b: "Recall by date",
  c: "Has it changed since?",
  d: "Fresh facts",
  e: "Small talk",
  f: "Follow-ups",
  g: "Ambiguous or wrong dates",
} as const;

export type EvalCase = {
  /** Its group's letter and a number. */
  id: `${keyof typeof GROUPS}${number}`;
  history: "empty" | "demo";
  /** Earlier turns of the same chat. */
  earlier?: { question: string; answer: string }[];
  message: string;
  context: { has?: string[]; lacks?: string[] };
  /**
   * `search`: whether it should search (unset: either is fine); `fresh`: with live page copies.
   * An answer that searched must also cite. `has`: patterns the answer must match.
   */
  answer: { search?: boolean; fresh?: true; has?: RegExp[] };
};

// The examples from the brief's test dataset, word for word.
const BRIEF_CRM =
  "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?";
const BRIEF_NOV_3 = "What did I ask you on 3 November? Is your answer still correct today?";
const BRIEF_POSTGRES =
  "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?";

const NO_RECORD =
  /no record|don't have (a |any )?record|no (earlier|previous|past|prior) (conversation|chat)|(can't|couldn't|don't) (find|see)/i;
const NOV_3 = /\b3 Nov|Nov(ember)? 3\b/i;
const FIVE_CRMS = [/Freshsales/, /HubSpot/, /Zoho/, /Salesforce/, /Pipedrive/];

// What the demo chats asked, as the context quotes it.
const LAPTOP = "Which laptop should I get for programming, under $1,500?";
const CRM = "Shortlist five CRM tools under $50 per user per month.";
const GMAIL = "Which of them works best with Gmail?";
const POSTGRES = "How do Neon, Supabase and Railway compare on price?";
// And what extraction remembered, with its source.
const NEON = "Launch plan starts at $19 per month. (source: https://neon.com/pricing)";
const SUPABASE = "Supabase Pro costs $25 per month";
const RAILWAY = "Railway's Hobby plan costs $5 per month";
const CRM_CLAIMS = [
  "Freshsales Growth costs $9 per user per month",
  "HubSpot Sales Hub Starter costs $15 per seat per month",
  "Zoho CRM Professional costs $23 per user per month",
  "Salesforce Starter Suite costs $25 per user per month",
  "Pipedrive's Growth plan costs $34 per user per month",
];
const MACBOOK = "MacBook Air 13-inch with M4 and 16 GB of memory starts at $999";

export const CASES: EvalCase[] = [
  {
    id: "s1",
    history: "empty",
    message: BRIEF_CRM,
    context: {
      has: [
        "Conversations on Mon, 9 Nov 2026, apart from this one: none.",
        "Saved memories: none match this message.",
        "Earlier conversations: none.",
      ],
    },
    answer: { has: [NO_RECORD] },
  },
  {
    id: "s2",
    history: "empty",
    message: BRIEF_NOV_3,
    context: {
      has: [
        "Conversations on Tue, 3 Nov 2026, apart from this one: none.",
        "Conversations on Wed, 11 Nov 2026, apart from this one: none.",
      ],
    },
    answer: { has: [NO_RECORD] },
  },
  {
    id: "s3",
    history: "empty",
    message: BRIEF_POSTGRES,
    context: {
      has: [
        "Conversations on Tue, 10 Nov 2026, apart from this one: none.",
        "Conversations on Tue, 3 Nov 2026, apart from this one: none.",
        "Saved memories: none match this message.",
      ],
    },
    answer: { has: [NO_RECORD] },
  },
  {
    id: "s4",
    history: "demo",
    message: BRIEF_CRM,
    context: {
      has: [
        '"On Monday" means Mon, 9 Nov 2026.',
        CRM,
        "The user's sales team has 20 people.",
        ...CRM_CLAIMS,
      ],
    },
    answer: { search: true, fresh: true, has: FIVE_CRMS },
  },
  {
    id: "s5",
    history: "demo",
    message: BRIEF_NOV_3,
    // 20:15 on 3 Nov in New York is 4 Nov in UTC: the day must be the user's. No keyword
    // matches, so the prices come in as memories of the conversation the date found.
    context: { has: ['"on 3 November" means Tue, 3 Nov 2026.', POSTGRES, NEON, SUPABASE, RAILWAY] },
    answer: { search: true, fresh: true, has: [/Neon/, /Supabase/, /Railway/] },
  },
  {
    id: "s6",
    history: "demo",
    message: BRIEF_POSTGRES,
    context: {
      has: [
        '"Last Tuesday" could mean Tue, 10 Nov 2026 or Tue, 3 Nov 2026; all are shown.',
        "Conversations on Tue, 10 Nov 2026, apart from this one: none.",
        POSTGRES,
        "Pages cited: https://neon.com/pricing, https://supabase.com/pricing, https://railway.com/pricing",
        NEON,
      ],
    },
    answer: { search: true, fresh: true, has: [/Neon/, /Supabase/, /Railway/, NOV_3] },
  },

  {
    id: "a1",
    history: "empty",
    message: "Remind me what you told me about Supabase's pricing.",
    context: {
      has: ["Saved memories: none match this message.", "Earlier conversations: none."],
      lacks: [" means "],
    },
    answer: { has: [NO_RECORD] },
  },
  {
    id: "a2",
    history: "empty",
    message: "What did I ask you earlier today?",
    context: { has: ["Conversations on Wed, 11 Nov 2026, apart from this one: none."] },
    answer: { search: false, has: [NO_RECORD] },
  },
  {
    id: "a3",
    history: "demo",
    message: "Last month you recommended a vector database to me. Which one was it?",
    // October holds only the laptop chat: the answer must not invent a database.
    context: { has: [LAPTOP], lacks: [POSTGRES] },
    answer: { search: false, has: [NO_RECORD] },
  },
  {
    id: "a4",
    history: "demo",
    message: "You told me Supabase was cheaper than Neon, right?",
    // A false premise: the saved prices say the opposite, so the answer should quote them.
    context: { has: [NEON, SUPABASE] },
    answer: { has: [/\$19/, /\$25/] },
  },

  {
    id: "b1",
    history: "demo",
    message: "What did I ask you on Monday?",
    context: {
      has: ['"on Monday" means Mon, 9 Nov 2026.', CRM, GMAIL, ...CRM_CLAIMS],
      lacks: [POSTGRES, LAPTOP],
    },
    answer: { search: false, has: [/CRM/, /Gmail/] },
  },
  {
    id: "b2",
    history: "demo",
    message: "What did I ask you yesterday?",
    context: {
      has: [
        '"yesterday" means Tue, 10 Nov 2026.',
        "Conversations on Tue, 10 Nov 2026, apart from this one: none.",
      ],
    },
    answer: { search: false },
  },
  {
    id: "b3",
    history: "demo",
    message: "What did we talk about on 29 October?",
    context: { has: [LAPTOP, "I'll go with the MacBook Air."] },
    answer: { search: false, has: [/MacBook Air/] },
  },
  {
    id: "b4",
    history: "demo",
    message: "What did I ask you in October?",
    context: {
      has: ['"October" means Thu, 1 Oct 2026 to Sat, 31 Oct 2026.', LAPTOP],
      lacks: [CRM, POSTGRES],
    },
    answer: { search: false, has: [/laptop/i] },
  },
  {
    id: "b5",
    history: "demo",
    message: "What have I asked you this week?",
    context: { has: [CRM, GMAIL], lacks: [POSTGRES, LAPTOP] },
    answer: { search: false, has: [/CRM/] },
  },
  {
    id: "b6",
    history: "demo",
    message: "What did we discuss last week?",
    context: {
      has: ['"last week" means Sun, 1 Nov 2026 to Sat, 7 Nov 2026.', POSTGRES],
      lacks: [CRM, LAPTOP],
    },
    answer: { search: false, has: [/Postgres/] },
  },

  {
    id: "c1",
    history: "demo",
    message: "Are the CRM prices you gave me still right?",
    context: { has: CRM_CLAIMS },
    answer: { search: true, fresh: true, has: FIVE_CRMS },
  },
  {
    id: "c2",
    history: "demo",
    message: "Is Neon still cheaper than Supabase?",
    context: { has: [NEON, SUPABASE] },
    answer: { search: true, fresh: true },
  },
  {
    id: "c3",
    history: "demo",
    message: "Has the MacBook Air I decided on dropped in price?",
    context: { has: ["The user decided to buy the MacBook Air 13-inch.", MACBOOK] },
    answer: { search: true, fresh: true, has: [/\$999/] },
  },

  {
    id: "d1",
    history: "empty",
    message: "What's the latest LTS version of Node.js?",
    context: { has: ["Saved memories: none match this message."], lacks: [" means "] },
    answer: { search: true },
  },
  {
    id: "d2",
    history: "empty",
    message: "How much does GitHub Copilot Business cost per user per month?",
    context: { lacks: [" means "] },
    answer: { search: true, fresh: true },
  },
  {
    id: "d3",
    history: "empty",
    message: "What's new in PostgreSQL 18?",
    context: { lacks: [" means "] }, // "18" is a version, not a date
    answer: { search: true },
  },

  {
    id: "e1",
    history: "demo",
    message: "Thanks, that was really helpful!",
    context: { has: ["Saved memories: none match this message."], lacks: [" means "] },
    answer: { search: false },
  },
  {
    id: "e2",
    history: "empty",
    message: "Rewrite this to sound friendlier: send me the report now.",
    context: { lacks: [" means "] }, // "now" is not a past date
    answer: { search: false },
  },
  {
    id: "e3",
    history: "empty",
    message: "Explain what a foreign key is, in one sentence.",
    context: { lacks: [" means "] },
    answer: { search: false },
  },

  {
    id: "f1",
    history: "demo",
    earlier: [
      {
        question: "What did I ask you about Postgres hosting?",
        answer: "On Tue, 3 Nov you asked how Neon, Supabase and Railway compare on price.",
      },
    ],
    message: "Which of them was cheapest?",
    // No keyword matches; the products named in the chat so far bring in their memories.
    context: { has: [NEON, SUPABASE, RAILWAY] },
    answer: { has: [/Railway/] },
  },
  {
    id: "f2",
    history: "demo",
    earlier: [
      {
        question: "Which CRMs did you shortlist for me?",
        answer:
          "Freshsales, HubSpot Sales Hub, Zoho CRM, Salesforce Starter and Pipedrive, on Mon, 9 Nov.",
      },
    ],
    message: "Do they still cost the same?",
    context: { has: CRM_CLAIMS },
    answer: { search: true, fresh: true },
  },
  {
    id: "f3",
    history: "demo",
    earlier: [
      {
        question: "Tell me about Railway's Hobby plan.",
        answer: "It costs $5 a month and includes $5 of usage.",
      },
    ],
    message: "Does it charge for egress?",
    context: { has: [RAILWAY] },
    answer: { search: true },
  },

  {
    id: "g1",
    history: "demo",
    message: "What did I ask you last Tuesday?",
    context: {
      has: [
        '"last Tuesday" could mean Tue, 10 Nov 2026 or Tue, 3 Nov 2026; all are shown.',
        "Conversations on Tue, 10 Nov 2026, apart from this one: none.",
        POSTGRES,
      ],
    },
    answer: { search: false, has: [NOV_3, /Postgres/] },
  },
  {
    id: "g2",
    history: "demo",
    message: "What did I ask you on Tuesday?",
    // "On Tuesday" is only the latest one, which is empty; the list still shows 3 Nov.
    context: {
      has: [
        '"on Tuesday" means Tue, 10 Nov 2026.',
        "Conversations on Tue, 10 Nov 2026, apart from this one: none.",
        "- Tue, 3 Nov 2026: Demo: Postgres hosting",
      ],
    },
    answer: { search: false },
  },
  {
    id: "g3",
    history: "demo",
    message: "Two weeks ago I asked about laptops. What did you recommend?",
    context: {
      has: ['"Two weeks ago" means Sun, 25 Oct 2026 to Sat, 31 Oct 2026.', LAPTOP, MACBOOK],
    },
    answer: { search: false, has: [/MacBook Air/] },
  },
  {
    id: "g4",
    history: "demo",
    message:
      "Yesterday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing since?",
    // The wrong day, as when a tester sets up history on the day they test: the shortlist must
    // still come in by topic, so the answer can say it was Monday's.
    context: {
      has: ["Conversations on Tue, 10 Nov 2026, apart from this one: none.", ...CRM_CLAIMS],
    },
    answer: { fresh: true, has: [/Monday|9 Nov|Nov(ember)? 9\b/i] },
  },
];
