import { DEMO_TITLE } from "@/shared/dto";
import type { Source } from "@/shared/events";
import { pastWeekday } from "./dates";
import type { MemoryStore, NewMemory } from "./memories";
import type { Store } from "./store";

// Sample history, so recall can be tried without waiting a week, and the evals have something to
// recall. The chats are dated relative to now, and their titles say they are demo data. Their
// memories are written by hand, as extraction would write them, so seeding needs no model call.

type DemoTurn = { question: string; answer: string; sources?: Source[]; memories: NewMemory[] };
type DemoChat = { title: string; at: (now: Date, timeZone: string) => Date; turns: DemoTurn[] };

const MONDAY = 1;
const TUESDAY = 2;
const THURSDAY = 4;

const DEMO_CHATS: DemoChat[] = [
  {
    title: "Laptop for programming",
    at: (now, timeZone) => pastWeekday(now, timeZone, THURSDAY, "16:40", 1),
    turns: [
      {
        question: "Which laptop should I get for programming, under $1,500?",
        answer:
          "Two good picks:\n\n" +
          "- **MacBook Air 13-inch (M4, 16 GB)**: from $999, with the best battery life in its class [1].\n" +
          "- **Framework Laptop 13**: from $1,049, and repairable, if you want Linux [2].\n\n" +
          "Get at least 16 GB of memory either way.",
        sources: [
          { n: 1, title: "MacBook Air - Apple", url: "https://www.apple.com/macbook-air/" },
          { n: 2, title: "Framework Laptop 13", url: "https://frame.work/laptop13" },
        ],
        memories: [
          {
            kind: "fact",
            text: "The user wants a laptop for programming, under $1,500.",
            topic: "Laptop for programming",
            entities: [],
          },
          {
            kind: "claim",
            text: "The MacBook Air 13-inch with M4 and 16 GB of memory starts at $999.",
            topic: "Laptop for programming",
            entities: ["MacBook Air"],
            sourceUrl: "https://www.apple.com/macbook-air/",
          },
          {
            kind: "claim",
            text: "The Framework Laptop 13 starts at $1,049.",
            topic: "Laptop for programming",
            entities: ["Framework"],
            sourceUrl: "https://frame.work/laptop13",
          },
        ],
      },
      {
        question: "I'll go with the MacBook Air.",
        answer:
          "Good choice for programming. If you run Docker or several VMs, 24 GB of memory is " +
          "worth the upgrade.",
        memories: [
          {
            kind: "decision",
            text: "The user decided to buy the MacBook Air 13-inch.",
            topic: "Laptop for programming",
            entities: ["MacBook Air"],
          },
        ],
      },
    ],
  },
  {
    title: "CRM shortlist for a 20-person team",
    at: (now, timeZone) => pastWeekday(now, timeZone, MONDAY, "10:30"),
    turns: [
      {
        question:
          "We're a 20-person sales team. Shortlist five CRM tools under $50 per user per month.",
        answer:
          "Five that fit, billed annually, cheapest first:\n\n" +
          "1. **Freshsales Growth**: $9 per user per month [1].\n" +
          "2. **HubSpot Sales Hub Starter**: $15 per seat per month [2].\n" +
          "3. **Zoho CRM Professional**: $23 per user per month [3].\n" +
          "4. **Salesforce Starter Suite**: $25 per user per month [4].\n" +
          "5. **Pipedrive Growth**: $34 per user per month [5].\n" +
          "\nFor 20 people, that's $2,160, $3,600, $5,520, $6,000 and $8,160 a year.",
        sources: [
          { n: 1, title: "Freshsales pricing", url: "https://www.freshworks.com/crm/pricing/" },
          {
            n: 2,
            title: "HubSpot Sales Hub pricing",
            url: "https://www.hubspot.com/pricing/sales",
          },
          { n: 3, title: "Zoho CRM pricing", url: "https://www.zoho.com/crm/zohocrm-pricing.html" },
          {
            n: 4,
            title: "Salesforce Sales Cloud pricing",
            url: "https://www.salesforce.com/sales/pricing/",
          },
          { n: 5, title: "Pipedrive pricing", url: "https://www.pipedrive.com/en/pricing" },
        ],
        memories: [
          {
            kind: "fact",
            text: "The user's sales team has 20 people.",
            topic: "CRM shortlist",
            entities: [],
          },
          {
            kind: "preference",
            text: "The user wants a CRM under $50 per user per month.",
            topic: "CRM shortlist",
            entities: [],
          },
          {
            kind: "claim",
            text: "Freshsales Growth costs $9 per user per month, billed annually.",
            topic: "CRM shortlist",
            entities: ["Freshsales"],
            sourceUrl: "https://www.freshworks.com/crm/pricing/",
          },
          {
            kind: "claim",
            text: "HubSpot Sales Hub Starter costs $15 per seat per month, billed annually.",
            topic: "CRM shortlist",
            entities: ["HubSpot"],
            sourceUrl: "https://www.hubspot.com/pricing/sales",
          },
          {
            kind: "claim",
            text: "Zoho CRM Professional costs $23 per user per month, billed annually.",
            topic: "CRM shortlist",
            entities: ["Zoho"],
            sourceUrl: "https://www.zoho.com/crm/zohocrm-pricing.html",
          },
          {
            kind: "claim",
            text: "Salesforce Starter Suite costs $25 per user per month, billed annually.",
            topic: "CRM shortlist",
            entities: ["Salesforce"],
            sourceUrl: "https://www.salesforce.com/sales/pricing/",
          },
          {
            kind: "claim",
            text: "Pipedrive's Growth plan costs $34 per user per month, billed annually.",
            topic: "CRM shortlist",
            entities: ["Pipedrive"],
            sourceUrl: "https://www.pipedrive.com/en/pricing",
          },
        ],
      },
      {
        question: "Which of them works best with Gmail?",
        answer:
          "All five sync with Gmail. Pipedrive's two-way sync and email tracking are the most " +
          "complete at this price; HubSpot's Gmail extension is the quickest to set up.",
        memories: [
          {
            kind: "preference",
            text: "The user wants a CRM that works well with Gmail.",
            topic: "CRM shortlist",
            entities: ["Gmail"],
          },
        ],
      },
    ],
  },
  {
    title: "Postgres hosting for a side project",
    // The Tuesday before last, so "last Tuesday" has to pick between two. Late in the evening,
    // so in the Americas it is already the next day in UTC.
    at: (now, timeZone) => pastWeekday(now, timeZone, TUESDAY, "20:15", 1),
    turns: [
      {
        question:
          "I need managed Postgres for a small side project. How do Neon, Supabase and Railway " +
          "compare on price?",
        answer:
          "All three have a cheap way in:\n\n" +
          "- **Neon**: a free plan with 0.5 GB of storage; the paid Launch plan starts at $19/month [1].\n" +
          "- **Supabase**: a free plan with a 500 MB database; Pro is $25/month per organization " +
          "and includes $10 of compute credits [2].\n" +
          "- **Railway**: the Hobby plan is $5/month, which includes $5 of usage [3].\n\n" +
          "For a small project, start on Neon's or Supabase's free plan. Of the paid plans, " +
          "Railway's is the cheapest.",
        sources: [
          { n: 1, title: "Neon pricing", url: "https://neon.com/pricing" },
          { n: 2, title: "Supabase pricing", url: "https://supabase.com/pricing" },
          { n: 3, title: "Railway pricing", url: "https://railway.com/pricing" },
        ],
        memories: [
          {
            kind: "fact",
            text: "The user needs managed Postgres for a small side project.",
            topic: "Postgres hosting",
            entities: ["Postgres"],
          },
          {
            kind: "claim",
            text: "Neon's free plan includes 0.5 GB of storage, and its Launch plan starts at $19 per month.",
            topic: "Postgres hosting",
            entities: ["Neon"],
            sourceUrl: "https://neon.com/pricing",
          },
          {
            kind: "claim",
            text: "Supabase Pro costs $25 per month per organization and includes $10 of compute credits.",
            topic: "Postgres hosting",
            entities: ["Supabase"],
            sourceUrl: "https://supabase.com/pricing",
          },
          {
            kind: "claim",
            text: "Railway's Hobby plan costs $5 per month and includes $5 of usage.",
            topic: "Postgres hosting",
            entities: ["Railway"],
            sourceUrl: "https://railway.com/pricing",
          },
        ],
      },
    ],
  },
];

/** Writes the demo chats and their memories into the user's history. */
export function seedDemo(
  deps: { store: Store; memories: MemoryStore },
  userId: string,
  now: Date,
  timeZone: string,
): void {
  for (const chat of DEMO_CHATS) {
    const start = chat.at(now, timeZone).getTime();
    const minutesIn = (n: number) => new Date(start + n * 60_000).toISOString();
    const sessionId = deps.store.createSession(userId, DEMO_TITLE + chat.title, minutesIn(0));
    chat.turns.forEach((turn, i) => {
      const asked = { sessionId, userId, createdAt: minutesIn(4 * i) };
      deps.store.addMessage({ ...asked, role: "user", content: turn.question });
      const at = minutesIn(4 * i + 1);
      const answerId = deps.store.addMessage({
        sessionId,
        userId,
        role: "assistant",
        content: turn.answer,
        sources: turn.sources,
        createdAt: at,
      });
      deps.memories.save(userId, { sessionId, answerId, at }, turn.memories);
    });
  }
}
