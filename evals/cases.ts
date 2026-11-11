// The eval set: one user message per case, asked on Wed 11 Nov 2026 at 15:00 in New York.
// "demo" history is the three chats the brief's examples refer to, on that clock:
//   Thu 29 Oct 16:40  Laptop for programming (2 turns; decided on the MacBook Air)
//   Tue 3 Nov 20:15   Postgres hosting (already Wed 4 Nov in UTC)
//   Mon 9 Nov 10:30   CRM shortlist: five tools for a 20-person sales team (2 turns)
//
// "long" history is all 47 sample chats (src/core/memory/demo-chats.ts), 191 turns from 16 Sep to
// 10 Nov: the three above among look-alikes, with prices, a team size and decisions that change.
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
  // The rest run on the long history: one group per ability a memory has to have.
  n: "Long: the brief's examples",
  h: "Long: recall a detail",
  i: "Long: combine several chats",
  j: "Long: a fact that changed",
  k: "Long: reasoning about time",
  l: "Long: reworded questions",
  m: "Long: things that never were",
  v: "Long: vague and sloppy questions",
  x: "Long: hard, several steps at once",
  y: "Long: later turns, replaced values, re-checks",
  z: "Long: a detail deep in a long answer",
} as const;

export type EvalCase = {
  /** Its group's letter and a number. */
  id: `${keyof typeof GROUPS}${number}`;
  history: "empty" | "demo" | "long";
  /** Earlier turns of the same chat. */
  earlier?: { question: string; answer: string }[];
  message: string;
  /**
   * `rechecks`: domains whose pages code must fetch before the model runs, because the message
   * asks whether remembered facts still hold. An empty list means it must fetch nothing.
   */
  context: { has?: string[]; lacks?: string[]; rechecks?: string[] };
  /**
   * `search`: whether it should search (unset: either is fine). An answer that searched must
   * also cite. `official`: domains it must cite a page of, i.e. it went to the source.
   * `has`: patterns the answer must match; `lacks`: ones it must not.
   */
  answer: { search?: boolean; official?: string[]; has?: RegExp[]; lacks?: RegExp[] };
};

// The examples from the brief's test dataset, word for word.
const BRIEF_CRM =
  "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?";
const BRIEF_NOV_3 = "What did I ask you on 3 November? Is your answer still correct today?";
const BRIEF_POSTGRES =
  "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?";

// How the context says it read a date phrase: "last Tuesday" means Tue, 3 Nov 2026.
const DATE_READ = '" means ';
const NO_RECORD =
  /no record|don['’]t have (a |any )?(record|earlier|previous|saved)|no (earlier|previous|past|prior) (conversation|chat)|(can['’]t|couldn['’]t|don['’]t) (find|see)/i;
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

// From the long history.
const TEAM_25 = "The user's sales team has 25 people, after hiring five more reps.";
const NEON_NOW = "Neon's Launch plan is now pay-as-you-go with a $5 monthly minimum.";
const MARATHON_PLAN = "My marathon is in April.";
const SHOES_Q = "Which running shoes should I look at?";
const COMMISSION = "What's a typical commission structure for SaaS account executives?";
const AGENCY = "A friend runs a 5-person design agency.";
const BITWARDEN = "The user's company decided to use Bitwarden Teams.";
const BOSE = "The user decided to buy the Bose QuietComfort Ultra.";
const VERCEL = "The user decided to host the side project on Vercel Pro.";
const RESEND = "The user decided to send the side project's email with Resend.";
const SENTRY = "The user decided to use Sentry's Team plan for the side project.";
const AUTH_JS = "The user decided to use Auth.js for the side project's sign-in.";
const RAILWAY_CHOSEN = "The user decided to host the side project's database on Railway.";
const TO_NEON = "The user decided to move the side project's database from Railway to Neon.";

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
      has: ["Conversations on Tue, 3 Nov 2026, apart from this one: none."],
      // "today" is when to compare, not a day to recall.
      lacks: ["Conversations on Wed, 11 Nov 2026"],
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
    answer: { search: true, has: FIVE_CRMS },
  },
  {
    id: "s5",
    history: "demo",
    message: BRIEF_NOV_3,
    // 20:15 on 3 Nov in New York is 4 Nov in UTC: the day must be the user's. No keyword
    // matches, so the prices come in as memories of the conversation the date found.
    context: { has: ['"on 3 November" means Tue, 3 Nov 2026.', POSTGRES, NEON, SUPABASE, RAILWAY] },
    answer: { search: true, has: [/Neon/, /Supabase/, /Railway/] },
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
    answer: { search: true, has: [/Neon/, /Supabase/, /Railway/, NOV_3] },
  },

  {
    id: "a1",
    history: "empty",
    message: "Remind me what you told me about Supabase's pricing.",
    context: {
      has: ["Saved memories: none match this message.", "Earlier conversations: none."],
      lacks: [DATE_READ],
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
      has: ['"last week" means Mon, 2 Nov 2026 to Sun, 8 Nov 2026.', POSTGRES],
      lacks: [CRM, LAPTOP],
    },
    answer: { search: false, has: [/Postgres/] },
  },

  {
    id: "c1",
    history: "demo",
    message: "Are the CRM prices you gave me still right?",
    context: { has: CRM_CLAIMS },
    answer: { search: true, has: FIVE_CRMS },
  },
  {
    id: "c2",
    history: "demo",
    message: "Is Neon still cheaper than Supabase?",
    context: { has: [NEON, SUPABASE] },
    answer: { search: true },
  },
  {
    id: "c3",
    history: "demo",
    message: "Has the MacBook Air I decided on dropped in price?",
    context: { has: ["The user decided to buy the MacBook Air 13-inch.", MACBOOK] },
    answer: { search: true, has: [/\$999/] },
  },

  {
    id: "d1",
    history: "empty",
    message: "What's the latest LTS version of Node.js?",
    context: { has: ["Saved memories: none match this message."], lacks: [DATE_READ] },
    answer: { search: true },
  },
  {
    id: "d2",
    history: "empty",
    message: "How much does GitHub Copilot Business cost per user per month?",
    context: { lacks: [DATE_READ] },
    answer: { search: true },
  },
  {
    id: "d3",
    history: "empty",
    message: "What's new in PostgreSQL 18?",
    context: { lacks: [DATE_READ] }, // "18" is a version, not a date
    answer: { search: true },
  },

  {
    id: "e1",
    history: "demo",
    message: "Thanks, that was really helpful!",
    context: { has: ["Saved memories: none match this message."], lacks: [DATE_READ] },
    answer: { search: false },
  },
  {
    id: "e2",
    history: "empty",
    message: "Rewrite this to sound friendlier: send me the report now.",
    context: { lacks: [DATE_READ] }, // "now" is not a past date
    answer: { search: false },
  },
  {
    id: "e3",
    history: "empty",
    message: "Explain what a foreign key is, in one sentence.",
    context: { lacks: [DATE_READ] },
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
    answer: { search: true },
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
      has: ['"Two weeks ago" means Mon, 26 Oct 2026 to Sun, 1 Nov 2026.', LAPTOP, MACBOOK],
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
    answer: { has: [/Monday|9 Nov|Nov(ember)? 9\b/i] },
  },

  // ---- The long history ----
  {
    id: "n1",
    history: "long",
    message: BRIEF_CRM,
    // The team has grown since.
    context: {
      has: [CRM, ...CRM_CLAIMS, TEAM_25],
      // Code fetches the five pricing pages before the model runs.
      rechecks: ["freshworks.com", "hubspot.com", "zoho.com", "salesforce.com", "pipedrive.com"],
    },
    answer: { official: ["hubspot.com", "pipedrive.com"], has: FIVE_CRMS },
  },
  {
    id: "n2",
    history: "long",
    message: BRIEF_NOV_3,
    // Two chats that day; and Neon's price was already seen to change three days later.
    context: {
      has: [POSTGRES, MARATHON_PLAN, NEON, SUPABASE, RAILWAY, NEON_NOW],
      rechecks: ["neon.com", "supabase.com", "railway.com"],
    },
    answer: { official: ["neon.com"], has: [/Postgres|Neon/, /marathon/i] },
  },
  {
    id: "n3",
    history: "long",
    message: BRIEF_POSTGRES,
    // Both Tuesdays have chats; only one is about Postgres.
    context: {
      has: [
        POSTGRES,
        NEON,
        SUPABASE,
        RAILWAY,
        NEON_NOW,
        "The conversations on Tue, 3 Nov 2026 fit this message best.",
      ],
    },
    // It must start from what it said then ($19), not only report today's page.
    answer: { official: ["neon.com"], has: [/Neon/, /Supabase/, /Railway/, /\$19/] },
  },

  {
    id: "h1",
    history: "long",
    message: "Which password manager did we pick for the company?",
    context: { has: [BITWARDEN], rechecks: [] },
    answer: { search: false, has: [/Bitwarden/] },
  },
  {
    id: "h2",
    history: "long",
    message: "How much was the Acer Chromebook you suggested for my daughter?",
    context: { has: ["The Acer Chromebook Plus 514 costs $399."] },
    answer: { has: [/399/] },
  },
  {
    id: "h3",
    history: "long",
    message: "What did you say PlanetScale costs?",
    context: { has: ["PlanetScale's Scaler Pro plan starts at $39 per month."] },
    answer: { has: [/39/] },
  },
  {
    id: "h4",
    history: "long",
    message: "How big is our support team?",
    context: { has: ["The user's support team has 6 people."] },
    answer: { search: false, has: [/\b(6|six)\b/i] },
  },
  {
    id: "h5",
    history: "long",
    message: "Which headphones did I end up buying?",
    context: { has: [BOSE] },
    answer: { search: false, has: [/Bose/] },
  },
  {
    id: "h6",
    history: "long",
    message: "What do I use for sign-in on the side project?",
    context: { has: [AUTH_JS] },
    answer: { search: false, has: [/Auth\.js/] },
  },
  {
    id: "h7",
    history: "long",
    message: "Where is my company based?",
    context: { has: ["The user's company is based in Austin, Texas."] },
    answer: { search: false, has: [/Austin/] },
  },
  {
    id: "h8",
    history: "long",
    message: "What was the per-agent price of Zendesk?",
    context: { has: ["Zendesk Suite Team costs $55 per agent per month."] },
    answer: { has: [/55/] },
  },

  {
    id: "i1",
    history: "long",
    message: "What will everything I've decided on for the side project cost per month?",
    // The decisions, and the prices they were made at, are spread over six chats.
    context: {
      has: [
        VERCEL,
        RESEND,
        SENTRY,
        AUTH_JS,
        TO_NEON,
        "Vercel Pro costs $20",
        "Sentry's Team plan costs $26",
        "Resend Pro costs $20",
      ],
    },
    answer: { has: [/Vercel/, /Sentry/, /Resend/] },
  },
  {
    id: "i2",
    history: "long",
    message: "Which of my chats were about running?",
    context: {
      has: ["The user is training for their first marathon.", "The user's marathon is in April."],
    },
    answer: { search: false, has: [/shoes/i, /training|plan/i] },
  },
  {
    id: "i3",
    history: "long",
    message:
      "How much would HubSpot Sales Hub Starter and Fathom's team plan cost together for my sales team?",
    context: {
      has: [CRM_CLAIMS[1] ?? "", "Fathom's team plan costs $19 per user per month.", TEAM_25],
    },
    answer: { has: [/25/] },
  },
  {
    id: "i4",
    history: "long",
    message: "List every tool I've decided to use, at the company and for the side project.",
    context: { has: [BITWARDEN, VERCEL, RESEND, SENTRY, AUTH_JS, TO_NEON] },
    answer: { search: false, has: [/Bitwarden/, /Vercel/, /Sentry/] },
  },
  {
    id: "i5",
    history: "long",
    message: "Tell me everything you know about my marathon.",
    context: {
      has: [
        "The user is training for their first marathon.",
        "The user's marathon is in April.",
        "A 16 to 18 week plan with four runs a week",
      ],
    },
    answer: { search: false, has: [/April/] },
  },

  {
    id: "j1",
    history: "long",
    message: "How many people are on my sales team?",
    context: { has: [TEAM_25, "The user's sales team has 20 people."] },
    answer: { search: false, has: [/25/] },
  },
  {
    id: "j2",
    history: "long",
    message: "Where is the side project's database hosted?",
    context: { has: [RAILWAY_CHOSEN, TO_NEON] },
    answer: { search: false, has: [/Neon/] },
  },
  {
    id: "j3",
    history: "long",
    message: "What have you told me Neon's Launch plan costs?",
    context: { has: [NEON, NEON_NOW] },
    answer: { has: [/\$5\b/, /\$19\b/] },
  },
  {
    id: "j4",
    history: "long",
    message: "Is Railway still what I'm using for the side project?",
    context: { has: [RAILWAY_CHOSEN, TO_NEON] },
    answer: { search: false, has: [/Neon/] },
  },
  {
    id: "j5",
    history: "long",
    message: "What would Zoho CRM Professional cost for my whole sales team per year?",
    context: { has: [CRM_CLAIMS[2] ?? "", TEAM_25] },
    answer: { has: [/6,?900/] },
  },

  {
    id: "k1",
    history: "long",
    message: "What did I ask you on Monday?",
    // Two chats that Monday; the Monday before had another CRM chat.
    context: { has: [CRM, GMAIL, COMMISSION], lacks: [AGENCY] },
    answer: { search: false, has: [/CRM/, /commission/i] },
  },
  {
    id: "k2",
    history: "long",
    message: "What did we talk about on 3 November?",
    context: { has: [POSTGRES, MARATHON_PLAN], lacks: [CRM] },
    answer: { search: false, has: [/Postgres/, /marathon/i] },
  },
  {
    id: "k3",
    history: "long",
    message: "What did I ask you on 2 November?",
    context: { has: [AGENCY], lacks: [CRM] },
    answer: { search: false, has: [/agency/i] },
  },
  {
    id: "k4",
    history: "long",
    message: "What was the very first thing I ever asked you?",
    context: { has: ["Running shoes for a first marathon"] },
    answer: { search: false, has: [/shoes/i] },
  },
  {
    id: "k5",
    history: "long",
    message: "Which did I ask about first, Redis hosting or MySQL hosting?",
    context: { has: ["Tue, 6 Oct 2026", "Thu, 22 Oct 2026", "Redis", "MySQL"] },
    answer: { search: false, has: [/MySQL/] },
  },
  {
    id: "k6",
    history: "long",
    message: "What did I ask you in September?",
    context: { has: [SHOES_Q, "noise-cancelling headphones for long flights?", "Lisbon in March"] },
    answer: { search: false, has: [/shoes/i, /headphones/i, /Lisbon/] },
  },
  {
    id: "k7",
    history: "long",
    message: "What did we discuss three weeks ago?",
    context: {
      has: [
        "Which password manager should a 40-person company use?",
        "Postgres hosting for production",
      ],
    },
    answer: { search: false, has: [/password/i] },
  },
  {
    id: "k8",
    history: "long",
    message: "How many days ago did I ask about a laptop for my daughter?",
    context: { has: ["Thu, 8 Oct 2026", "daughter needs a laptop for school"] },
    answer: { search: false, has: [/34|8 Oct|Oct(ober)? 8/i] },
  },
  {
    id: "k9",
    history: "long",
    message: "What did I ask you yesterday?",
    context: { has: ["We just hired five more reps"], lacks: [CRM] },
    answer: { search: false, has: [/HubSpot/] },
  },
  {
    id: "k10",
    history: "long",
    message: "Last Thursday I decided something about my database. What was it?",
    context: { has: [RAILWAY_CHOSEN, TO_NEON] },
    answer: { search: false, has: [/Railway/] },
  },
  {
    id: "k11",
    history: "long",
    message: "What did I ask you the Monday before last?",
    context: { has: [AGENCY] },
    answer: { search: false, has: [/agency/i] },
  },

  // No word of these questions is in the chat they are about.
  {
    id: "l1",
    history: "long",
    message: "What footwear did you suggest for my race?",
    context: { has: ["The Brooks Ghost 16 costs $140."] },
    answer: { has: [/Brooks/] },
  },
  {
    id: "l2",
    history: "long",
    message: "Which earphones did I pick for plane trips?",
    context: { has: [BOSE] },
    answer: { search: false, has: [/Bose/] },
  },
  {
    id: "l3",
    history: "long",
    message: "Where did you say we should book a hotel for the Portugal holiday?",
    context: { has: ["Chiado and Baixa were recommended"] },
    answer: { has: [/Chiado|Baixa/] },
  },
  {
    id: "l4",
    history: "long",
    message: "What do I use to catch crashes in my hobby app?",
    context: { has: [SENTRY] },
    answer: { search: false, has: [/Sentry/] },
  },
  {
    id: "l5",
    history: "long",
    message: "What's my diet?",
    context: { has: ["The user is vegetarian."] },
    answer: { search: false, has: [/vegetarian/i] },
  },
  {
    id: "l6",
    history: "long",
    message: "Which app did we choose to store our logins at the office?",
    context: { has: [BITWARDEN] },
    answer: { search: false, has: [/Bitwarden/] },
  },
  {
    id: "l7",
    history: "long",
    message: "What did you tell me about a computer for my kid?",
    context: { has: ["The Acer Chromebook Plus 514 costs $399."] },
    answer: { has: [/Chromebook/] },
  },
  {
    id: "l8",
    history: "long",
    message: "Who handles outgoing mail for my app?",
    context: { has: [RESEND] },
    answer: { search: false, has: [/Resend/] },
  },

  {
    id: "m1",
    history: "long",
    message: "What did I ask you on 1 November?",
    context: { has: ["Conversations on Sun, 1 Nov 2026, apart from this one: none."] },
    answer: { search: false, has: [NO_RECORD] },
  },
  {
    id: "m2",
    history: "long",
    message: "What did you tell me about Stripe's fees?",
    // Other prices may come up as near matches; nothing about Stripe does.
    context: { lacks: ["Stripe"] },
    answer: { has: [NO_RECORD] },
  },
  {
    id: "m3",
    history: "long",
    message: "Which CRM did I decide on in the end?",
    // A shortlist, but never a decision.
    context: {
      has: ["The user wants a CRM under $50 per user per month."],
      lacks: ["decided to use HubSpot"],
    },
    answer: {
      search: false,
      has: [/haven't|hadn't|not (yet )?(decided|chosen|picked)|no (record|decision)/i],
    },
  },
  {
    id: "m4",
    history: "long",
    message: "You said Salesforce was the cheapest on the shortlist, right?",
    context: { has: [CRM_CLAIMS[0] ?? "", CRM_CLAIMS[3] ?? ""] },
    answer: { search: false, has: [/Freshsales/] },
  },
  {
    id: "m5",
    history: "long",
    message: "Last month you recommended a vector database to me. Which one was it?",
    context: { lacks: ["vector"] },
    answer: { has: [NO_RECORD] },
  },

  // Typed the way people type: short, misspelt, half-remembered, sometimes wrong.
  {
    id: "v1",
    history: "long",
    message: "that db thing i asked abt, is it still same price??",
    // Five chats were about databases. The one the user ended up on is a fair reading, as long
    // as the answer says which one it took.
    // Code must not pick one of them and fetch its page: seen live, the answer then covered
    // only that one.
    context: { has: [NEON, NEON_NOW], rechecks: [] },
    answer: { search: true, has: [/Neon/] },
  },
  {
    id: "v2",
    history: "long",
    message: "wat crm did u say was cheapest",
    context: { has: [CRM_CLAIMS[0] ?? ""] },
    answer: { search: false, has: [/Freshsales/] },
  },
  {
    id: "v3",
    history: "long",
    message: "remind me the shoes",
    context: { has: ["The Brooks Ghost 16 costs $140."] },
    answer: { search: false, has: [/Brooks/] },
  },
  {
    id: "v4",
    history: "long",
    message: "how many ppl are we in sales now?",
    context: { has: [TEAM_25] },
    answer: { search: false, has: [/25/] },
  },
  {
    id: "v5",
    history: "long",
    message: "the thing we picked for passwords",
    context: { has: [BITWARDEN] },
    answer: { search: false, has: [/Bitwarden/] },
  },
  {
    id: "v6",
    history: "long",
    message: "did the laptop get cheaper",
    context: { has: [MACBOOK] },
    answer: { search: true, has: [/MacBook/] },
  },
  {
    id: "v7",
    history: "long",
    message: "what was that portugal place again",
    context: { has: ["Chiado and Baixa were recommended"] },
    answer: { search: false, has: [/Chiado|Baixa/] },
  },
  {
    id: "v8",
    history: "long",
    // It was two weeks ago, not last week: the wrong week must not hide it.
    message: "last week sometime i asked about some login thing for my app, what did i pick",
    context: { has: [AUTH_JS] },
    answer: { search: false, has: [/Auth\.js/] },
  },
  {
    id: "v9",
    history: "long",
    message: "am i still on railway or what",
    context: { has: [RAILWAY_CHOSEN, TO_NEON] },
    answer: { search: false, has: [/Neon/] },
  },
  {
    id: "v10",
    history: "long",
    message: "whats my stack for the side thing",
    context: { has: [VERCEL, SENTRY, AUTH_JS, TO_NEON] },
    answer: { search: false, has: [/Vercel/, /Neon/, /Sentry/] },
  },
  {
    id: "v11",
    history: "long",
    message: "any of those crm ppl raise prices?",
    context: { has: CRM_CLAIMS },
    answer: { search: true, has: [/HubSpot/, /Pipedrive/] },
  },
  {
    id: "v12",
    history: "long",
    message: "what did we talk abt tuesday",
    context: { has: ["We just hired five more reps"] },
    answer: { search: false, has: [/HubSpot/] },
  },
  {
    id: "v13",
    history: "long",
    earlier: [
      {
        question: "what did we talk abt tuesday",
        answer:
          "On Tuesday, 10 November, you asked what HubSpot Sales Hub Starter would cost for 25 seats.",
      },
    ],
    message: "and the tuesday before?",
    context: { has: [POSTGRES, MARATHON_PLAN] },
    answer: { search: false, has: [/Postgres/, /marathon/i] },
  },
  {
    id: "v14",
    history: "long",
    message: "headphones??",
    context: { has: [BOSE] },
    answer: { search: false, has: [/Bose/] },
  },
  {
    id: "v15",
    history: "long",
    message: "is that neon price right",
    context: { has: [NEON, NEON_NOW] },
    answer: { search: true, has: [/Neon/], official: ["neon.com"] },
  },
  {
    id: "v16",
    history: "long",
    message: "what should i cook tonight",
    context: { has: ["The user is vegetarian."] },
    answer: { lacks: [/chicken|beef|pork|salmon|shrimp|bacon/i] },
  },
  {
    id: "v17",
    history: "long",
    message: "when's my race again",
    context: { has: ["The user's marathon is in April."] },
    answer: { search: false, has: [/April/] },
  },
  {
    id: "v18",
    history: "long",
    message: "you told me pipedrive was 50 bucks right?",
    context: { has: [CRM_CLAIMS[4] ?? ""] },
    answer: { search: false, has: [/34/] },
  },
  {
    id: "v19",
    history: "long",
    message: "what did i decide about the car",
    context: { lacks: ["car insurance", "decided to buy a car"] },
    answer: { search: false, has: [NO_RECORD] },
  },
  {
    id: "v20",
    history: "long",
    message: "what am i paying for hosting, and would netlify be cheaper",
    context: { has: [VERCEL, "Vercel Pro costs $20"] },
    answer: { search: true, has: [/Vercel/, /Netlify/, /20/] },
  },
  // Several things at once: two dates, a time of day, a false premise with a date, arithmetic
  // on remembered numbers, recall plus a fresh check, a follow-up that leans on the chat so far.
  {
    id: "x1",
    history: "long",
    message: "What did I ask you on the morning of 3 November?",
    context: { has: [MARATHON_PLAN] },
    answer: { search: false, has: [/marathon/i], lacks: [/Supabase/] },
  },
  {
    id: "x2",
    history: "long",
    message: "What did I ask on 3 November and on 6 November? Keep it short.",
    context: { has: [MARATHON_PLAN, POSTGRES, NEON_NOW] },
    answer: { search: false, has: [/marathon/i, /Supabase|Postgres/i, /Neon/] },
  },
  {
    id: "x3",
    history: "long",
    message: "On 5 November you told me Supabase was $19 a month, right?",
    context: { has: [SUPABASE] },
    answer: { search: false, has: [/\$25/, NOV_3] },
  },
  {
    id: "x4",
    history: "long",
    message: "How many days ago did I move to Neon, and what was I on before?",
    context: { has: [TO_NEON, RAILWAY_CHOSEN] },
    answer: { search: false, has: [/\b(5|five) days/i, /Railway/] },
  },
  {
    id: "x5",
    history: "long",
    message: "We're 30 in sales now. What's HubSpot per year at the price you gave me?",
    context: { has: [CRM_CLAIMS[1] ?? ""] },
    answer: { search: false, has: [/5,?400/] },
  },
  {
    id: "x6",
    history: "long",
    message: "Remind me which headphones I bought. Is there a newer model out now?",
    context: { has: [BOSE] },
    answer: { search: true, has: [/Bose/] },
  },
  {
    id: "x7",
    history: "long",
    message: "Is the MacBook you recommended still $999?",
    context: { has: [MACBOOK] },
    answer: { search: true, official: ["apple.com"], has: [/999/] },
  },
  {
    id: "x8",
    history: "long",
    message: "What did I ask you on 4 November about Postgres?",
    // That day's chat was about LinkedIn; the Postgres one was the day before.
    context: { has: ["How much is LinkedIn Sales Navigator per seat?", NEON] },
    answer: { search: false, has: [NOV_3, /LinkedIn/] },
  },
  {
    id: "x9",
    history: "long",
    message: "What's my manager's name?",
    context: {},
    answer: { search: false, has: [NO_RECORD] },
  },
  {
    id: "x10",
    history: "long",
    earlier: [
      {
        question: "Which password manager did we pick for the company?",
        answer: "Bitwarden Teams, on 21 Oct 2026.",
      },
    ],
    message: "and what does it cost a month for everyone in sales?",
    context: { has: ["Bitwarden Teams costs $4 per user per month.", TEAM_25] },
    // Checking the price first is fine; the sum must be right either way.
    answer: { has: [/\$100/] },
  },
  {
    id: "x11",
    history: "long",
    message:
      "Which is cheaper right now for my side project's database: what I'm on, or what I left?",
    context: { has: [TO_NEON, NEON_NOW, RAILWAY] },
    answer: { search: true, official: ["neon.com", "railway.com"], has: [/Neon/, /Railway/] },
  },
  {
    id: "x12",
    history: "long",
    message: "Have I ever asked you about Kubernetes?",
    context: { lacks: ["Kubernetes"] },
    answer: { search: false, has: [NO_RECORD], lacks: [/can['’]t (confirm|tell|be sure)/i] },
  },
  {
    id: "x13",
    history: "long",
    message: "Two Mondays ago I asked about a CRM for a friend. Has that tool's price changed?",
    context: { has: [AGENCY, "Zoho Bigin Express costs $7 per user per month."] },
    answer: { search: true, has: [/Bigin/, /Capsule/] },
  },
  {
    id: "x14",
    history: "long",
    message: "What did we talk about last week? Titles only.",
    // Monday 2 to Sunday 8 November.
    context: { has: ['"last week" means Mon, 2 Nov 2026 to Sun, 8 Nov 2026.'] },
    answer: {
      search: false,
      has: [/marathon/i, /Neon/, /meal prep/i],
      lacks: [/Laptop for programming/],
    },
  },
  {
    id: "x15",
    history: "empty",
    message: "On Monday we shortlisted 5 CRM tools. Which was cheapest?",
    context: { has: ["Earlier conversations: none."] },
    answer: { search: false, has: [NO_RECORD] },
  },
  {
    id: "x16",
    history: "long",
    earlier: [
      {
        question: "What's Neon's Launch plan now?",
        answer: "Usage-based, with a $5 monthly minimum, as of 6 Nov 2026.",
      },
    ],
    message: "ok and supabase?",
    context: { has: [SUPABASE] },
    answer: { has: [/\$25/] },
  },
  // --- The longer history: facts from the third or fourth turn of a chat, values that a later
  // chat replaced, and the pages code fetches before the model runs.
  {
    id: "y1",
    history: "long",
    message: "What did I decide about the standing desk?",
    context: { has: ["The user decided to buy the Flexispot E7 standing desk."], rechecks: [] },
    answer: { search: false, has: [/Flexispot/] },
  },
  {
    id: "y2",
    history: "long",
    message: "Which microphones did I buy for the podcast?",
    context: { has: ["The user decided to buy two Rode PodMic USB microphones for the podcast."] },
    answer: { search: false, has: [/Rode/] },
  },
  {
    id: "y3",
    history: "long",
    message: "what day is the sales offsite",
    context: { has: ["The sales offsite is planned for Friday 22 January 2027."] },
    answer: { search: false, has: [/22 Jan|Jan(uary)? 22/] },
  },
  {
    id: "y4",
    history: "long",
    message: "How old is my daughter?",
    context: { has: ["The user's daughter is 9 years old."] },
    answer: { search: false, has: [/\b(9|nine)\b/] },
  },
  {
    id: "y5",
    history: "long",
    message: "What analytics does the side project use?",
    context: {
      has: [
        "from Plausible to PostHog's free tier. [current]",
        "decided to use Plausible for the side project's analytics. [replaced on Wed, 4 Nov 2026]",
      ],
    },
    answer: { search: false, has: [/PostHog/] },
  },
  {
    id: "y6",
    history: "long",
    message: "What was the last price you gave me for Pipedrive?",
    context: {
      has: [
        "now costs $39 per user per month, billed annually. (source: https://www.pipedrive.com/en/pricing) [current]",
        "costs $34 per user per month, billed annually. (source: https://www.pipedrive.com/en/pricing) [replaced on Tue, 10 Nov 2026]",
      ],
      rechecks: [],
    },
    answer: { search: false, has: [/\$39/] },
  },
  {
    id: "y7",
    history: "long",
    message: "Which days can't I run?",
    context: { has: ["The user cannot run on Wednesdays."] },
    answer: { search: false, has: [/Wednesday/] },
  },
  {
    id: "y8",
    history: "long",
    message: "What's my time goal for the race?",
    context: { has: ["The user's goal is to finish the marathon in under 4 hours 30 minutes."] },
    answer: { search: false, has: [/4:30|4 hours 30|4h ?30|four and a half/i] },
  },
  {
    id: "y9",
    history: "long",
    message: "How much is the offsite budget, and how many of us are going?",
    context: { has: ["The budget for the sales offsite is $4,000."] },
    answer: { search: false, has: [/4,?000/] },
  },
  {
    id: "y10",
    history: "long",
    message: "Is there any food I told you I don't like?",
    context: { has: ["The user does not like mushrooms."] },
    answer: { search: false, has: [/mushroom/i] },
  },
  {
    id: "y11",
    history: "long",
    message: "Which e-signature tool did we pick, and what does it cost per user?",
    context: {
      has: [
        "The user's company decided to use PandaDoc for sales contracts.",
        "PandaDoc Starter costs $19 per user per month.",
      ],
    },
    answer: { search: false, has: [/PandaDoc/, /\$19/] },
  },
  {
    id: "y12",
    history: "long",
    message: "When is dad's birthday and what am I getting him?",
    context: {
      has: [
        "The user's father turns 60 on 22 November and reads a lot.",
        "The user decided to give their father a Kindle Paperwhite for his 60th birthday.",
      ],
    },
    answer: { search: false, has: [/22 Nov|Nov(ember)? 22/, /Kindle/] },
  },
  {
    id: "y13",
    history: "long",
    // No word in common with the memory.
    message: "Who are our customers?",
    context: { has: ["The user's company sells scheduling software to dental clinics."] },
    answer: { search: false, has: [/dental/i] },
  },
  {
    id: "y14",
    history: "long",
    message: "What did I ask you on 20 October?",
    // Two chats of four and five turns: the later questions are quoted too.
    context: {
      has: [
        "Help me plan Q1 quotas.",
        "What does a read replica add on RDS?",
        "What attainment should I expect?",
      ],
      rechecks: [],
    },
    answer: { search: false, has: [/quota/i, /Postgres|RDS/] },
  },
  {
    id: "y15",
    history: "long",
    message: "Did Pipedrive's price change since Monday?",
    context: { has: ["[replaced on Tue, 10 Nov 2026]"], rechecks: ["pipedrive.com"] },
    answer: { search: true, has: [/\$34/, /\$39/] },
  },
  {
    id: "y16",
    history: "long",
    message: "How do I back up the side project's database?",
    context: {
      has: [
        "The user decided to back up the side project's database every night with pg_dump to Cloudflare R2.",
      ],
    },
    answer: { search: false, has: [/R2/] },
  },
  {
    id: "y17",
    history: "long",
    message: "What's the quota per AE?",
    context: { has: ["The annual quota per account executive is $600,000."] },
    answer: { search: false, has: [/600,?000|600k/i] },
  },
  {
    id: "y18",
    history: "long",
    message: "how tall am i",
    context: { has: ["The user is 190 cm tall."] },
    answer: { search: false, has: [/190/] },
  },
  {
    id: "y19",
    history: "long",
    message: "Are we staying on Slack?",
    context: {
      has: ["The user's company decided to stay on Slack and not move to Microsoft Teams."],
      rechecks: [],
    },
    answer: { search: false, has: [/Slack/] },
  },
  {
    id: "y20",
    history: "long",
    message: "Is Slack Pro still $8.75 a user?",
    context: { has: ["Slack Pro costs $8.75 per user per month"], rechecks: ["slack.com"] },
    answer: { search: true, official: ["slack.com"], has: [/8\.75/] },
  },
  {
    id: "y21",
    history: "long",
    message: "What did I ask you on Saturday?",
    context: {
      has: ["Suggest an easy day hike within an hour of Austin.", "Will my Vercel bill jump?"],
    },
    answer: { search: false, has: [/hike|Pedernales/i, /Vercel/] },
  },
  {
    id: "y22",
    history: "long",
    message: "Where else are we going on the Portugal trip, besides Lisbon?",
    context: {
      has: [
        "The user decided to add one night in Porto and a day trip to Sintra to the Lisbon trip.",
      ],
    },
    answer: { search: false, has: [/Porto/, /Sintra/] },
  },
  // Advice that no saved memory holds (directions, an agenda, a recipe), or that sits past the
  // point where a quoted answer is cut. It has to come from the message log itself.
  {
    id: "z1",
    history: "long",
    message: "How do we get to Sintra again?",
    context: { has: ["book Pena Palace online in advance"] },
    answer: { search: false, has: [/Rossio/, /Pena/] },
  },
  {
    id: "z2",
    history: "long",
    message: "what was the rough agenda you gave me for the offsite?",
    context: { has: ["a hard stop at 18:00"] },
    answer: { search: false, has: [/18:00|6 ?pm/i] },
  },
  {
    id: "z3",
    history: "long",
    message: "What pace did you say for my long runs?",
    context: { has: ["multiply it by about 4.7"] },
    answer: { search: false, has: [/easy|slower|conversation/i] },
  },
  {
    id: "z4",
    history: "long",
    message: "remind me how to do the restore test for the backups",
    context: { has: ["Run pg_restore into it."] },
    answer: { search: false, has: [/pg_restore/] },
  },
  {
    id: "z5",
    history: "long",
    message: "How many portions of the dal were for the freezer?",
    context: { has: ["Two portions in the freezer"] },
    answer: { search: false, has: [/two|2/i] },
  },
  {
    id: "z6",
    history: "long",
    message:
      "On 10 October you told me how long the standing desk warranty is. What isn't covered?",
    context: { has: ["damage from overloading are not covered"] },
    answer: { search: false, has: [/overload|wear|scratch/i] },
  },
  {
    id: "z7",
    history: "long",
    message: "what should I book first for the Portugal trip, and when?",
    // No keyword in common with the chat ("Portugal"): found through a memory, by meaning.
    context: { has: ["Booking two to three months ahead is usually the best time"] },
    answer: { search: false, has: [/flight/i, /December|January/] },
  },
  {
    id: "z8",
    history: "long",
    message: "Which presets did you suggest for the desk height?",
    context: { has: ["78 cm for sitting and 118 cm for standing"] },
    answer: { search: false, has: [/78/, /118/] },
  },
];
