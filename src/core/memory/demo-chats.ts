import type { Source } from "@/shared/events";
import { pastWeekday } from "./dates";
import type { NewMemory } from "./memories";

// The sample history: 31 chats over eight weeks, dated relative to now. It is built to be hard to
// recall from: several chats share a topic, a weekday or a product; some facts change later (a
// price, a team size, a decision); and some chats can only be found by meaning, not by keyword.
// The memories are written by hand, as extraction would write them, so loading needs no model call.

export type DemoTurn = {
  question: string;
  answer: string;
  sources?: Source[];
  memories: Omit<NewMemory, "topic">[];
};
export type DemoChat = {
  title: string;
  /** For its memories; the title if unset. */
  topic?: string;
  /** One of the three chats the brief's sample prompts refer to. */
  brief?: true;
  at: (now: Date, timeZone: string) => Date;
  turns: DemoTurn[];
};

const [SUN, MON, TUE, WED, THU, FRI, SAT] = [0, 1, 2, 3, 4, 5, 6];

/** The latest such weekday before today, or `weeksBefore` weeks before that. */
const on =
  (weekday: number, time: string, weeksBefore = 0): DemoChat["at"] =>
  (now, timeZone) =>
    pastWeekday(now, timeZone, weekday, time, weeksBefore);

const pages = (...list: [title: string, url: string][]): Source[] =>
  list.map(([title, url], i) => ({ n: i + 1, title, url }));

type Told = Omit<NewMemory, "topic">;
const fact = (text: string, ...entities: string[]): Told => ({ kind: "fact", text, entities });
const preference = (text: string, ...entities: string[]): Told => ({
  kind: "preference",
  text,
  entities,
});
const decision = (text: string, ...entities: string[]): Told => ({
  kind: "decision",
  text,
  entities,
});
const claim = (text: string, sourceUrl: string, ...entities: string[]): Told => ({
  kind: "claim",
  text,
  entities,
  sourceUrl,
});

const NEON = "https://neon.com/pricing";
const SUPABASE = "https://supabase.com/pricing";
const RAILWAY = "https://railway.com/pricing";
const HUBSPOT = "https://www.hubspot.com/pricing/sales";
const ZOHO = "https://www.zoho.com/crm/zohocrm-pricing.html";

export const DEMO_CHATS: DemoChat[] = [
  // --- Seven and six weeks ago: findable by meaning only, once they fall off the recent list.
  {
    title: "Running shoes for a first marathon",
    at: on(WED, "09:30", 7),
    turns: [
      {
        question: "I'm training for my first marathon. Which running shoes should I look at?",
        answer:
          "Three reliable daily trainers: the **Brooks Ghost 16** ($140) [1], the " +
          "**Asics Novablast 5** ($140) [2] and the **Saucony Ride 18** ($145) [3]. " +
          "The Ghost is the safest pick if you haven't been fitted.",
        sources: pages(
          ["Brooks Ghost 16", "https://www.brooksrunning.com/en_us/ghost-16"],
          ["Asics Novablast 5", "https://www.asics.com/us/en-us/novablast-5"],
          ["Saucony Ride 18", "https://www.saucony.com/en/ride-18"],
        ),
        memories: [
          fact("The user is training for their first marathon."),
          claim(
            "The Brooks Ghost 16 costs $140.",
            "https://www.brooksrunning.com/en_us/ghost-16",
            "Brooks Ghost",
          ),
          claim(
            "The Asics Novablast 5 costs $140.",
            "https://www.asics.com/us/en-us/novablast-5",
            "Asics Novablast",
          ),
          claim(
            "The Saucony Ride 18 costs $145.",
            "https://www.saucony.com/en/ride-18",
            "Saucony Ride",
          ),
        ],
      },
    ],
  },
  {
    title: "Noise-cancelling headphones for flights",
    at: on(MON, "14:00", 7),
    turns: [
      {
        question: "What are the best noise-cancelling headphones for long flights?",
        answer:
          "The **Sony WH-1000XM6** ($449) cancels the most engine noise [1]; the " +
          "**Bose QuietComfort Ultra** ($429) is the more comfortable for ten hours [2].",
        sources: pages(
          ["Sony WH-1000XM6", "https://electronics.sony.com/wh-1000xm6"],
          ["Bose QuietComfort Ultra", "https://www.bose.com/p/headphones/quietcomfort-ultra"],
        ),
        memories: [
          fact("The user wants noise-cancelling headphones for long flights."),
          claim(
            "The Sony WH-1000XM6 headphones cost $449.",
            "https://electronics.sony.com/wh-1000xm6",
            "Sony WH-1000XM6",
          ),
          claim(
            "The Bose QuietComfort Ultra headphones cost $429.",
            "https://www.bose.com/p/headphones/quietcomfort-ultra",
            "Bose QuietComfort",
          ),
        ],
      },
      {
        question: "I'll take the Bose.",
        answer: "Good pick for comfort. Its case folds flat, which helps in a carry-on.",
        memories: [
          decision("The user decided to buy the Bose QuietComfort Ultra.", "Bose QuietComfort"),
        ],
      },
    ],
  },
  {
    title: "Where to stay in Lisbon",
    at: on(THU, "19:20", 6),
    turns: [
      {
        question: "My partner and I are going to Lisbon in March. Which area should we stay in?",
        answer:
          "For a first visit, stay in **Chiado** or **Baixa**: central, flat and close to the " +
          "metro. **Alfama** is prettier but steep and noisy at night.",
        memories: [
          fact("The user is travelling to Lisbon in March with their partner.", "Lisbon"),
          fact("Chiado and Baixa were recommended as areas to stay in Lisbon.", "Lisbon"),
        ],
      },
    ],
  },
  // --- Five weeks ago: look-alikes of the Postgres and CRM chats.
  {
    title: "Postgres or MySQL for a new app",
    at: on(FRI, "11:15", 5),
    turns: [
      {
        question: "Should I pick Postgres or MySQL for a new app?",
        answer:
          "Postgres, unless your team already runs MySQL: it has richer types, better JSON " +
          "support and more extensions.",
        memories: [preference("The user prefers Postgres for new projects.", "Postgres", "MySQL")],
      },
    ],
  },
  {
    title: "Email marketing tools",
    at: on(MON, "10:05", 5),
    turns: [
      {
        question: "Which email marketing tool is cheapest for a list of 2,000 contacts?",
        answer:
          "**Brevo Starter** at $9/month [1], then **Mailchimp Essentials** at $13/month [2]. " +
          "**HubSpot Marketing Hub Starter** is $15/seat per month [3].",
        sources: pages(
          ["Brevo pricing", "https://www.brevo.com/pricing/"],
          ["Mailchimp pricing", "https://mailchimp.com/pricing/"],
          ["HubSpot Marketing Hub pricing", "https://www.hubspot.com/pricing/marketing"],
        ),
        memories: [
          fact("The user's email list has about 2,000 contacts."),
          claim("Brevo Starter costs $9 per month.", "https://www.brevo.com/pricing/", "Brevo"),
          claim(
            "Mailchimp Essentials costs $13 per month.",
            "https://mailchimp.com/pricing/",
            "Mailchimp",
          ),
          claim(
            "HubSpot Marketing Hub Starter costs $15 per seat per month.",
            "https://www.hubspot.com/pricing/marketing",
            "HubSpot",
          ),
        ],
      },
    ],
  },
  {
    title: "MySQL hosting for a client project",
    at: on(TUE, "15:30", 5),
    turns: [
      {
        question: "A client's app runs on MySQL. Where should I host the database?",
        answer:
          "**PlanetScale** is the easiest managed MySQL; its Scaler Pro plan starts at " +
          "$39/month [1]. **AWS RDS for MySQL** is cheaper at small sizes but needs more setup [2].",
        sources: pages(
          ["PlanetScale pricing", "https://planetscale.com/pricing"],
          ["Amazon RDS for MySQL pricing", "https://aws.amazon.com/rds/mysql/pricing/"],
        ),
        memories: [
          fact("The user has a client whose app runs on MySQL.", "MySQL"),
          claim(
            "PlanetScale's Scaler Pro plan starts at $39 per month.",
            "https://planetscale.com/pricing",
            "PlanetScale",
          ),
        ],
      },
    ],
  },
  // --- Four and three weeks ago: the side project's stack, decided one chat at a time.
  {
    title: "Hosting a Next.js app",
    at: on(WED, "20:40", 4),
    turns: [
      {
        question: "Where should I host the Next.js frontend of my side project?",
        answer:
          "**Vercel Pro** is $20 per user per month [1]; **Cloudflare Workers Paid** starts at " +
          "$5/month [2]. Vercel is the least work for Next.js.",
        sources: pages(
          ["Vercel pricing", "https://vercel.com/pricing"],
          [
            "Cloudflare Workers pricing",
            "https://developers.cloudflare.com/workers/platform/pricing/",
          ],
        ),
        memories: [
          fact("The user's side project has a Next.js frontend.", "Next.js"),
          claim("Vercel Pro costs $20 per user per month.", "https://vercel.com/pricing", "Vercel"),
          claim(
            "Cloudflare Workers Paid starts at $5 per month.",
            "https://developers.cloudflare.com/workers/platform/pricing/",
            "Cloudflare Workers",
          ),
        ],
      },
      {
        question: "Vercel Pro it is.",
        answer: "Noted. One seat is enough while you're the only developer.",
        memories: [decision("The user decided to host the side project on Vercel Pro.", "Vercel")],
      },
    ],
  },
  {
    title: "Chromebook for school",
    at: on(THU, "08:50", 4),
    turns: [
      {
        question: "My daughter needs a laptop for school, under $500. What do you suggest?",
        answer:
          "A Chromebook Plus model: the **Acer Chromebook Plus 514** is $399 [1] and the " +
          "**Lenovo IdeaPad Flex 5i Chromebook Plus** is $499 [2].",
        sources: pages(
          [
            "Acer Chromebook Plus 514",
            "https://www.acer.com/us-en/chromebooks/acer-chromebook-plus-514",
          ],
          [
            "Lenovo Flex 5i Chromebook Plus",
            "https://www.lenovo.com/us/en/p/laptops/lenovo/flex-5i-chromebook-plus",
          ],
        ),
        memories: [
          fact("The user's daughter needs a laptop for school, under $500."),
          claim(
            "The Acer Chromebook Plus 514 costs $399.",
            "https://www.acer.com/us-en/chromebooks/acer-chromebook-plus-514",
            "Acer Chromebook",
          ),
        ],
      },
    ],
  },
  {
    title: "Transactional email for the side project",
    at: on(FRI, "17:10", 4),
    turns: [
      {
        question: "Which service should the side project use to send sign-up emails?",
        answer:
          "**Resend Pro** is $20/month for 50,000 emails [1]; **Postmark** starts at $15/month " +
          "for 10,000 [2]. Both have free tiers for testing.",
        sources: pages(
          ["Resend pricing", "https://resend.com/pricing"],
          ["Postmark pricing", "https://postmarkapp.com/pricing"],
        ),
        memories: [
          claim(
            "Resend Pro costs $20 per month for 50,000 emails.",
            "https://resend.com/pricing",
            "Resend",
          ),
          claim(
            "Postmark starts at $15 per month for 10,000 emails.",
            "https://postmarkapp.com/pricing",
            "Postmark",
          ),
        ],
      },
      {
        question: "Let's go with Resend.",
        answer: "Noted. Start on the free tier; move to Pro when you pass 3,000 emails a month.",
        memories: [
          decision("The user decided to send the side project's email with Resend.", "Resend"),
        ],
      },
    ],
  },
  {
    title: "Help desk software for the support team",
    at: on(MON, "13:25", 4),
    turns: [
      {
        question: "Our support team is 6 people. Which help desk tool is good value?",
        answer:
          "**Freshdesk Growth** at $15 per agent per month [1] is the best value; " +
          "**Zendesk Suite Team** is $55 per agent per month [2].",
        sources: pages(
          ["Freshdesk pricing", "https://www.freshworks.com/freshdesk/pricing/"],
          ["Zendesk pricing", "https://www.zendesk.com/pricing/"],
        ),
        memories: [
          fact("The user's support team has 6 people."),
          claim(
            "Freshdesk Growth costs $15 per agent per month.",
            "https://www.freshworks.com/freshdesk/pricing/",
            "Freshdesk",
          ),
          claim(
            "Zendesk Suite Team costs $55 per agent per month.",
            "https://www.zendesk.com/pricing/",
            "Zendesk",
          ),
        ],
      },
    ],
  },
  {
    title: "Error monitoring for the side project",
    at: on(WED, "21:05", 3),
    turns: [
      {
        question: "What should I use to track errors in the side project?",
        answer: "**Sentry**: the free Developer plan covers one user, and Team is $26/month [1].",
        sources: pages(["Sentry pricing", "https://sentry.io/pricing/"]),
        memories: [
          claim("Sentry's Team plan costs $26 per month.", "https://sentry.io/pricing/", "Sentry"),
        ],
      },
      {
        question: "I'll pay for Sentry Team.",
        answer: "Noted.",
        memories: [
          decision("The user decided to use Sentry's Team plan for the side project.", "Sentry"),
        ],
      },
    ],
  },
  {
    title: "Sales offsite in Austin",
    at: on(FRI, "10:45", 3),
    turns: [
      {
        question: "We're based in Austin. Any ideas for a one-day sales team offsite in January?",
        answer:
          "Rent a room at a Hill Country ranch for the morning session, then go to a barbecue " +
          "lunch and an afternoon activity such as kayaking on Lady Bird Lake.",
        memories: [
          fact("The user's company is based in Austin, Texas.", "Austin"),
          fact("The user is planning a one-day sales team offsite in January.", "Austin"),
        ],
      },
    ],
  },
  {
    title: "Postgres for production at work",
    // A Tuesday too, three weeks before the side-project chat.
    at: on(TUE, "11:00", 3),
    turns: [
      {
        question:
          "At work we need Postgres hosting for production: about 200 GB, with high " +
          "availability. How do AWS RDS, Google Cloud SQL and Crunchy Bridge compare?",
        answer:
          "For 200 GB with a standby: **AWS RDS** Multi-AZ on a db.m6g.xlarge is about " +
          "$520/month [1], **Google Cloud SQL** with high availability is about $560/month [2], " +
          "and **Crunchy Bridge** Standard-16 with a replica is about $480/month [3].",
        sources: pages(
          ["Amazon RDS for PostgreSQL pricing", "https://aws.amazon.com/rds/postgresql/pricing/"],
          ["Cloud SQL pricing", "https://cloud.google.com/sql/pricing"],
          ["Crunchy Bridge pricing", "https://www.crunchydata.com/pricing"],
        ),
        memories: [
          fact(
            "At work, the user needs production Postgres hosting: about 200 GB, with high availability.",
            "Postgres",
          ),
          claim(
            "AWS RDS for PostgreSQL, Multi-AZ on a db.m6g.xlarge with 200 GB, costs about $520 per month.",
            "https://aws.amazon.com/rds/postgresql/pricing/",
            "AWS RDS",
          ),
          claim(
            "Google Cloud SQL for PostgreSQL with high availability and 200 GB costs about $560 per month.",
            "https://cloud.google.com/sql/pricing",
            "Google Cloud SQL",
          ),
          claim(
            "Crunchy Bridge Standard-16 with a replica costs about $480 per month.",
            "https://www.crunchydata.com/pricing",
            "Crunchy Bridge",
          ),
        ],
      },
    ],
  },
  // --- Two weeks ago.
  {
    title: "Password manager for the company",
    at: on(WED, "12:30", 2),
    turns: [
      {
        question: "Which password manager should a 40-person company use?",
        answer:
          "**1Password Business** is $7.99 per user per month [1]; **Bitwarden Teams** is " +
          "$4 per user per month [2] and is open source.",
        sources: pages(
          ["1Password pricing", "https://1password.com/pricing"],
          ["Bitwarden pricing", "https://bitwarden.com/pricing/business/"],
        ),
        memories: [
          fact("The user's company has about 40 people."),
          claim(
            "1Password Business costs $7.99 per user per month.",
            "https://1password.com/pricing",
            "1Password",
          ),
          claim(
            "Bitwarden Teams costs $4 per user per month.",
            "https://bitwarden.com/pricing/business/",
            "Bitwarden",
          ),
        ],
      },
      {
        question: "We'll go with Bitwarden.",
        answer: "Noted. Turn on two-step login for everyone from day one.",
        memories: [decision("The user's company decided to use Bitwarden Teams.", "Bitwarden")],
      },
    ],
  },
  {
    title: "Redis hosting options",
    at: on(THU, "22:10", 2),
    turns: [
      {
        question: "Where can I get a small hosted Redis for caching?",
        answer:
          "**Upstash** has a free tier and then charges $0.20 per 100,000 commands [1]; " +
          "**Redis Cloud Essentials** starts at $5/month [2].",
        sources: pages(
          ["Upstash Redis pricing", "https://upstash.com/pricing/redis"],
          ["Redis Cloud pricing", "https://redis.io/pricing/"],
        ),
        memories: [
          claim(
            "Upstash Redis charges $0.20 per 100,000 commands after its free tier.",
            "https://upstash.com/pricing/redis",
            "Upstash",
          ),
          claim(
            "Redis Cloud Essentials starts at $5 per month.",
            "https://redis.io/pricing/",
            "Redis Cloud",
          ),
        ],
      },
    ],
  },
  {
    title: "Vegetarian dinner ideas",
    at: on(FRI, "18:30", 2),
    turns: [
      {
        question: "I'm vegetarian. Give me three quick weeknight dinners.",
        answer:
          "Chickpea and spinach curry with rice; halloumi tacos with slaw; and a mushroom " +
          "and miso noodle stir-fry. Each takes under 30 minutes.",
        memories: [preference("The user is vegetarian.")],
      },
    ],
  },
  {
    title: "Sales call recording tools",
    at: on(MON, "09:15", 2),
    turns: [
      {
        question: "Which tools record and summarise sales calls? They must work with Zoom.",
        answer:
          "**Fathom** is free for individuals and $19 per user per month for teams [1]; " +
          "**Fireflies Pro** is $10 per seat per month [2]. Both join Zoom calls.",
        sources: pages(
          ["Fathom pricing", "https://fathom.video/pricing"],
          ["Fireflies pricing", "https://fireflies.ai/pricing"],
        ),
        memories: [
          preference("The user's sales tools must work with Zoom.", "Zoom"),
          claim(
            "Fathom's team plan costs $19 per user per month.",
            "https://fathom.video/pricing",
            "Fathom",
          ),
          claim(
            "Fireflies Pro costs $10 per seat per month.",
            "https://fireflies.ai/pricing",
            "Fireflies",
          ),
        ],
      },
    ],
  },
  // --- Last week and the week before.
  {
    title: "Auth for the side project",
    at: on(WED, "19:45", 1),
    turns: [
      {
        question: "Should the side project use Clerk or Auth.js for sign-in?",
        answer:
          "**Clerk Pro** is $25/month after a free tier of 10,000 users [1]. **Auth.js** is " +
          "free and open source, but you run it yourself [2].",
        sources: pages(
          ["Clerk pricing", "https://clerk.com/pricing"],
          ["Auth.js", "https://authjs.dev/"],
        ),
        memories: [claim("Clerk Pro costs $25 per month.", "https://clerk.com/pricing", "Clerk")],
      },
      {
        question: "I'll use Auth.js, since it's free.",
        answer: "Noted. Use its database sessions with your Postgres.",
        memories: [
          decision("The user decided to use Auth.js for the side project's sign-in.", "Auth.js"),
        ],
      },
    ],
  },
  {
    title: "Laptop for programming",
    brief: true,
    at: on(THU, "16:40", 1),
    turns: [
      {
        question: "Which laptop should I get for programming, under $1,500?",
        answer:
          "Two good picks:\n\n" +
          "- **MacBook Air 13-inch (M4, 16 GB)**: from $999, with the best battery life in its class [1].\n" +
          "- **Framework Laptop 13**: from $1,049, and repairable, if you want Linux [2].\n\n" +
          "Get at least 16 GB of memory either way.",
        sources: pages(
          ["MacBook Air - Apple", "https://www.apple.com/macbook-air/"],
          ["Framework Laptop 13", "https://frame.work/laptop13"],
        ),
        memories: [
          fact("The user wants a laptop for programming, under $1,500."),
          claim(
            "The MacBook Air 13-inch with M4 and 16 GB of memory starts at $999.",
            "https://www.apple.com/macbook-air/",
            "MacBook Air",
          ),
          claim(
            "The Framework Laptop 13 starts at $1,049.",
            "https://frame.work/laptop13",
            "Framework",
          ),
        ],
      },
      {
        question: "I'll go with the MacBook Air.",
        answer:
          "Good choice for programming. If you run Docker or several VMs, 24 GB of memory is " +
          "worth the upgrade.",
        memories: [decision("The user decided to buy the MacBook Air 13-inch.", "MacBook Air")],
      },
    ],
  },
  {
    title: "Domain registrars",
    at: on(FRI, "08:20", 1),
    turns: [
      {
        question: "Where should I register the .com for the side project?",
        answer:
          "**Cloudflare Registrar** sells at cost: $10.44 a year for a .com [1]. " +
          "**Namecheap** is cheaper in year one but renews at $16.98 [2].",
        sources: pages(
          ["Cloudflare Registrar", "https://www.cloudflare.com/products/registrar/"],
          ["Namecheap domains", "https://www.namecheap.com/domains/"],
        ),
        memories: [
          claim(
            "Cloudflare Registrar charges $10.44 a year for a .com domain.",
            "https://www.cloudflare.com/products/registrar/",
            "Cloudflare Registrar",
          ),
          decision(
            "The user decided to register the side project's domain with Cloudflare Registrar.",
            "Cloudflare Registrar",
          ),
        ],
      },
    ],
  },
  {
    title: "CRM for a 5-person agency",
    // The Monday before the brief's shortlist, and for someone else's team.
    at: on(MON, "15:20", 1),
    turns: [
      {
        question:
          "A friend runs a 5-person design agency. Which CRM tools are free or nearly free for them?",
        answer:
          "**HubSpot's free CRM** covers up to 2 users [1], **Zoho Bigin Express** is $7 per " +
          "user per month [2] and **Capsule Starter** is $18 per user per month [3].",
        sources: pages(
          ["HubSpot free CRM", "https://www.hubspot.com/products/crm"],
          ["Bigin pricing", "https://www.bigin.com/pricing.html"],
          ["Capsule pricing", "https://capsulecrm.com/pricing/"],
        ),
        memories: [
          fact("The user's friend runs a 5-person design agency and needs a cheap CRM."),
          claim(
            "Zoho Bigin Express costs $7 per user per month.",
            "https://www.bigin.com/pricing.html",
            "Zoho",
          ),
          claim(
            "Capsule Starter costs $18 per user per month.",
            "https://capsulecrm.com/pricing/",
            "Capsule",
          ),
        ],
      },
    ],
  },
  {
    title: "Marathon training plan",
    // The same day as the brief's Postgres chat, in the morning.
    at: on(TUE, "09:10", 1),
    turns: [
      {
        question:
          "My marathon is in April. How many weeks of training do I need, and how many runs a week?",
        answer:
          "Plan for 16 to 18 weeks, with four runs a week: one long run, one tempo run and two " +
          "easy runs. Build the long run up to 32 km three weeks before race day.",
        memories: [
          fact("The user's marathon is in April."),
          fact(
            "A 16 to 18 week plan with four runs a week was recommended for the user's marathon.",
          ),
        ],
      },
    ],
  },
  {
    title: "Postgres hosting for a side project",
    topic: "Postgres hosting",
    brief: true,
    // The Tuesday before last, so "last Tuesday" has to pick between two. Late in the evening,
    // so in the Americas it is already the next day in UTC.
    at: on(TUE, "20:15", 1),
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
        sources: pages(
          ["Neon pricing", NEON],
          ["Supabase pricing", SUPABASE],
          ["Railway pricing", RAILWAY],
        ),
        memories: [
          fact("The user needs managed Postgres for a small side project.", "Postgres"),
          claim(
            "Neon's free plan includes 0.5 GB of storage, and its Launch plan starts at $19 per month.",
            NEON,
            "Neon",
          ),
          claim(
            "Supabase Pro costs $25 per month per organization and includes $10 of compute credits.",
            SUPABASE,
            "Supabase",
          ),
          claim(
            "Railway's Hobby plan costs $5 per month and includes $5 of usage.",
            RAILWAY,
            "Railway",
          ),
        ],
      },
    ],
  },
  {
    title: "LinkedIn Sales Navigator pricing",
    at: on(WED, "14:35"),
    turns: [
      {
        question: "How much is LinkedIn Sales Navigator per seat?",
        answer:
          "**Sales Navigator Core** is $99.99 per month, or $79.99 per month billed annually [1].",
        sources: pages([
          "Sales Navigator pricing",
          "https://business.linkedin.com/sales-solutions/compare-plans",
        ]),
        memories: [
          claim(
            "LinkedIn Sales Navigator Core costs $99.99 per month, or $79.99 per month billed annually.",
            "https://business.linkedin.com/sales-solutions/compare-plans",
            "LinkedIn Sales Navigator",
          ),
        ],
      },
    ],
  },
  {
    title: "Database choice for the side project",
    at: on(THU, "18:05"),
    turns: [
      {
        question:
          "For the side project's database I'll go with Railway. Anything I should set up first?",
        answer:
          "Turn on daily backups and set a usage limit, so a runaway query can't run up the bill.",
        memories: [
          decision("The user decided to host the side project's database on Railway.", "Railway"),
        ],
      },
    ],
  },
  {
    title: "Neon pricing update",
    at: on(FRI, "13:45"),
    turns: [
      {
        question: "I heard Neon changed its pricing. What does the Launch plan cost now?",
        answer:
          "Neon's **Launch** plan is now pay-as-you-go with a $5 monthly minimum, down from a " +
          "$19 flat fee [1].",
        sources: pages(["Neon pricing", NEON]),
        memories: [
          claim("Neon's Launch plan is now pay-as-you-go with a $5 monthly minimum.", NEON, "Neon"),
        ],
      },
      {
        question: "Then I'll move the side project's database from Railway to Neon.",
        answer: "Noted. Use pg_dump and pg_restore; for a small database it takes minutes.",
        memories: [
          decision(
            "The user decided to move the side project's database from Railway to Neon.",
            "Neon",
            "Railway",
          ),
        ],
      },
    ],
  },
  {
    title: "Weekend in the Hill Country",
    at: on(SAT, "10:00"),
    turns: [
      {
        question: "Suggest an easy day hike within an hour of Austin.",
        answer:
          "Pedernales Falls State Park: the 5 km Twin Falls and river loop is easy, and it is " +
          "about 50 minutes west of the city.",
        memories: [
          fact("Pedernales Falls State Park was suggested as a day hike near Austin.", "Austin"),
        ],
      },
    ],
  },
  {
    title: "Sunday meal prep",
    at: on(SUN, "17:30"),
    turns: [
      {
        question: "What can I batch-cook today for lunches this week?",
        answer:
          "A lentil and sweet potato dal: it keeps for five days, freezes well and is " +
          "vegetarian. Cook rice fresh every two days.",
        memories: [],
      },
    ],
  },
  {
    title: "CRM shortlist for a 20-person team",
    topic: "CRM shortlist",
    brief: true,
    at: on(MON, "10:30"),
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
        sources: pages(
          ["Freshsales pricing", "https://www.freshworks.com/crm/pricing/"],
          ["HubSpot Sales Hub pricing", HUBSPOT],
          ["Zoho CRM pricing", ZOHO],
          ["Salesforce Sales Cloud pricing", "https://www.salesforce.com/sales/pricing/"],
          ["Pipedrive pricing", "https://www.pipedrive.com/en/pricing"],
        ),
        memories: [
          fact("The user's sales team has 20 people."),
          preference("The user wants a CRM under $50 per user per month."),
          claim(
            "Freshsales Growth costs $9 per user per month, billed annually.",
            "https://www.freshworks.com/crm/pricing/",
            "Freshsales",
          ),
          claim(
            "HubSpot Sales Hub Starter costs $15 per seat per month, billed annually.",
            HUBSPOT,
            "HubSpot",
          ),
          claim(
            "Zoho CRM Professional costs $23 per user per month, billed annually.",
            ZOHO,
            "Zoho",
          ),
          claim(
            "Salesforce Starter Suite costs $25 per user per month, billed annually.",
            "https://www.salesforce.com/sales/pricing/",
            "Salesforce",
          ),
          claim(
            "Pipedrive's Growth plan costs $34 per user per month, billed annually.",
            "https://www.pipedrive.com/en/pricing",
            "Pipedrive",
          ),
        ],
      },
      {
        question: "Which of them works best with Gmail?",
        answer:
          "All five sync with Gmail. Pipedrive's two-way sync and email tracking are the most " +
          "complete at this price; HubSpot's Gmail extension is the quickest to set up.",
        memories: [preference("The user wants a CRM that works well with Gmail.", "Gmail")],
      },
    ],
  },
  {
    title: "Sales commission structures",
    // The same Monday as the shortlist, in the afternoon.
    at: on(MON, "16:00"),
    turns: [
      {
        question: "What's a typical commission structure for SaaS account executives?",
        answer:
          "A 50/50 split of base and variable pay, with about 10% commission on new annual " +
          "contract value and accelerators above quota.",
        memories: [],
      },
    ],
  },
  {
    title: "HubSpot cost after hiring",
    topic: "CRM shortlist",
    at: on(TUE, "09:40"),
    turns: [
      {
        question:
          "We just hired five more reps, so the sales team is 25 people now. What would " +
          "HubSpot Sales Hub Starter cost us per year?",
        answer: "At $15 per seat per month, billed annually, 25 seats cost $4,500 a year [1].",
        sources: pages(["HubSpot Sales Hub pricing", HUBSPOT]),
        memories: [fact("The user's sales team has 25 people, after hiring five more reps.")],
      },
    ],
  },
];
