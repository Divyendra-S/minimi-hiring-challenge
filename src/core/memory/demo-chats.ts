import type { Source } from "@/shared/events";
import { pastWeekday } from "./dates";
import type { NewMemory } from "./memories";

// The sample history: 47 chats over eight weeks, most of them several turns long, dated relative to now. It is built to be hard to
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
/** Names what a memory is the value of, so a later memory about the same thing replaces it. */
const about = (subject: string, memory: Told): Told => ({ ...memory, subject });

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
          "For a first marathon you want a cushioned daily trainer that you can do nearly all your kilometres in, not a racing shoe. Three reliable ones:\n" +
          "\n" +
          "- **Brooks Ghost 16** ($140) [1]: soft, neutral and very predictable. It suits most feet without any fuss.\n" +
          "- **Asics Novablast 5** ($140) [2]: lighter and bouncier, good if you like a livelier feel on faster days.\n" +
          "- **Saucony Ride 18** ($145) [3]: a little firmer, with a roomier toe box.\n" +
          "\n" +
          "The Ghost is the safest pick if you haven't been fitted.\n" +
          "\n" +
          "A few things matter more than the model:\n" +
          "\n" +
          "- Buy half a size up from your everyday shoes, because feet swell on long runs.\n" +
          "- Try them on late in the day, in the socks you run in.\n" +
          "- Get them at least six weeks before the race, so the long runs break them in.\n" +
          "\n" +
          "If a running shop near you offers a free gait analysis, it is worth twenty minutes before you spend $140.",
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
      {
        question: "I overpronate a bit. Does that change the pick?",
        answer:
          "Yes, it does: look at a stability shoe instead of a neutral one. The **Brooks Adrenaline GTS 24** ($140) is the stability version of the Ghost [1], so you keep the same cushioning and fit and gain support along the inner side of the foot.\n" +
          "\n" +
          "Why it matters: when the foot rolls inward, the arch and the inside of the knee take extra load on every step, and that adds up over the hundreds of kilometres in a marathon plan. A stability shoe has firmer support on the inside edge that slows the roll without forcing your foot into a new position.\n" +
          "\n" +
          "Two cautions:\n" +
          "\n" +
          "- A bit of overpronation is common and is not always a problem. If you run 10 km in neutral shoes without shin or knee pain, either type can work.\n" +
          "- Don't combine a stability shoe with a corrective insole unless a physio tells you to. Together they can over-correct.\n" +
          "\n" +
          "A shop with a treadmill can film your stride and confirm this in a few minutes.",
        sources: pages([
          "Brooks Adrenaline GTS 24",
          "https://www.brooksrunning.com/en_us/adrenaline-gts-24",
        ]),
        memories: [
          fact("The user overpronates slightly when running."),
          claim(
            "The Brooks Adrenaline GTS 24 costs $140.",
            "https://www.brooksrunning.com/en_us/adrenaline-gts-24",
            "Brooks Adrenaline",
          ),
        ],
      },
      {
        question: "How often should I replace them during training?",
        answer:
          "Every 500 to 800 km. On a marathon plan that works out to one pair for training and a second pair, broken in over about 50 km, for race day.\n" +
          "\n" +
          "How to tell a pair is finished, whatever the distance says:\n" +
          "\n" +
          "- The midsole feels flat, or you can see deep creases in the foam from the side.\n" +
          "- The outsole is worn smooth at the heel or under the ball of the foot.\n" +
          "- You get new aches in the shins, knees or arches that you didn't have a month ago.\n" +
          "\n" +
          "A practical way to do it: note the date you start a pair and add up your weekly distance, or let your running app track the shoe. Buy the second pair around two months before the race, wear it for a few easy runs and one long run, then keep it for race day. Heavier runners and people who run mostly on roads should aim for the lower end of the range.",
        memories: [],
      },
      {
        question: "OK, I'll get the Adrenaline, after trying it on at a running shop.",
        answer:
          "Good plan. Trying it on first is the right call for a shoe you'll spend 16 weeks in.\n" +
          "\n" +
          "To get the most from the visit:\n" +
          "\n" +
          "- Go in the afternoon or evening, when your feet are at their largest.\n" +
          "- Bring the socks you run in, and your current running shoes: the wear on the soles tells the staff a lot.\n" +
          "- Ask to jog in them, on the treadmill or outside the shop, not only walk.\n" +
          "- Check for a thumb's width of space in front of your longest toe, and that your heel doesn't slip.\n" +
          "\n" +
          'Try the Adrenaline in both the standard and the wide fit if the shop has them. If it feels right straight away, that is the one: a running shoe should not need "breaking in" to be comfortable. Keep the receipt, since many running shops accept returns after a test run or two.',
        memories: [
          decision(
            "The user decided to buy the Brooks Adrenaline GTS 24 running shoes.",
            "Brooks Adrenaline",
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
          "Two models are clearly ahead for long flights:\n" +
          "\n" +
          "- **Sony WH-1000XM6** ($449) [1]: cancels the most engine noise, especially the low drone of a plane cabin. Excellent microphones and a very capable app.\n" +
          "- **Bose QuietComfort Ultra** ($429) [2]: almost as quiet, and the more comfortable of the two for ten hours. The clamp is lighter and the ear cushions are softer.\n" +
          "\n" +
          "How to choose between them:\n" +
          "\n" +
          "- If you mainly want silence and you take calls, pick the Sony.\n" +
          "- If you wear glasses, sleep on planes, or find headphones start to hurt after a few hours, pick the Bose.\n" +
          "\n" +
          "Both fold into a case, both work wired when the battery is flat, and both connect to two devices at once. Either way, noise cancelling works best on steady low sounds such as engines; it does less for voices and crying babies, so don't expect total silence.",
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
        answer:
          "Good pick for comfort. On a long flight that matters more than the last few decibels of noise cancelling.\n" +
          "\n" +
          "A few things to know before your first trip with it:\n" +
          "\n" +
          "- Its case folds flat, which helps in a carry-on.\n" +
          "- Set up the Bose app at home and update the firmware over Wi-Fi; doing it at the gate is slow.\n" +
          '- Try the "Quiet" and "Aware" modes before you fly, and save a custom mode with full cancelling and Immersive Audio off, which is the best setting for battery life in the air.\n' +
          "- Switch on multipoint if you want it connected to your phone and laptop at once.\n" +
          "\n" +
          "If you sleep on planes, lean your head on the window with the cup flat against it; the Bose cushions are soft enough that this is comfortable. Buy from a shop with a 30-day return policy in case the fit isn't right for you.",
        memories: [
          decision("The user decided to buy the Bose QuietComfort Ultra.", "Bose QuietComfort"),
        ],
      },
      {
        question: "Can I plug it into the plane's screen?",
        answer:
          "Yes. It comes with a 3.5 mm audio cable, and noise cancelling keeps working while you are plugged in.\n" +
          "\n" +
          "What you need depends on the plane:\n" +
          "\n" +
          "- Newer aircraft have a single 3.5 mm socket in the seat. The cable in the box is all you need.\n" +
          "- Older aircraft have a two-prong socket. For those you need a two-prong airline adapter, which costs about $8. Some airlines hand them out, but don't rely on it.\n" +
          "- A few new planes let you pair Bluetooth headphones to the screen directly.\n" +
          "\n" +
          "If you'd like to stay wireless on any plane, a small Bluetooth transmitter that plugs into the seat socket does the job, though it is one more thing to charge. For most people the cable and a spare two-prong adapter in the headphone case is the simplest setup.",
        memories: [],
      },
      {
        question: "How long does the battery last?",
        answer:
          "About 24 hours, or 18 hours with Immersive Audio on [1]. That covers any single flight, including the longest routes with a connection.\n" +
          "\n" +
          "In practice:\n" +
          "\n" +
          "- A 15-minute charge gives roughly 2.5 hours of listening, so a quick top-up at the gate is enough.\n" +
          "- A full charge over USB-C takes about three hours.\n" +
          "- Immersive Audio is the main thing that drains it. For films on a plane you won't miss it, so leave it off.\n" +
          "- You can charge it from a power bank or the seat's USB port while it is in use.\n" +
          "\n" +
          "If the battery does run out, the headphones still work with the cable, but only while powered on, so it is worth charging before a long trip.",
        sources: pages([
          "Bose QuietComfort Ultra",
          "https://www.bose.com/p/headphones/quietcomfort-ultra",
        ]),
        memories: [
          claim(
            "The Bose QuietComfort Ultra battery lasts about 24 hours, or 18 hours with Immersive Audio on.",
            "https://www.bose.com/p/headphones/quietcomfort-ultra",
            "Bose QuietComfort",
          ),
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
          "For a first visit, stay in **Chiado** or **Baixa**. Both are central, mostly flat by Lisbon standards, and close to the metro, so you can walk to most of what you'll want to see.\n" +
          "\n" +
          "- **Baixa**: the grid of streets between Rossio and the river. The most convenient for transport and the airport metro, with lots of hotels. It is busy and a little touristy.\n" +
          "- **Chiado**: just uphill from Baixa. Bookshops, cafes, theatres and better restaurants, and it feels more like a neighbourhood.\n" +
          "- **Alfama**: the old quarter on the hill. It is the prettiest, but steep, with cobbled lanes that are hard with luggage, and it is noisy at night near the fado bars.\n" +
          "- **Bairro Alto**: lively until 3 am. Fine to visit, hard to sleep in.\n" +
          "\n" +
          "March is a good time to go: mild, around 17 °C, with few queues. Pack a light rain jacket and shoes with grip, because the polished paving stones are slippery when wet.",
        memories: [
          fact("The user is travelling to Lisbon in March with their partner.", "Lisbon"),
          fact("Chiado and Baixa were recommended as areas to stay in Lisbon.", "Lisbon"),
        ],
      },
      {
        question: "We like walking and food more than nightlife. Chiado or Baixa, then?",
        answer:
          "Chiado. It has the better restaurants and cafes, and it is quieter after midnight than Bairro Alto next door.\n" +
          "\n" +
          "Why it suits the two of you:\n" +
          "\n" +
          "- **Walking**: you can reach Baixa, the riverfront, Bairro Alto, Príncipe Real and the lower edge of Alfama on foot, most of them in under 15 minutes.\n" +
          "- **Food**: the streets around Rua Garrett and Largo do Carmo have everything from old pastry shops to modern Portuguese kitchens, and the Time Out Market is ten minutes downhill.\n" +
          "- **Evenings**: there are wine bars and a few late cafes, but the streets go quiet around midnight.\n" +
          "\n" +
          "One tip when you book: ask for a room facing an inner courtyard or a side street. Rooms on Rua Garrett or near the tram line hear the early trams. Staying near Baixa-Chiado metro station also gives you a direct, cheap ride to and from the airport with one change.",
        memories: [
          preference(
            "The user and their partner prefer walking and food to nightlife when they travel.",
          ),
        ],
      },
      {
        question: "What's a fair nightly rate for a good hotel there in March?",
        answer:
          "About €130 to €180 a night for a good four-star hotel in Chiado. March is shoulder season, so prices are well below summer, when the same rooms often go for €220 or more.\n" +
          "\n" +
          "What moves the price within that range:\n" +
          "\n" +
          "- Weekends cost more than Sunday to Thursday nights.\n" +
          "- A river view or a balcony usually adds €20 to €40.\n" +
          "- Breakfast is often €15 to €20 per person extra; cafes nearby are cheaper and better.\n" +
          "- Lisbon charges a city tax per person per night, paid at the hotel.\n" +
          "\n" +
          "To get a fair deal, compare the hotel's own site with a booking site, and choose a free-cancellation rate now: you can rebook if the price drops. Small guesthouses and serviced apartments in the same streets run €90 to €130 and are often just as comfortable.",
        memories: [
          fact(
            "A four-star hotel in Chiado in March was estimated at €130 to €180 a night.",
            "Lisbon",
          ),
        ],
      },
      {
        question: "How many days do we need?",
        answer:
          "Four full days: two for the city, one for Belém and one for a day trip to Sintra.\n" +
          "\n" +
          "A simple way to split them:\n" +
          "\n" +
          "- **Day 1**: Baixa, Chiado and the Carmo ruins, then the viewpoint at São Pedro de Alcântara at sunset.\n" +
          "- **Day 2**: Alfama and the castle in the morning, when it is cooler and quieter. Take tram 28 early or skip it; walking downhill through Alfama is nicer.\n" +
          "- **Day 3**: Belém for the monastery, the tower and the pastries, with the LX Factory on the way back.\n" +
          "- **Day 4**: Sintra by train. Go early and pick two sights, not all of them.\n" +
          "\n" +
          "With a fifth day you could add Cascais or the Gulbenkian museum. With only three, drop Belém to a half day. Since you both prefer walking and food to nightlife, leave the evenings unplanned and book only one or two dinners ahead.",
        memories: [
          fact(
            "Four full days were recommended for the Lisbon trip, with a day trip to Sintra.",
            "Lisbon",
            "Sintra",
          ),
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
          "Postgres, unless your team already runs MySQL. For a new app with no history, it is the safer default.\n" +
          "\n" +
          "What you get with Postgres:\n" +
          "\n" +
          "- **Richer types**: arrays, ranges, UUIDs, enums and proper timestamps with time zones.\n" +
          "- **Better JSON support**: the JSONB type can be indexed and queried, so you can keep semi-structured data without adding a document database.\n" +
          "- **More extensions**: PostGIS for maps, pgvector for embeddings, and full-text search built in.\n" +
          "- **Stricter behaviour**: it rejects bad data by default, where MySQL has historically been more forgiving.\n" +
          "\n" +
          "When MySQL is still the right call:\n" +
          "\n" +
          "- Your team has years of MySQL operations experience.\n" +
          "- You are building on a platform or framework that assumes it.\n" +
          "- You need a very simple, read-heavy setup with well-known replication tools.\n" +
          "\n" +
          "Both are fast enough and well supported by every host and ORM. The difference shows up later, when the app grows and you want the features above without adding another system.",
        memories: [preference("The user prefers Postgres for new projects.", "Postgres", "MySQL")],
      },
      {
        question: "Does that hold if I need full-text search?",
        answer:
          "Yes. Postgres has full-text search built in, and it is enough until you need typo tolerance or ranking by popularity.\n" +
          "\n" +
          "What it does well:\n" +
          "\n" +
          '- Stemming, so "running" matches "run".\n' +
          "- Ranking results by relevance.\n" +
          "- An index type made for it, which keeps searches fast on millions of rows.\n" +
          "- Search across several columns with different weights, for example title above body.\n" +
          "\n" +
          "Where it falls short:\n" +
          "\n" +
          "- No typo tolerance out of the box. The pg_trgm extension gets you part of the way.\n" +
          "- No search-as-you-type suggestions or faceted counts without extra work.\n" +
          "- Tuning relevance is harder than in a dedicated engine.\n" +
          "\n" +
          "A sensible path: start with Postgres search, because it needs no extra service and stays in sync with your data automatically. If search becomes a core feature, add Meilisearch or Typesense later and feed it from Postgres. MySQL also has full-text search, but it is more limited, so this doesn't change the recommendation.",
        memories: [],
      },
      {
        question: "And for analytics queries?",
        answer:
          "Still Postgres for a small app. Past tens of millions of rows, add a column store such as ClickHouse next to it rather than replacing it.\n" +
          "\n" +
          "Why Postgres is fine at first:\n" +
          "\n" +
          "- Dashboards and reports over a few million rows run in well under a second with the right indexes.\n" +
          "- Window functions, grouping sets and materialized views cover most reporting queries.\n" +
          "- One database means no pipeline to build and nothing to keep in sync.\n" +
          "\n" +
          "Signs you have outgrown it for analytics:\n" +
          "\n" +
          "- Reports scan most of a large table and take many seconds.\n" +
          "- Analytics queries slow down the app's normal traffic.\n" +
          "- You want to keep raw events for years.\n" +
          "\n" +
          "Before reaching for a second system, try a read replica for reports and a few summary tables refreshed on a schedule. That usually buys another year or two. MySQL is weaker here, so the choice stays the same.",
        memories: [],
      },
      {
        question: "Fine. Postgres by default from now on.",
        answer:
          "Noted: Postgres by default from now on.\n" +
          "\n" +
          "A few habits that pay off from the first project:\n" +
          "\n" +
          "- Use migrations from day one, even when you are the only developer.\n" +
          "- Use timestamptz for every time column, and store times in UTC.\n" +
          "- Prefer identity or UUID primary keys, and add foreign keys; they are cheap insurance.\n" +
          "- Turn on connection pooling early if the app runs on serverless functions.\n" +
          "- Take automated backups and test one restore.\n" +
          "\n" +
          "For local development, run the same major version in Docker that you will use in production, so behaviour matches. When you are ready to pick a host for a particular project, tell me roughly how big the database is and how much traffic you expect, and I can compare the options.",
        memories: [],
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
          "For a list of 2,000 contacts, the cheapest paid options are:\n" +
          "\n" +
          "- **Brevo Starter**: $9/month [1]. It charges by emails sent, not by contacts, which is why it is cheap for a small list.\n" +
          "- **Mailchimp Essentials**: $13/month [2]. Priced by contacts; the best-known editor and the most integrations.\n" +
          "- **HubSpot Marketing Hub Starter**: $15/seat per month [3]. Worth it mainly if you already use HubSpot's CRM.\n" +
          "\n" +
          "Things to check before you choose:\n" +
          "\n" +
          "- **Sending limits**: plans cap either contacts or emails per month, so the cheapest depends on how often you send.\n" +
          "- **Branding**: free tiers put the tool's logo in your footer; the paid plans above let you remove it.\n" +
          "- **Growth**: Mailchimp's price rises in steps as the list grows; Brevo's rises with volume.\n" +
          "\n" +
          "If you only send a newsletter now and then, Brevo is the best value. All three have free plans, so you can import a small test list and try the editor before paying.",
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
      {
        question: "We send two campaigns a month. Does any of them cap how much we send?",
        answer:
          "Brevo Starter includes 5,000 emails a month [1], which covers two campaigns to 2,000 contacts: that is 4,000 emails, with 1,000 spare for a resend or a welcome email. Mailchimp Essentials allows ten sends per contact each month, so 20,000 emails for your list, far more than you need.\n" +
          "\n" +
          "So neither cap gets in your way today. Where each one would start to matter:\n" +
          "\n" +
          "- **Brevo**: a third monthly campaign would take you to 6,000 emails, over the Starter allowance, and you would move up a volume tier.\n" +
          "- **Mailchimp**: the cap that bites is contacts, not sends. Passing 2,500 contacts moves you to the next price step.\n" +
          "\n" +
          "Also note that automated emails, such as a welcome series, count towards these limits on both. If you plan to send weekly within the year, Mailchimp's allowance fits better; at two campaigns a month, Brevo is cheaper and sufficient.",
        sources: pages(["Brevo pricing", "https://www.brevo.com/pricing/"]),
        memories: [
          fact("The user sends about two email campaigns a month."),
          claim(
            "Brevo Starter includes 5,000 emails per month.",
            "https://www.brevo.com/pricing/",
            "Brevo",
          ),
        ],
      },
      {
        question: "Which one has the best templates?",
        answer:
          "Mailchimp has the largest template library, and its designs are the most polished out of the box. Brevo's editor is simpler, and fine for a newsletter.\n" +
          "\n" +
          "In more detail:\n" +
          "\n" +
          "- **Mailchimp**: well over a hundred templates, a brand kit that pulls colours and a logo from your site, and a mature drag-and-drop editor. Some of the nicest templates are limited to higher plans.\n" +
          "- **Brevo**: a few dozen clean layouts and a straightforward editor. It is quicker to learn, and saved blocks make a repeat newsletter fast to put together.\n" +
          "- **HubSpot**: good templates, but the best ones sit in the more expensive tiers.\n" +
          "\n" +
          "In practice most teams build one template in their own colours and reuse it every time, so the size of the library matters less than how easy the editor is. All three also let you paste in your own HTML if a designer makes you a custom layout.",
        memories: [],
      },
      {
        question: "We'll try Brevo first.",
        answer:
          "Noted: Brevo first.\n" +
          "\n" +
          "A short setup list so the first campaign lands well:\n" +
          "\n" +
          "1. Import the list as a CSV file, with one column each for email, first name and anything you want to segment by.\n" +
          "2. Verify your sending domain before the first campaign. Brevo gives you DKIM and DMARC records to add to your DNS; without them more of your mail goes to spam.\n" +
          "3. Only import people who agreed to hear from you, and keep the unsubscribe link visible.\n" +
          "4. Send the first campaign to the 200 or so most engaged contacts, then to the rest a day later. That builds a good sender reputation.\n" +
          "5. Send yourself a test and check it on a phone.\n" +
          "\n" +
          "After two campaigns, look at open rate, click rate and unsubscribes. If the editor or the 5,000-email allowance starts to feel tight, Mailchimp Essentials at $13/month is the easy fallback.",
        memories: [decision("The user decided to try Brevo for email marketing.", "Brevo")],
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
          "Two good options for managed MySQL:\n" +
          "\n" +
          "- **PlanetScale** is the easiest. Its Scaler Pro plan starts at $39/month [1] and gives you branching for schema changes, online migrations with no downtime, and very little to administer.\n" +
          "- **AWS RDS for MySQL** is cheaper at small sizes but needs more setup [2]: you choose the instance, storage, backups, networking and maintenance windows yourself.\n" +
          "\n" +
          "How I'd choose for a client project:\n" +
          "\n" +
          "- If you will hand the app over and the client has no database administrator, PlanetScale costs less of your time.\n" +
          "- If the client already has an AWS account and the app runs there, RDS keeps everything in one place and on one bill.\n" +
          "\n" +
          "Before you propose either, it helps to know the database size, where the client's users are, and whether they have any data residency rules. One thing to check with PlanetScale: how the app uses foreign keys and long transactions, since its platform has had its own rules about both.",
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
      {
        question: "The database is about 30 GB. Does that change the price?",
        answer:
          "Yes. Scaler Pro includes 10 GB of storage, and more storage is $1.50 per GB [1], so 30 GB comes to about $69/month: $39 for the plan plus $30 for the extra 20 GB.\n" +
          "\n" +
          "A few points for the estimate you give the client:\n" +
          "\n" +
          "- Storage is billed on what the data actually uses, including indexes, so measure the real size and don't go by the size of a dump file.\n" +
          "- Leave room for growth. At 2 GB a month, the bill rises by about $3 each month.\n" +
          "- Backups are included, but check the retention period fits the client's needs.\n" +
          "\n" +
          "For comparison, 30 GB on AWS RDS adds only a few dollars of storage to the instance price, so RDS is the cheaper of the two at this size. The gap is small next to the time PlanetScale saves on operations, but it is worth showing both numbers so the client can decide.",
        sources: pages(["PlanetScale pricing", "https://planetscale.com/pricing"]),
        memories: [
          fact("The client's MySQL database is about 30 GB.", "MySQL"),
          claim(
            "PlanetScale charges $1.50 per GB of storage beyond the 10 GB that Scaler Pro includes.",
            "https://planetscale.com/pricing",
            "PlanetScale",
          ),
        ],
      },
      {
        question: "The client is in Germany. Is there an EU region?",
        answer:
          "Yes, both offer Frankfurt, so the data can stay in the EU.\n" +
          "\n" +
          "What to set up for a German client:\n" +
          "\n" +
          "- Create the database in the Frankfurt region from the start; moving regions later means a migration.\n" +
          "- Check where backups and any read replicas are stored, and keep those in the EU as well.\n" +
          "- Host the app's servers in or near Frankfurt too. A database in Germany with an app in the US adds a noticeable delay to every query.\n" +
          "- Ask the provider for its data processing agreement. Both PlanetScale and AWS have one, and German clients usually want it signed and on file.\n" +
          "\n" +
          "If the client has stricter rules, for example in health or finance, ask them whether a US-owned provider is acceptable at all before you go further. Most are fine with an EU region and a signed agreement.",
        memories: [
          fact("The user's MySQL client is based in Germany and wants the data hosted in the EU."),
        ],
      },
      {
        question: "I'll propose PlanetScale to them.",
        answer:
          "Noted: PlanetScale for the proposal.\n" +
          "\n" +
          "Points that tend to land well with a client:\n" +
          "\n" +
          "- **Branching** lets them test schema changes on a copy and deploy them with no downtime. Mention this first; it is the main thing they would not get elsewhere.\n" +
          "- **Cost**: about $69/month at 30 GB, with the storage rate so they can see how it grows.\n" +
          "- **EU hosting** in Frankfurt, with a data processing agreement.\n" +
          "- **Little to operate**: backups, failover and upgrades are handled for them.\n" +
          "\n" +
          "It is also worth including the alternative you considered, AWS RDS, in a sentence or two, with the reason you didn't pick it: cheaper at this size, but more to set up and maintain. Clients trust a recommendation more when they can see what it was compared with. Add a line on the migration plan too: a dump and restore during a quiet hour, with a rollback step.",
        memories: [
          decision(
            "The user decided to propose PlanetScale to the client for MySQL hosting.",
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
          "Two realistic options for the Next.js frontend:\n" +
          "\n" +
          "- **Vercel Pro**: $20 per user per month [1]. Vercel makes Next.js, so every feature works with no configuration: server components, image optimisation, preview deployments for each pull request.\n" +
          "- **Cloudflare Workers Paid**: starts at $5/month [2]. Very fast and cheap at scale, but you deploy through an adapter and a few Next.js features behave differently.\n" +
          "\n" +
          "Vercel is the least work for Next.js, and for a side project your time is the scarce resource.\n" +
          "\n" +
          "How to decide:\n" +
          "\n" +
          "- Pick Vercel if you want to push to GitHub and have it deployed, with previews.\n" +
          "- Pick Cloudflare if cost at high traffic matters most, or you already use its other services.\n" +
          "\n" +
          "Vercel's free Hobby plan is enough to start, but its terms limit it to non-commercial use, so move to Pro before you charge anyone. A third route, a small server with Docker, is the cheapest of all but leaves updates and uptime to you.",
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
        answer:
          "Noted: Vercel Pro. One seat is enough while you're the only developer, so the bill is $20 a month.\n" +
          "\n" +
          "To set it up:\n" +
          "\n" +
          "1. Import the GitHub repository in the Vercel dashboard. It detects Next.js and needs no build settings.\n" +
          "2. Add your environment variables, separately for production and preview.\n" +
          "3. Push a branch and open a pull request to see a preview deployment with its own URL.\n" +
          "4. Add your domain when you are ready.\n" +
          "\n" +
          "Two settings worth changing on day one:\n" +
          "\n" +
          "- Turn on spend management, so a traffic spike or a bug can't produce a surprise bill.\n" +
          "- Choose the function region closest to your database. A function in one continent calling a database in another is the most common cause of a slow Next.js app.\n" +
          "\n" +
          "If someone joins you later, each extra developer who deploys needs their own seat; people who only view previews don't.",
        memories: [decision("The user decided to host the side project on Vercel Pro.", "Vercel")],
      },
      {
        question: "Does Pro include a custom domain?",
        answer:
          "Yes. Custom domains are unlimited on every plan, including the free one, with HTTPS set up for you.\n" +
          "\n" +
          "How it works:\n" +
          "\n" +
          "- Add the domain in the project's settings, then point it at Vercel with the DNS records it shows you.\n" +
          "- Certificates are issued and renewed automatically, at no cost.\n" +
          "- You can attach both the bare domain and the www version, and choose which one redirects to the other.\n" +
          "- Preview deployments can get their own subdomains, such as staging.yourdomain.com.\n" +
          "\n" +
          "You still need to buy the domain itself from a registrar; Vercel sells them too, but you can use any registrar and keep your DNS wherever you like. DNS changes usually take effect within minutes, though they can take a few hours. If you also want email on the domain, keep those DNS records in place when you add Vercel's.",
        memories: [],
      },
      {
        question: "What happens if I go over the included bandwidth?",
        answer:
          "Pro includes 1 TB of bandwidth a month; beyond that it is $0.15 per GB [1]. A side project is unlikely to reach it.\n" +
          "\n" +
          "To put 1 TB in perspective: a typical page with its scripts and images is 1 to 2 MB, so 1 TB is on the order of half a million to a million page loads a month. If you did go over by 100 GB, the extra charge would be $15.\n" +
          "\n" +
          "How to stay well clear of it:\n" +
          "\n" +
          "- Serve images through the Next.js image component, so they are resized and cached.\n" +
          "- Keep large files, such as videos or downloads, in object storage and not in the app.\n" +
          "- Set cache headers on static pages so repeat visits cost almost nothing.\n" +
          "\n" +
          "Bandwidth is rarely the line that surprises people. Function invocations and image optimisation are metered separately, so turn on spend management with a monthly cap and an email alert, and you will hear about any spike before it costs much.",
        sources: pages(["Vercel pricing", "https://vercel.com/pricing"]),
        memories: [
          claim(
            "Vercel Pro includes 1 TB of bandwidth a month, then charges $0.15 per GB.",
            "https://vercel.com/pricing",
            "Vercel",
          ),
        ],
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
          "For school use under $500, I'd suggest a Chromebook Plus model. That label guarantees a decent processor, 8 GB of memory and a full HD screen, which is the difference between a laptop that lasts through school and one that feels slow in a year.\n" +
          "\n" +
          "- **Acer Chromebook Plus 514**: $399 [1]. A 14-inch screen, a comfortable keyboard and about ten hours of battery. The best value.\n" +
          "- **Lenovo IdeaPad Flex 5i Chromebook Plus**: $499 [2]. Adds a touchscreen and a hinge that folds flat into a tablet.\n" +
          "\n" +
          "Why a Chromebook and not a cheap Windows laptop:\n" +
          "\n" +
          "- It starts in seconds and updates itself, with very little to go wrong.\n" +
          "- Schools that use Google's tools usually manage Chromebooks already.\n" +
          "- At this price, Windows laptops tend to have slow storage and poor screens.\n" +
          "\n" +
          "Check the automatic update date for the model before you buy; recent ones get about ten years of updates. If she needs specific software for a class, tell me which and I'll check that it runs.",
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
      {
        question: "Will it run Google Classroom and Minecraft Education?",
        answer:
          "Yes, both run well on a Chromebook Plus.\n" +
          "\n" +
          "- **Google Classroom** is a web app, so it works in Chrome exactly as on any other computer, together with Docs, Slides and Meet. This is the use Chromebooks are built for.\n" +
          "- **Minecraft Education** has an official Chromebook version, installed from the Play Store. Her school account signs her in, and the Acer's processor and 8 GB of memory handle it smoothly.\n" +
          "\n" +
          "Two things to know:\n" +
          "\n" +
          "- Minecraft Education needs a licence, which schools normally provide through the school account. If it asks for one at home, the school's IT contact can sort it out.\n" +
          "- Lessons that use multiplayer worlds need everyone on the same version, so let the Chromebook update the app when it asks.\n" +
          "\n" +
          "The ordinary game, Minecraft Bedrock, is a separate purchase and is not needed for school.",
        memories: [
          fact("The user's daughter uses Google Classroom and Minecraft Education at school."),
        ],
      },
      {
        question: "Is the Lenovo's touchscreen worth the extra $100?",
        answer:
          "Only if she draws or takes handwritten notes. For typing and web apps, the Acer is the better buy.\n" +
          "\n" +
          "When the Lenovo's extras earn the $100:\n" +
          "\n" +
          "- She likes to sketch, or does art or maths where writing by hand is easier than typing.\n" +
          "- She would use it folded as a tablet for reading or watching.\n" +
          "- Younger children sometimes find touch more natural than a trackpad.\n" +
          "\n" +
          "When they don't:\n" +
          "\n" +
          "- Most school work is typing in Docs, slides and research, where a touchscreen adds nothing.\n" +
          "- A folding hinge is one more part that can loosen in a school bag.\n" +
          "- A stylus is usually sold separately, which adds to the cost.\n" +
          "\n" +
          "At primary-school age, most children end up using the keyboard and trackpad nearly all the time. I would put the $100 towards a sleeve and a spare charger for school instead.",
        memories: [],
      },
      {
        question: "I'll get the Acer.",
        answer:
          "Noted: the Acer Chromebook Plus 514. A sound choice at $399.\n" +
          "\n" +
          "A few things that make it last:\n" +
          "\n" +
          "- **Add a sleeve.** School bags are hard on laptops, and a padded one costs about $15 to $20.\n" +
          "- Set it up with her school account first, and add a personal account only if she needs one.\n" +
          "- Turn on Family Link if you want screen-time limits and control over which apps she can install.\n" +
          "- Put her name on the charger as well as the laptop. Chargers are what get lost.\n" +
          "\n" +
          "When it arrives, check the screen for dead pixels and make sure the battery charges fully within the return period. Retailers often discount this model around the school holidays, so if you are not in a hurry it is worth checking two or three shops before you order.",
        memories: [
          decision(
            "The user decided to buy the Acer Chromebook Plus 514 for their daughter.",
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
          "For sign-up emails you want a transactional email service, which is built for one-to-one messages that must arrive quickly. Two good ones:\n" +
          "\n" +
          "- **Resend Pro**: $20/month for 50,000 emails [1]. A modern API, a first-class Node.js library, and templates you can write as React components.\n" +
          "- **Postmark**: starts at $15/month for 10,000 emails [2]. It has the best reputation for delivery speed and keeps transactional mail on separate servers from marketing mail.\n" +
          "\n" +
          "Both have free tiers for testing.\n" +
          "\n" +
          "How they differ in use:\n" +
          "\n" +
          "- Resend fits a Next.js project naturally and is cheaper per email as you grow.\n" +
          "- Postmark has more detailed delivery logs and longer message history, which helps when a user says an email never arrived.\n" +
          "\n" +
          "Either will do the job for a side project. Whichever you pick, you will need to verify your domain with a few DNS records before the emails reach inboxes reliably.",
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
        answer:
          "Noted: Resend. Start on the free tier, and move to Pro when you pass 3,000 emails a month.\n" +
          "\n" +
          "Getting started:\n" +
          "\n" +
          "1. Add your domain in the Resend dashboard and create the DNS records it lists. Verification usually takes a few minutes.\n" +
          "2. Create an API key and store it as an environment variable in Vercel. Use a separate key for development.\n" +
          "3. Install the Node.js library and send a test email from a server route.\n" +
          "4. Write the sign-up email as a React component, so it lives in your repository with the rest of the code.\n" +
          "\n" +
          "While you are on the free tier, keep an eye on the daily sending limit as well as the monthly one, since a burst of sign-ups can hit it. Set up the webhook for bounces and complaints early too: it tells you when an address is bad, so you can stop sending to it.",
        memories: [
          decision("The user decided to send the side project's email with Resend.", "Resend"),
        ],
      },
      {
        question: "Do I need a dedicated IP address?",
        answer:
          "No. Below about 100,000 emails a month, a shared IP has the better reputation.\n" +
          "\n" +
          "The reason is that inbox providers judge an IP address by the volume and consistency of mail it sends:\n" +
          "\n" +
          "- A shared IP at a good provider already has a steady, trusted history, because many careful senders use it.\n" +
          '- A dedicated IP starts with no history. You have to "warm it up" over weeks by slowly raising volume, and you have to keep sending steadily or the reputation fades.\n' +
          "- With a few thousand sign-up emails a month, you would never send enough to keep a dedicated IP warm.\n" +
          "\n" +
          "A dedicated IP makes sense when you send a large, regular volume and want full control over your own reputation. For a side project, the things that actually affect delivery are your domain's authentication records and whether people mark your mail as spam, not the IP.",
        memories: [],
      },
      {
        question: "How do I keep sign-up emails out of spam?",
        answer:
          "Three things do most of the work:\n" +
          "\n" +
          "1. **Authenticate your domain.** Set up SPF, DKIM and DMARC. Resend gives you the exact DNS records. Start DMARC in monitoring mode, then tighten it once you see that your mail passes.\n" +
          "2. **Send from a subdomain** such as mail.yourdomain.com. It keeps the reputation of your sign-up emails separate from anything else sent from your main domain.\n" +
          "3. **Keep the email plain.** A short text message with one link looks like a real person wrote it. Heavy HTML, many images and link shorteners look like marketing.\n" +
          "\n" +
          "Smaller things that help:\n" +
          "\n" +
          '- Use a clear subject, such as "Confirm your email for [product]".\n' +
          "- Send from a real, monitored address, not no-reply.\n" +
          "- Send immediately after sign-up. A user who is waiting for the email opens it, and opens build reputation.\n" +
          "- Remove addresses that bounce.\n" +
          "\n" +
          "Then send test emails to Gmail and Outlook accounts and check where they land. A tool such as mail-tester.com will score a message and tell you what is missing.",
        memories: [],
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
          "For a team of 6, two options cover most needs:\n" +
          "\n" +
          "- **Freshdesk Growth**: $15 per agent per month [1]. The best value. It has ticketing, email and social channels, automations, a knowledge base and basic reports.\n" +
          "- **Zendesk Suite Team**: $55 per agent per month [2]. More polished, with live chat, a help centre and a much larger app marketplace included.\n" +
          "\n" +
          "For six agents that is $90 a month against $330 a month, so the question is whether Zendesk's extras are worth $240 a month to you.\n" +
          "\n" +
          "Where the extra money goes:\n" +
          "\n" +
          "- Zendesk bundles chat, voice and messaging into one workspace.\n" +
          "- Its reporting and routing rules go deeper.\n" +
          "- More tools integrate with it out of the box.\n" +
          "\n" +
          "For a small team that mostly answers email, Freshdesk Growth is enough, and it is easy to move up a plan later. If you tell me which channels your customers use and what tools you need it to connect to, I can check the fit more closely.",
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
      {
        question: "We need a shared inbox and a knowledge base. Does Freshdesk Growth have both?",
        answer:
          "Yes, both are in the Growth plan.\n" +
          "\n" +
          "- **Shared inbox**: your support address forwards into Freshdesk, and each email becomes a ticket the whole team can see. You can assign tickets, leave private notes for colleagues, and see when someone else is already replying, which prevents double answers.\n" +
          "- **Knowledge base**: a public help centre where you publish articles by category. Agents can insert an article into a reply with a couple of clicks, and customers see suggested articles when they open a ticket.\n" +
          "\n" +
          "Also in Growth and useful alongside them:\n" +
          "\n" +
          "- Automation rules, for example to route billing questions to one person.\n" +
          "- Canned responses for common answers.\n" +
          "- Service-level targets with reminders before a ticket goes overdue.\n" +
          "\n" +
          "What Growth leaves out: custom roles, round-robin assignment and a customer portal on your own branding beyond the basics. Those come in the next plan up, and most six-person teams don't miss them at first.",
        memories: [
          preference("The user's support team needs a shared inbox and a knowledge base."),
        ],
      },
      {
        question: "What would it cost us per year?",
        answer:
          "6 agents at $15 a month is $90 a month, or $1,080 a year.\n" +
          "\n" +
          "A few details on that figure:\n" +
          "\n" +
          "- $15 is the price when you pay annually. On monthly billing, the per-agent price is higher, so the same team costs noticeably more over a year.\n" +
          "- You pay only for agents, the people who answer tickets. Colleagues who occasionally need to read a ticket can usually be added as free collaborators.\n" +
          "- There is no setup fee on this plan.\n" +
          "\n" +
          "For comparison, Zendesk Suite Team for the same six people would be $330 a month, or $3,960 a year. So the difference is about $2,880 a year.\n" +
          "\n" +
          "If the team grows to 8, Freshdesk Growth would be $1,440 a year. Taxes are added where they apply, so check the checkout total for your country before you put a number in a budget.",
        memories: [],
      },
      {
        question: "Let's trial Freshdesk.",
        answer:
          "Noted: a Freshdesk trial. It runs for 14 days and needs no card.\n" +
          "\n" +
          "To make two weeks count:\n" +
          "\n" +
          "1. Forward your real support address into it from day one. A trial with test tickets tells you very little.\n" +
          "2. Have all six agents use it, not only one champion.\n" +
          "3. Set up three or four canned responses and one automation rule in the first few days.\n" +
          "4. Write five knowledge base articles for your most common questions and link them in replies.\n" +
          "5. Check the reports at the end of each week: first response time and tickets resolved.\n" +
          "\n" +
          'Agree beforehand on what "good enough" means, for example: nobody answers the same ticket twice, and replies go out faster than today. At the end, ask each agent what slowed them down. If the answer is "nothing much", you have your tool; if not, the list of complaints tells you what to look for in the next one.',
        memories: [
          decision("The user's support team decided to trial Freshdesk Growth.", "Freshdesk"),
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
        answer:
          "**Sentry**. The free Developer plan covers one user, and Team is $26/month [1].\n" +
          "\n" +
          "Why it is the usual choice:\n" +
          "\n" +
          "- It has an official Next.js integration that sets itself up with one command and captures errors from the browser, the server and edge functions.\n" +
          "- Each error comes with the stack trace mapped back to your source code, the browser and device, and the steps that led up to it.\n" +
          "- Repeated errors are grouped into one issue, so a bug that fires 500 times is one line, not 500 emails.\n" +
          "\n" +
          "What the plans differ in:\n" +
          "\n" +
          "- **Developer** (free): one user, a limited error allowance and short data retention. Enough to start.\n" +
          "- **Team**: more errors, more users, longer retention, and integrations such as Slack and GitHub.\n" +
          "\n" +
          "For a side project with one developer, start on the free plan. The moment to pay is when you hit the monthly error limit or want alerts sent to a chat channel. Whichever plan you use, upload source maps during the build; without them the stack traces are unreadable.",
        sources: pages(["Sentry pricing", "https://sentry.io/pricing/"]),
        memories: [
          claim("Sentry's Team plan costs $26 per month.", "https://sentry.io/pricing/", "Sentry"),
        ],
      },
      {
        question: "I'll pay for Sentry Team.",
        answer:
          "Noted: Sentry Team, at $26 a month.\n" +
          "\n" +
          "To get value from it straight away:\n" +
          "\n" +
          "1. Run the Next.js setup wizard. It adds the configuration files and wraps your build so source maps upload on every deploy.\n" +
          "2. Add the DSN and auth token as environment variables in Vercel.\n" +
          "3. Throw a test error on a page and check that it shows up with a readable stack trace.\n" +
          "4. Connect GitHub, so each error links to the commit that likely introduced it.\n" +
          "5. Set an alert rule: notify me when a new issue appears, and when any issue affects more than a handful of users.\n" +
          "\n" +
          "Two settings to tune early:\n" +
          "\n" +
          "- Set the environment name, so errors from preview deployments don't mix with production.\n" +
          "- Ignore the noise, such as errors from browser extensions and cancelled network requests. Otherwise real problems get buried.",
        memories: [
          decision("The user decided to use Sentry's Team plan for the side project.", "Sentry"),
        ],
      },
      {
        question: "How many errors does Team include?",
        answer:
          "50,000 errors a month [1]. For a side project that is plenty in a normal month.\n" +
          "\n" +
          "The risk is an abnormal one: a bad deploy that throws on every page load can burn through the whole allowance in an hour, and after that Sentry drops new errors until the month resets. So set a spike limit, so one bad deploy can't use them all.\n" +
          "\n" +
          "Other ways to protect the quota:\n" +
          "\n" +
          "- **Rate limit per key**: cap how many events a single project can send per minute.\n" +
          "- **Inbound filters**: drop errors from old browsers, browser extensions and known crawlers before they count.\n" +
          "- **Sampling**: for high-volume, low-value errors, send only a fraction.\n" +
          "- **Ignore rules**: mark known harmless errors so they stop counting.\n" +
          "\n" +
          "Performance traces and session replays have their own separate allowances, so turning those on doesn't eat into the 50,000. Check the usage page after the first two weeks; it shows which issues consume the most, and those are usually worth fixing or filtering.",
        sources: pages(["Sentry pricing", "https://sentry.io/pricing/"]),
        memories: [
          claim(
            "Sentry's Team plan includes 50,000 errors per month.",
            "https://sentry.io/pricing/",
            "Sentry",
          ),
        ],
      },
      {
        question: "Should I turn on session replay too?",
        answer:
          "Not yet. Add it when you have users whose bug reports you can't reproduce.\n" +
          "\n" +
          "What it gives you: a video-like recording of what the user saw and did before an error, including clicks, navigation, console messages and network requests. For bugs that depend on a particular sequence of actions, it can save hours.\n" +
          "\n" +
          "Why to wait:\n" +
          "\n" +
          "- It adds a script of noticeable size to every page, which costs a little load time.\n" +
          "- It records user sessions, so you need to mask text and inputs carefully and mention it in your privacy policy.\n" +
          "- The replay allowance is limited, and most early bugs are clear enough from the stack trace alone.\n" +
          "\n" +
          "A middle path when you do turn it on: record no ordinary sessions, and capture a replay only when an error occurs. That keeps the cost and the privacy exposure low and still gives you the recording in exactly the cases where you need it.",
        memories: [],
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
          "A plan that works well for one day near Austin in January:\n" +
          "\n" +
          "- **Morning**: rent a room at a Hill Country ranch or winery, 30 to 45 minutes from the city. Getting out of town changes the mood and stops people drifting back to their laptops.\n" +
          "- **Lunch**: barbecue, either brought in or at one of the well-known places on the way back.\n" +
          "- **Afternoon**: an activity that mixes people up, such as kayaking on Lady Bird Lake.\n" +
          "\n" +
          "Other afternoon options, depending on the group:\n" +
          "\n" +
          "- A cooking class or a barbecue pit tour, for something less physical.\n" +
          "- A brewery or distillery tour in Dripping Springs.\n" +
          "- Top Golf or a similar venue, which works in any weather.\n" +
          "\n" +
          "January in Austin is mild but changeable, typically 5 to 17 °C, so have an indoor backup for anything on the water. Keep the working session to the morning, when people are fresh, and end with something social. If you tell me the head count and budget, I can turn this into a costed plan.",
        memories: [
          fact("The user's company is based in Austin, Texas.", "Austin"),
          fact("The user is planning a one-day sales team offsite in January.", "Austin"),
        ],
      },
      {
        question: "There will be 20 of us and the budget is $4,000. Is that realistic?",
        answer:
          "Yes. That is $200 a head, which is comfortable for a one-day offsite near Austin.\n" +
          "\n" +
          "A rough split:\n" +
          "\n" +
          "- **Room**: about $1,200 for a private space at a ranch or winery for the morning, with a screen and coffee.\n" +
          "- **Lunch**: about $800, or $40 a person for barbecue with sides and drinks.\n" +
          "- **Activity**: about $1,000 for guided kayaking or a similar group booking.\n" +
          "- **Transport and extras**: about $1,000, for a chartered bus so nobody has to drive, plus snacks, awards and a small contingency.\n" +
          "\n" +
          "Where it could go over:\n" +
          "\n" +
          "- Alcohol at lunch or at the end of the day. Decide up front whether the budget covers it.\n" +
          "- A Saturday booking, which usually costs more than a weekday.\n" +
          "- A facilitator, if you want an outside person to run the workshop.\n" +
          "\n" +
          "Ask venues for a weekday corporate rate, and get the activity quote in writing with a wet-weather clause. Holding back $300 to $400 for surprises is sensible.",
        memories: [fact("The budget for the sales offsite is $4,000.")],
      },
      {
        question: "Give me a rough agenda.",
        answer:
          "A rough agenda for the day:\n" +
          "\n" +
          "- **9:30** Review of the year. Keep it to 45 minutes: the numbers, three wins, and one or two lessons, with reps telling the stories.\n" +
          "- **11:00** Workshop on the Q1 plan. Split into groups of five, each working on one question, then report back.\n" +
          "- **12:30** Barbecue lunch.\n" +
          "- **14:30** Kayaking.\n" +
          "- **17:00** Drinks and awards.\n" +
          "\n" +
          "Notes on making it work:\n" +
          "\n" +
          "- Leave the bus by 8:30 if the venue is 45 minutes out, and have coffee waiting.\n" +
          "- Put a 15-minute break at 10:15 and a buffer before lunch; workshops always run over.\n" +
          "- Mix the groups across roles, so SDRs and account executives who rarely talk end up together.\n" +
          "- Keep the awards light: a couple of serious ones and a few funny ones.\n" +
          "- End on time. People have families, and a hard stop at 18:00 is appreciated.\n" +
          "\n" +
          "Send the agenda a week ahead, with what to wear for the afternoon.",
        memories: [],
      },
      {
        question: "What if it rains?",
        answer:
          "Hold a private room at a bowling or shuffleboard venue as the backup for the afternoon.\n" +
          "\n" +
          "Why those work:\n" +
          "\n" +
          "- They take a group of 20 in one space, with food and drinks on site.\n" +
          "- People rotate between lanes or tables, so they mix just as they would on the water.\n" +
          "- Nobody needs special clothing or any skill.\n" +
          "\n" +
          "How to arrange it so rain doesn't cost you twice:\n" +
          "\n" +
          "- Ask the kayak operator for its weather policy. Most allow a free reschedule or a refund if they cancel for weather, but not if you do.\n" +
          "- Ask the indoor venue for a tentative hold with a decision date, ideally 48 hours before. Some want a small deposit.\n" +
          "- Decide who makes the call and when: for example, the forecast at noon two days before.\n" +
          "\n" +
          "Cold matters as well as rain. If the day is dry but below about 10 °C, the indoor option will be more fun for most of the group, so check the temperature too.",
        memories: [],
      },
      {
        question: "Let's hold Friday 22 January.",
        answer:
          "Noted: Friday 22 January 2027.\n" +
          "\n" +
          "Book the ranch soon. January weekdays fill up about eight weeks ahead, which means confirming by late November.\n" +
          "\n" +
          "A timeline that keeps it easy:\n" +
          "\n" +
          "- **This week**: put a hold on the venue and send a calendar invite to all 20, so the date is protected.\n" +
          "- **By the end of November**: confirm the venue, the bus and the kayak booking, and place the tentative hold on the rainy-day venue.\n" +
          "- **Early January**: order lunch, collect dietary needs, and draft the review of the year.\n" +
          "- **A week before**: send the agenda, the pick-up point and what to wear.\n" +
          "- **Two days before**: check the forecast and decide between the lake and the backup.\n" +
          "\n" +
          "A Friday is a good choice: people can relax at the end without work the next morning. Check that the date doesn't clash with the end-of-month close for anyone who is chasing a deal.",
        memories: [fact("The sales offsite is planned for Friday 22 January 2027.")],
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
          "For 200 GB with a standby in a second zone, the three come out close:\n" +
          "\n" +
          "- **AWS RDS** Multi-AZ on a db.m6g.xlarge: about $520/month [1].\n" +
          "- **Google Cloud SQL** with high availability: about $560/month [2].\n" +
          "- **Crunchy Bridge** Standard-16 with a replica: about $480/month [3].\n" +
          "\n" +
          "Each figure is for 4 virtual CPUs and 16 GB of memory, with 200 GB of SSD storage and a standby that takes over automatically.\n" +
          "\n" +
          "How they differ beyond price:\n" +
          "\n" +
          "- **RDS**: the most mature, with the widest choice of instance sizes and the best fit if the rest of your stack is on AWS. More knobs to set.\n" +
          "- **Cloud SQL**: the natural choice on Google Cloud, with simple setup and good integration with BigQuery.\n" +
          "- **Crunchy Bridge**: run by a Postgres-only company. You get full superuser access, more extensions, and support from people who work on Postgres itself. It runs on AWS, Google Cloud or Azure.\n" +
          "\n" +
          "Costs that these figures leave out: backup storage beyond the free allowance, data transfer out, and provisioned IOPS if your workload needs them. The deciding factor is usually which cloud your application servers are in, because a database in another network adds latency and transfer fees.",
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
      {
        question: "We're on AWS for everything else. Does that settle it?",
        answer:
          "Mostly, yes. RDS keeps the traffic inside your VPC and on one bill, which is usually worth the small price difference.\n" +
          "\n" +
          "What you gain by staying on AWS:\n" +
          "\n" +
          "- **Network**: the app and the database talk over private addresses, with low latency and no data transfer fees between zones in the same region beyond the usual.\n" +
          "- **Security**: one set of IAM roles, security groups and audit logs, which your team already knows.\n" +
          "- **Operations**: the same monitoring, alerting and infrastructure code as everything else.\n" +
          "- **Procurement**: no new vendor to approve, and the spend counts towards any AWS commitment you have.\n" +
          "\n" +
          "What you give up:\n" +
          "\n" +
          "- Crunchy Bridge was about $40 a month cheaper and gives superuser access and more extensions.\n" +
          "- RDS support for Postgres is general AWS support, not Postgres specialists.\n" +
          "\n" +
          "One thing to weigh before you settle: Aurora PostgreSQL, also on AWS. It costs more per hour but fails over faster and grows storage automatically. For 200 GB with a steady load, standard RDS is the simpler and cheaper choice.",
        memories: [fact("The user's company runs its infrastructure on AWS.", "AWS")],
      },
      {
        question: "What does a read replica add on RDS?",
        answer:
          "Another db.m6g.xlarge instance, about $180/month [1]. A replica is billed as a normal single-zone instance of the size you choose, plus its own storage.\n" +
          "\n" +
          "What it gets you:\n" +
          "\n" +
          "- Read queries, such as reports and dashboards, can go to the replica and leave the primary free for writes.\n" +
          "- It can sit in another region for disaster recovery.\n" +
          "- It can be promoted to a standalone database if you ever need to.\n" +
          "\n" +
          "What to keep in mind:\n" +
          "\n" +
          "- Replication is asynchronous, so the replica can lag by a fraction of a second to a few seconds. Don't read from it right after a write that the user expects to see.\n" +
          "- Your application has to send reads to it deliberately, with a second connection string.\n" +
          "- It doesn't replace the Multi-AZ standby. The standby is for failover; the replica is for read capacity.\n" +
          "\n" +
          "With both, the total would be about $700 a month. Unless reports are already slowing the primary, start without the replica and add it when you see the need; it takes a few minutes to create.",
        sources: pages([
          "Amazon RDS for PostgreSQL pricing",
          "https://aws.amazon.com/rds/postgresql/pricing/",
        ]),
        memories: [
          claim(
            "An extra AWS RDS db.m6g.xlarge read replica costs about $180 per month.",
            "https://aws.amazon.com/rds/postgresql/pricing/",
            "AWS RDS",
          ),
        ],
      },
      {
        question: "We'll go with RDS.",
        answer:
          "Noted: AWS RDS for production. Turn on automated backups with 14 days of retention from the start; the default is shorter, and you can't recover a day you didn't keep.\n" +
          "\n" +
          "A checklist for the first setup:\n" +
          "\n" +
          "- **Multi-AZ** on, so a standby in another zone takes over automatically.\n" +
          "- **Storage**: gp3, with autoscaling on and a sensible ceiling.\n" +
          "- **Encryption** at rest, which must be chosen at creation and can't be added later without a rebuild.\n" +
          "- **Deletion protection** on.\n" +
          "- **Parameter group**: your own, not the default, so you can tune settings later without a rebuild.\n" +
          "- **Maintenance window**: your quietest hour, with minor version upgrades on.\n" +
          "- **Monitoring**: Performance Insights and alarms on CPU, free storage, connections and replication lag.\n" +
          "- **Access**: a private subnet only, with security groups limited to the application servers.\n" +
          "\n" +
          "Before go-live, run one restore from a backup into a test instance and time it. That number is your real recovery time, and it is better to learn it now than during an incident.",
        memories: [
          decision(
            "The user's company decided to host its production Postgres on AWS RDS.",
            "AWS RDS",
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
          "For a 40-person company, two stand out:\n" +
          "\n" +
          "- **1Password Business**: $7.99 per user per month [1]. The most polished apps, very good browser autofill, and admin tools such as reports on weak or reused passwords and fine-grained groups.\n" +
          "- **Bitwarden Teams**: $4 per user per month [2]. Open source and regularly audited, with all the essentials: shared collections, groups and two-step login.\n" +
          "\n" +
          "For 40 people that is about $320 a month against $160 a month.\n" +
          "\n" +
          "How to choose:\n" +
          "\n" +
          "- Pick 1Password if ease of use matters most. Staff who are not technical adopt it faster, and adoption is what makes a password manager worth having.\n" +
          "- Pick Bitwarden if cost and open source matter, and your team is comfortable with a slightly plainer interface.\n" +
          "\n" +
          "Either is far better than a shared spreadsheet or browser-saved passwords. Things to check for your company: whether you need single sign-on, whether you want to manage users from your existing directory, and whether contractors need limited access.",
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
        answer:
          "Noted: Bitwarden Teams. Turn on two-step login for everyone from day one; making it a requirement later is harder than starting with it.\n" +
          "\n" +
          "A rollout plan that works at 40 people:\n" +
          "\n" +
          "1. **Set up the organisation**: create collections by team, such as Engineering, Sales and Finance, and groups that match.\n" +
          "2. **Set policies**: require two-step login and a minimum strength for the master password.\n" +
          "3. **Pilot** with five people for a week, and fix what confuses them.\n" +
          "4. **Roll out** team by team, with a 20-minute session showing how to install the browser extension, import existing passwords and share an item.\n" +
          "5. **Clean up**: ask everyone to delete passwords saved in their browser once they are in the vault.\n" +
          "\n" +
          "Two things to decide now:\n" +
          "\n" +
          "- Who the two or three admins are, and how account recovery works if someone forgets their master password.\n" +
          "- An offboarding step: when someone leaves, remove them from the organisation and rotate the shared passwords they could see.",
        memories: [decision("The user's company decided to use Bitwarden Teams.", "Bitwarden")],
      },
      {
        question: "Does Bitwarden support single sign-on with Google Workspace?",
        answer:
          "Not on Teams. Single sign-on needs **Bitwarden Enterprise**, at $6 per user per month [1].\n" +
          "\n" +
          "What Enterprise adds for a Google Workspace company:\n" +
          "\n" +
          "- **SSO**: staff sign in to Bitwarden with their Google account, through SAML or OpenID Connect.\n" +
          "- **Directory sync**: users and groups are created and removed automatically from your Google directory, so offboarding in Google also removes vault access.\n" +
          "- **More policies**, such as restricting personal vaults or requiring SSO.\n" +
          "- **Account recovery** by admins.\n" +
          "\n" +
          "For 40 people the difference is $80 a month: $240 against $160.\n" +
          "\n" +
          "One thing to understand about Bitwarden's SSO: by default, people sign in with Google and still type a master password to decrypt the vault. There is an option to avoid the master password, but it needs extra setup.\n" +
          "\n" +
          "On Teams you can still require two-step login and manage users by hand, which is workable at 40 people. SSO becomes worth it mainly when joiners and leavers are frequent.",
        sources: pages(["Bitwarden pricing", "https://bitwarden.com/pricing/business/"]),
        memories: [
          fact("The user's company uses Google Workspace.", "Google Workspace"),
          claim(
            "Bitwarden Enterprise costs $6 per user per month and includes single sign-on.",
            "https://bitwarden.com/pricing/business/",
            "Bitwarden",
          ),
        ],
      },
      {
        question: "We'll stay on Teams for now.",
        answer:
          "Noted: you'll stay on Teams for now. You can upgrade later without moving any vaults; the change is a billing switch, and the collections, groups and items stay exactly as they are.\n" +
          "\n" +
          "Until then, a few habits cover most of what SSO would give you:\n" +
          "\n" +
          "- Require two-step login for everyone through the organisation policy.\n" +
          "- Keep a short joiner and leaver checklist: invite on day one, remove on the last day, then rotate any shared passwords the person could see.\n" +
          "- Review the member list once a quarter against your Google Workspace users.\n" +
          "- Use groups, not individual sharing, so access follows the team and not the person.\n" +
          "\n" +
          "Signs it is time to move to Enterprise:\n" +
          "\n" +
          "- You hire or lose more than a couple of people a month.\n" +
          "- An auditor or a customer's security questionnaire asks for SSO.\n" +
          "- Admins spend real time on invitations and removals.\n" +
          "\n" +
          "At that point the extra $2 per user per month pays for itself.",
        memories: [],
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
          "Two good options for a small hosted Redis:\n" +
          "\n" +
          "- **Upstash**: a free tier, and then $0.20 per 100,000 commands [1]. You pay for what you use, it scales to zero, and it works over HTTP as well as the normal Redis protocol, which suits serverless functions.\n" +
          "- **Redis Cloud Essentials**: starts at $5/month [2]. A fixed small instance from the company behind Redis, with a predictable bill.\n" +
          "\n" +
          "How to choose:\n" +
          "\n" +
          "- If traffic is low or uneven, Upstash is cheaper, and often free.\n" +
          "- If you send a steady, high number of commands, a fixed plan costs less than paying per command.\n" +
          "- If your app runs on serverless or edge functions, Upstash's HTTP API avoids the problem of too many open connections.\n" +
          "\n" +
          "Other things to compare: the region, which should be the same as your app's; the maximum data size on the plan; and whether data is persisted, which matters little for a pure cache. If you tell me roughly how many commands a day you expect, I can work out which is cheaper.",
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
      {
        question: "It's to cache API responses in the side project, maybe 200,000 commands a day.",
        answer:
          "That is about 6 million commands a month, or about $12 on Upstash's pay-as-you-go pricing. Its fixed plan at $10/month would be cheaper, and gives you a known bill.\n" +
          "\n" +
          "The arithmetic: 200,000 a day for 30 days is 6 million commands, and at $0.20 per 100,000 that is 60 times $0.20, so $12.\n" +
          "\n" +
          "Ways to bring the number down:\n" +
          "\n" +
          "- Each cache check is one command and each write is another, so a miss costs two. A higher hit rate means fewer commands.\n" +
          "- Longer expiry times mean fewer rewrites.\n" +
          "- Fetch several keys in one round trip where you can.\n" +
          "- Cache only the responses that are slow or expensive to produce; the cheap ones are not worth a command.\n" +
          "\n" +
          "Redis Cloud Essentials at $5/month would also handle this volume, as long as the cached data fits in its memory limit. Before paying for either, it is worth asking whether a side project at this size needs a separate cache at all.",
        memories: [
          fact(
            "The side project would use Redis to cache API responses, at about 200,000 commands a day.",
            "Redis",
          ),
        ],
      },
      {
        question: "Could I skip Redis and cache in Postgres?",
        answer:
          "Yes. At this size an unlogged table with an expiry column works, and it is one service fewer to run.\n" +
          "\n" +
          "How it would look:\n" +
          "\n" +
          "- A table with a key, a JSON value and an expires-at timestamp.\n" +
          "- Make it unlogged, so writes skip the write-ahead log. That makes it fast; the trade-off is that its contents are lost after a crash, which is fine for a cache.\n" +
          "- Read with a single lookup by key that also checks the expiry.\n" +
          "- Write with an upsert.\n" +
          "- Delete expired rows on a schedule, for example every hour.\n" +
          "\n" +
          "What you give up compared with Redis:\n" +
          "\n" +
          "- Redis is faster per operation, though at 200,000 a day you won't notice.\n" +
          "- Redis has built-in expiry, counters, lists and pub/sub.\n" +
          "- Each cache read uses a database connection, so use a pooled connection from serverless functions.\n" +
          "\n" +
          "A reasonable rule: stay with Postgres until the cache traffic shows up in your database's load, or you need something Redis does and a table doesn't, such as rate limiting at high volume.",
        memories: [],
      },
      {
        question: "I'll skip Redis for now.",
        answer:
          "Noted: no Redis for now.\n" +
          "\n" +
          "To make the Postgres cache easy to live with:\n" +
          "\n" +
          "- Put the reads and writes behind two small functions, get and set, and call only those from the rest of the code. If you add Redis later, you change one file.\n" +
          "- Give every entry an expiry, even a long one, so stale data can't live forever.\n" +
          "- Add the cleanup job on day one. An unlogged table that only grows becomes a problem slowly.\n" +
          "- Log cache hits and misses for a week, to see whether the cache is doing anything useful.\n" +
          "\n" +
          "When to come back to this decision:\n" +
          "\n" +
          "- Cache queries appear among your slowest or most frequent database queries.\n" +
          "- You need rate limiting, queues or anything else Redis is good at.\n" +
          "- Traffic grows enough that database connections become tight.\n" +
          "\n" +
          "Until then you have saved about $10 a month and one more dashboard to watch.",
        memories: [
          decision("The user decided not to add Redis to the side project for now.", "Redis"),
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
          "Three quick weeknight dinners, each under 30 minutes:\n" +
          "\n" +
          "1. **Chickpea and spinach curry with rice.** Fry an onion with garlic and ginger, stir in curry paste, add tinned chickpeas and coconut milk, simmer for ten minutes and fold in the spinach at the end. Start the rice first and they finish together.\n" +
          "2. **Halloumi tacos with slaw.** Fry slices of halloumi until golden, and pile them into warm tortillas with shredded cabbage and carrot dressed in lime juice, plus avocado and a spoon of chilli sauce.\n" +
          "3. **Mushroom and miso noodle stir-fry.** Sear mushrooms on a high heat, add noodles and greens, and toss with a sauce of miso, soy sauce, a little honey and sesame oil.\n" +
          "\n" +
          "Tips for speed:\n" +
          "\n" +
          "- Tinned chickpeas and a jar of curry paste save the most time.\n" +
          "- Make double the curry; it is better the next day.\n" +
          "- Slaw keeps for two days in the fridge if you dress it just before eating.\n" +
          "\n" +
          "All three use mostly store-cupboard ingredients, so one short shop covers them.",
        memories: [preference("The user is vegetarian.")],
      },
      {
        question: "I don't like mushrooms. Swap the third one.",
        answer:
          "Then a tofu and broccoli stir-fry with the same miso sauce.\n" +
          "\n" +
          "How to make it, in about 25 minutes:\n" +
          "\n" +
          "1. Press a block of firm tofu between two plates for ten minutes, then cut it into cubes and toss them in a spoonful of cornflour.\n" +
          "2. Fry the tofu in a hot pan until it is crisp on all sides, then set it aside.\n" +
          "3. Stir-fry broccoli florets with a splash of water for three or four minutes, until bright green and just tender.\n" +
          "4. Add cooked noodles and the tofu, then the sauce: a tablespoon of miso, a tablespoon of soy sauce, a teaspoon of honey and a little sesame oil, loosened with water.\n" +
          "5. Finish with spring onions and sesame seeds.\n" +
          "\n" +
          "The cornflour is what makes the tofu crisp, so don't skip it. If you'd like more vegetables, sugar snap peas, pak choi or peppers all work, and none of them is a mushroom.",
        memories: [preference("The user does not like mushrooms.")],
      },
      {
        question: "Which has the most protein?",
        answer:
          "The halloumi tacos, at about 30 g of protein a serving. Add black beans to reach 40 g.\n" +
          "\n" +
          "Roughly how the three compare per serving:\n" +
          "\n" +
          "- **Halloumi tacos**: about 30 g, mostly from the cheese.\n" +
          "- **Tofu and broccoli stir-fry**: about 25 g, from the tofu and the noodles.\n" +
          "- **Chickpea and spinach curry**: about 18 g with rice.\n" +
          "\n" +
          "Easy ways to raise each one:\n" +
          "\n" +
          "- **Tacos**: half a tin of black beans per person, or a spoon of Greek yoghurt in place of sour cream.\n" +
          "- **Stir-fry**: use extra-firm tofu and add a handful of edamame beans.\n" +
          "- **Curry**: stir in red lentils with the coconut milk, or serve it with a side of yoghurt.\n" +
          "\n" +
          "One note: halloumi is also high in salt and saturated fat, so the tofu dish is the better everyday choice if protein is the goal. For the marathon training, a dinner with 25 to 40 g of protein after a run is a good target.",
        memories: [],
      },
      {
        question: "Give me a shopping list for the curry.",
        answer:
          "Shopping list for the chickpea and spinach curry, for four portions:\n" +
          "\n" +
          "- Two tins of chickpeas\n" +
          "- 200 g of spinach\n" +
          "- A tin of coconut milk\n" +
          "- An onion\n" +
          "- Garlic\n" +
          "- Ginger\n" +
          "- Curry paste\n" +
          "- Rice\n" +
          "\n" +
          "You may already have these, but check:\n" +
          "\n" +
          "- Oil for frying\n" +
          "- Salt\n" +
          "- A tin of chopped tomatoes, which is optional and makes the sauce go further\n" +
          "- A lime or lemon, to squeeze over at the end\n" +
          "\n" +
          "Notes on the choices:\n" +
          "\n" +
          "- Any curry paste works. A medium one such as korma or tikka masala is mild; madras is hotter. Check the label, as a few contain fish sauce or shrimp.\n" +
          "- Frozen spinach is fine and cheaper: use about half the weight.\n" +
          "- Basmati rice cooks in about twelve minutes, the same time as the curry.\n" +
          "\n" +
          "Leftovers keep for three days in the fridge and freeze well without the rice.",
        memories: [],
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
          "Two that record and summarise calls and work with Zoom:\n" +
          "\n" +
          "- **Fathom**: free for individuals, and $19 per user per month for teams [1]. It joins the call as a participant, records, transcribes, and sends a summary within a minute of the call ending.\n" +
          "- **Fireflies Pro**: $10 per seat per month [2]. Similar recording and transcription, with strong search across all past calls and topic tracking.\n" +
          "\n" +
          "Both join Zoom calls, and both also work with Google Meet and Microsoft Teams.\n" +
          "\n" +
          "How they differ:\n" +
          "\n" +
          "- Fathom's summaries are cleaner and need less editing, and you can highlight a moment during the call with one click.\n" +
          "- Fireflies is cheaper and better as a searchable archive across the whole team's calls.\n" +
          "\n" +
          "Things to check for a sales team:\n" +
          "\n" +
          "- Whether summaries sync to your CRM automatically.\n" +
          "- Who can see whose recordings.\n" +
          "- How consent is handled, since recording laws vary by state and country.\n" +
          "\n" +
          "If you tell me which CRM you use and how many reps would use it, I can narrow this down.",
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
      {
        question: "Do they push their notes into HubSpot?",
        answer:
          "Both do. Each has a HubSpot integration that logs the summary on the contact.\n" +
          "\n" +
          "What gets written to HubSpot:\n" +
          "\n" +
          "- **Fathom**: after each call, it adds the summary and a link to the recording to the matching contact, and can also attach it to the deal and company. The team plan lets you sync action items as tasks.\n" +
          "- **Fireflies**: it logs the meeting notes and transcript link under the contact, matched by the attendee's email address, and can create tasks from action items.\n" +
          "\n" +
          "Things to set up so it works reliably:\n" +
          "\n" +
          "- The contact must exist in HubSpot with the same email address the attendee used for the calendar invite. Otherwise the note has nowhere to go, or a duplicate contact is created.\n" +
          "- Decide whether notes are logged for every call or only external ones.\n" +
          "- Check which HubSpot fields each tool can fill. Custom properties usually need a higher plan or a workflow.\n" +
          "\n" +
          "Run one test call each and look at how the note reads on the contact record; that is what your reps and managers will actually see.",
        memories: [],
      },
      {
        question: "Which is better at action items?",
        answer:
          "Fathom. Its summaries separate action items by owner; Fireflies is stronger at searching across old calls.\n" +
          "\n" +
          "In more detail:\n" +
          "\n" +
          "- **Fathom** lists the action items at the end of the summary, each with the person who took it on and a link to the moment in the recording where it was said. You can choose a summary template for a sales call, with sections for next steps, objections and pricing.\n" +
          "- **Fireflies** also extracts action items, but in a single list that more often needs tidying. Its strength is the archive: you can search every call for a competitor's name or a pricing objection, and track how often topics come up.\n" +
          "\n" +
          "Which matters more depends on the job:\n" +
          "\n" +
          "- For reps who need a clean follow-up email after each call, Fathom saves more time.\n" +
          "- For a manager who wants to coach and to see patterns across the team, Fireflies gives more.\n" +
          "\n" +
          "Neither is perfect at catching commitments that were only implied, so reps should still read the list before sending it to a customer.",
        memories: [],
      },
      {
        question: "We'll trial Fathom with the account executives.",
        answer:
          "Noted: a Fathom trial with the account executives.\n" +
          "\n" +
          "Tell customers at the start of each call that it is being recorded. Some states and countries require everyone's consent, and saying it plainly also builds trust. A simple line works: \"I'm recording this so I can focus on our conversation instead of taking notes. Is that all right?\"\n" +
          "\n" +
          "To make the trial useful:\n" +
          "\n" +
          "1. Connect it to Zoom and to each rep's calendar, set to join external meetings only.\n" +
          "2. Turn on the HubSpot sync and test it on one call.\n" +
          "3. Choose one summary template for everyone, so notes are comparable.\n" +
          "4. Run it for two to three weeks across real calls.\n" +
          "\n" +
          "What to measure at the end:\n" +
          "\n" +
          "- Minutes saved per call on notes and follow-up emails.\n" +
          "- Whether the notes in HubSpot are more complete than before.\n" +
          "- How many customers objected to recording.\n" +
          "- Whether the action items were accurate enough to send without rewriting.\n" +
          "\n" +
          "If a customer declines, the rep should be able to remove the notetaker in one click, so show everyone where that button is.",
        memories: [
          decision("The user decided to trial Fathom for recording sales calls.", "Fathom"),
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
          "Both are good; they suit different priorities.\n" +
          "\n" +
          "- **Clerk Pro** is $25/month after a free tier of 10,000 users [1]. It is a hosted service: you get ready-made sign-in and sign-up screens, user profiles, session management, social logins and an admin dashboard, and most of it works within an hour.\n" +
          "- **Auth.js** is free and open source, but you run it yourself [2]. It is a library in your own app: users and sessions live in your database, and you build the screens.\n" +
          "\n" +
          "How to choose:\n" +
          "\n" +
          "- Pick Clerk if you want to ship quickly and not think about authentication. The free tier is generous, so a side project may never pay.\n" +
          "- Pick Auth.js if you want your user data in your own Postgres, no outside dependency, and no cost at any scale.\n" +
          "\n" +
          "The trade-offs:\n" +
          "\n" +
          "- With Clerk, your users live in someone else's system, and moving away later takes work.\n" +
          "- With Auth.js, you own the upkeep: upgrades, email sending for magic links, and security settings.\n" +
          "\n" +
          "For a Next.js project on Postgres, either integrates cleanly.",
        sources: pages(
          ["Clerk pricing", "https://clerk.com/pricing"],
          ["Auth.js", "https://authjs.dev/"],
        ),
        memories: [claim("Clerk Pro costs $25 per month.", "https://clerk.com/pricing", "Clerk")],
      },
      {
        question: "I'll use Auth.js, since it's free.",
        answer:
          "Noted: Auth.js. Use its database sessions with your Postgres.\n" +
          "\n" +
          "Why database sessions and not the default signed tokens:\n" +
          "\n" +
          "- You can sign a user out everywhere by deleting a row.\n" +
          "- You can see active sessions, and nothing sensitive sits in the cookie.\n" +
          "- Email magic links need a database anyway, to store the one-time tokens.\n" +
          "\n" +
          "Setting it up:\n" +
          "\n" +
          "1. Install Auth.js and the adapter for your database layer; there are adapters for Prisma, Drizzle and plain Postgres.\n" +
          "2. Add the tables it needs: users, accounts, sessions and verification tokens. The adapter's documentation has the schema.\n" +
          "3. Set the AUTH_SECRET environment variable to a long random value, with a different one in each environment.\n" +
          "4. Add the providers you want, then protect your routes with the middleware.\n" +
          "\n" +
          "One cost to be aware of: each request that checks the session makes a database query. On serverless functions, use a pooled connection so sign-in traffic doesn't use up your connections.",
        memories: [
          decision("The user decided to use Auth.js for the side project's sign-in.", "Auth.js"),
        ],
      },
      {
        question: "Which sign-in methods should I offer?",
        answer:
          "Google and email magic links. Together they cover nearly everyone, and you never store a password.\n" +
          "\n" +
          "Why these two:\n" +
          "\n" +
          "- **Google**: most people have an account, sign-in is one click, and the email address arrives already verified.\n" +
          "- **Magic links**: they work for anyone with an email address, including people who avoid social logins or use a work account you haven't set up.\n" +
          "\n" +
          "What you skip by not offering passwords:\n" +
          "\n" +
          "- No password hashing, reset flow or breach risk.\n" +
          '- No "forgot password" support requests.\n' +
          "\n" +
          "Others worth considering later:\n" +
          "\n" +
          "- **GitHub**, if your users are developers.\n" +
          "- **Apple**, which you would need if you ever ship an iOS app with social sign-in.\n" +
          "- **Passkeys**, which are quick and phishing-resistant but still unfamiliar to many users.\n" +
          "\n" +
          "Two details to get right: if someone signs in with Google and later with a magic link on the same address, link them to one account; and keep the sign-in screen to two buttons, since more choices lower the completion rate.",
        memories: [],
      },
      {
        question: "Can the magic links go out through Resend?",
        answer:
          "Yes, Auth.js has a Resend provider.\n" +
          "\n" +
          "How it fits together:\n" +
          "\n" +
          "- Add the Resend provider to your Auth.js configuration, with your Resend API key and a from address on your verified domain.\n" +
          "- When someone enters their email, Auth.js creates a one-time token, stores it in your database through the adapter, and asks Resend to send the link.\n" +
          "- Clicking the link verifies the token and starts the session.\n" +
          "\n" +
          "Things to set:\n" +
          "\n" +
          "- **From address**: use the same verified domain you set up for sign-up emails, for example login@mail.yourdomain.com.\n" +
          "- **The email itself**: the default is plain. You can pass your own function to send a custom message, written as a React component if you like.\n" +
          "- **Expiry**: links last 24 hours by default; shortening that to 10 or 15 minutes is safer.\n" +
          "\n" +
          'One caution: some corporate mail scanners open links before the user does, which can use up a one-time link. If your users are mostly on work email, send them to a page with a "Sign in" button instead of signing in on the first visit to the link.',
        memories: [],
      },
      {
        question: "OK, Google plus magic links.",
        answer:
          "Noted: Google plus magic links.\n" +
          "\n" +
          "A short checklist to finish the job:\n" +
          "\n" +
          '- **Google**: create OAuth credentials in the Google Cloud console, add the redirect addresses for local, preview and production, and publish the consent screen so users don\'t see a "testing" warning.\n' +
          "- **Magic links**: confirm the Resend domain is verified, and send yourself a link in Gmail and Outlook to see where it lands.\n" +
          "- **Account linking**: make sure the same email address through either method ends up as one user.\n" +
          "- **Sign-in page**: two buttons, a short line about what the email will look like, and a clear error when a link has expired.\n" +
          "- **Rate limiting**: cap how many links one address or IP can request per hour, so nobody can use your form to spam people.\n" +
          "\n" +
          "Then test the whole path on a phone, since many people open the email on a different device from the one they started on. With database sessions, that works as long as they finish signing in where they opened the link.",
        memories: [
          decision(
            "The user decided to offer Google sign-in and email magic links in the side project.",
            "Auth.js",
          ),
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
          "Two good picks under $1,500:\n" +
          "\n" +
          "- **MacBook Air 13-inch (M4, 16 GB)**: from $999, with the best battery life in its class [1]. It is silent, since it has no fan, and fast enough for web, mobile and most backend work.\n" +
          "- **Framework Laptop 13**: from $1,049, and repairable, if you want Linux [2]. You can replace the memory, storage, battery and ports yourself, and upgrade the mainboard in a few years.\n" +
          "\n" +
          "Get at least 16 GB of memory either way. An editor, a browser with documentation open, a database and a couple of containers will use most of it.\n" +
          "\n" +
          "How to choose:\n" +
          "\n" +
          "- Pick the MacBook Air if you build for iOS or macOS, want all-day battery, or simply want something that works with no tinkering.\n" +
          "- Pick the Framework if you want to run Linux natively, care about repairing and upgrading, or need more than two ports.\n" +
          "\n" +
          "Things that would change the advice: heavy Docker use or local machine-learning models favour more memory, and a lot of video or game work favours a machine with a fan and a stronger graphics chip. Tell me what you mostly build and I can be more specific.",
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
          "Good choice for programming. It handles an editor, a browser, a local database and a dev server without slowing down, and you can work a full day away from a charger.\n" +
          "\n" +
          "If you run Docker or several VMs, 24 GB of memory is worth the upgrade. Memory can't be added later on a MacBook, so this is the one decision to get right at purchase.\n" +
          "\n" +
          "A simple guide:\n" +
          "\n" +
          "- **16 GB**: web and app development, scripting, a few containers.\n" +
          "- **24 GB**: several containers at once, Android emulators, or local language models.\n" +
          "\n" +
          "Other choices at checkout:\n" +
          "\n" +
          "- **Screen size**: the 13-inch is lighter; the 15-inch gives more room for side-by-side windows. Many developers use an external monitor at a desk anyway.\n" +
          "- **Charger**: the higher-wattage one charges faster and costs little.\n" +
          "- **AppleCare**: worth considering if the laptop travels a lot.\n" +
          "\n" +
          "If you're a student or a teacher, check Apple's education price, and look at Apple's refurbished store, where the same model is often about 15% cheaper with the same warranty.",
        memories: [decision("The user decided to buy the MacBook Air 13-inch.", "MacBook Air")],
      },
      {
        question: "Is 256 GB of storage enough?",
        answer:
          "For code alone, yes. With Docker images and Xcode, 512 GB is safer; that model is $1,199 [1].\n" +
          "\n" +
          "Where the space goes on a developer's laptop:\n" +
          "\n" +
          "- macOS and the built-in apps: about 30 to 40 GB.\n" +
          "- Xcode with a couple of simulators: 40 GB or more.\n" +
          "- Docker images and volumes: 20 to 60 GB, and they grow quietly.\n" +
          "- Node modules, build caches and package caches across projects: 10 to 30 GB.\n" +
          "- Your own files, photos and anything else.\n" +
          "\n" +
          "On 256 GB you can be near full within a year if you use Xcode or Docker, and a nearly full disk slows the machine down.\n" +
          "\n" +
          "Like memory, storage can't be upgraded later. If the $200 matters, there is a workable middle path: buy 256 GB and keep large files on a fast external SSD, which costs well under $100 for 1 TB. But for a laptop you'll keep for four or five years, 512 GB built in is the less annoying choice. Given the options, I would put money into memory first and storage second.",
        sources: pages(["MacBook Air - Apple", "https://www.apple.com/macbook-air/"]),
        memories: [
          claim(
            "The MacBook Air 13-inch with 512 GB of storage costs $1,199.",
            "https://www.apple.com/macbook-air/",
            "MacBook Air",
          ),
        ],
      },
      {
        question: "Can I trade in my 2019 MacBook Pro?",
        answer:
          "Yes. Apple usually gives $200 to $350 for one, depending on its condition.\n" +
          "\n" +
          "How it works:\n" +
          "\n" +
          "- Enter the serial number on Apple's trade-in page to get an estimate, then choose trade-in at checkout or bring the laptop to a store.\n" +
          "- Online, the value comes back as a refund after they inspect it; in a store, it comes off the price on the spot.\n" +
          "- If it doesn't power on or the screen is damaged, the value drops sharply, sometimes to recycling only.\n" +
          "\n" +
          "Before you decide, compare with selling it yourself:\n" +
          "\n" +
          "- A 2019 MacBook Pro in good condition often sells privately for more than Apple offers, sometimes by $100 to $200, in exchange for the effort of listing and meeting a buyer.\n" +
          "- Resale sites that buy directly sit in between.\n" +
          "\n" +
          "Before handing it over, whichever route you take: back it up, sign out of iCloud and Find My, and erase it. The 16-inch 2019 model is worth noticeably more than the 13-inch, so check which one you have before accepting a quote.",
        memories: [fact("The user currently has a 2019 MacBook Pro.", "MacBook Pro")],
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
          "Two good options:\n" +
          "\n" +
          "- **Cloudflare Registrar** sells at cost: $10.44 a year for a .com [1]. It adds no markup, the renewal price is the same as the first year, and WHOIS privacy and DNS are included.\n" +
          "- **Namecheap** is cheaper in year one but renews at $16.98 [2]. It has a friendlier interface and sells nearly every domain ending.\n" +
          "\n" +
          "Over five years that is about $52 at Cloudflare against roughly $75 or more at Namecheap, so Cloudflare wins for a domain you plan to keep.\n" +
          "\n" +
          "Things to know about Cloudflare:\n" +
          "\n" +
          "- You have to use Cloudflare's DNS for a domain registered there. For most projects that is a benefit, since its DNS is fast and free.\n" +
          "- There are no upsells, no email hosting and less hand-holding.\n" +
          "\n" +
          "For a side project you plan to keep, Cloudflare is the one I'd register with. Whichever you choose, turn on auto-renew and two-step login on the account: losing a domain because a card expired is a common and painful mistake.",
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
      {
        question: "Does Cloudflare include WHOIS privacy?",
        answer:
          "Yes, free on every domain.\n" +
          "\n" +
          "What that means in practice:\n" +
          "\n" +
          "- Your name, address, phone number and email are replaced with redacted or placeholder details in the public WHOIS record.\n" +
          "- It is switched on by default; there is nothing to buy or enable.\n" +
          "- Messages to the domain's contact go through a forwarding form, so genuine enquiries can still reach you without exposing your address.\n" +
          "\n" +
          "A few limits to know:\n" +
          "\n" +
          "- Some country-code endings, such as certain European ones, have their own rules and may show more or less information, whatever the registrar does.\n" +
          "- The registrar itself still holds your real details, and must keep them accurate; an invalid contact email can get a domain suspended.\n" +
          "- Privacy does not hide who hosts the site or which DNS provider you use.\n" +
          "\n" +
          "For a .com, you are fully covered. Keep the email address on your Cloudflare account current, since renewal and transfer notices go there.",
        memories: [],
      },
      {
        question: "And what does a .dev domain cost there?",
        answer:
          "$12.18 a year [1].\n" +
          "\n" +
          "That is Cloudflare's at-cost price for a .dev, the same on registration and on renewal, with WHOIS privacy included.\n" +
          "\n" +
          "Things that are particular to .dev:\n" +
          "\n" +
          "- It is on the browsers' HTTPS preload list, so a .dev site only loads over HTTPS. Vercel issues the certificate automatically, so this costs you nothing, but a plain HTTP test server on that domain won't work.\n" +
          "- It signals a developer or technical product, which suits a tool for programmers and can look odd for a general consumer product.\n" +
          "- Good short names are easier to find than in .com.\n" +
          "\n" +
          "When it is worth having both:\n" +
          "\n" +
          "- You want the .com as the main address and the .dev for documentation or a developer portal.\n" +
          "- You want to stop someone else registering the matching name.\n" +
          "\n" +
          "If the .com is available and the audience is general, the .com alone is usually enough; a second domain is another renewal to remember for little benefit.",
        sources: pages(["Cloudflare Registrar", "https://www.cloudflare.com/products/registrar/"]),
        memories: [
          claim(
            "Cloudflare Registrar charges $12.18 a year for a .dev domain.",
            "https://www.cloudflare.com/products/registrar/",
            "Cloudflare Registrar",
          ),
        ],
      },
      {
        question: "I'll take only the .com.",
        answer:
          "Noted: only the .com.\n" +
          "\n" +
          "After you register it, a few steps finish the setup:\n" +
          "\n" +
          "1. **Auto-renew**: switch it on, and check the card on the account has a distant expiry date.\n" +
          "2. **Two-step login** on your Cloudflare account. Whoever controls the account controls the domain.\n" +
          '3. **Point it at Vercel**: add the domain in the Vercel project, then create the records Vercel shows you in Cloudflare\'s DNS. Set those records to "DNS only" rather than proxied, at least to begin with, so Vercel can issue its certificate without trouble.\n' +
          "4. **Email records**: add the SPF, DKIM and DMARC records for Resend on the mail subdomain.\n" +
          "5. **Redirect** the www version to the bare domain, or the other way round, and keep it consistent.\n" +
          "\n" +
          "If you want an address such as hello@yourdomain.com, Cloudflare's free email routing can forward it to your personal inbox without any mail hosting.",
        memories: [],
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
          "Three that are free or close to it for a team of five:\n" +
          "\n" +
          "- **HubSpot's free CRM** covers up to 2 users [1]. It has contacts, deals, a pipeline and email tracking at no cost, but five people would not fit on the free plan.\n" +
          "- **Zoho Bigin Express** is $7 per user per month [2]. A simple, pipeline-first CRM made for small businesses, with email, telephony and a mobile app.\n" +
          "- **Capsule Starter** is $18 per user per month [3]. Clean and easy, with good contact management and project boards for work after the deal is won.\n" +
          "\n" +
          "For five people that is $35 a month for Bigin and $90 a month for Capsule.\n" +
          "\n" +
          "What an agency usually needs:\n" +
          "\n" +
          "- A pipeline for proposals: sent, in discussion, won, lost.\n" +
          "- Reminders to follow up.\n" +
          "- Email history attached to each client.\n" +
          "- Little or no setup.\n" +
          "\n" +
          "All three do those. The differences are price and how much else comes with it. If you tell me how the agency works today, for example out of a spreadsheet or an inbox, I can say which would be the smallest change for them.",
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
      {
        question: "They mostly need to track proposals and follow-ups.",
        answer:
          "Then Bigin fits best. It is built around simple pipelines, and HubSpot's free plan would stop at 2 users.\n" +
          "\n" +
          "How it would work for proposals and follow-ups:\n" +
          "\n" +
          "- **Pipeline**: create stages such as Enquiry, Proposal sent, Negotiating, Won and Lost, and drag each deal along as it moves.\n" +
          "- **Follow-ups**: add a task with a due date to any deal, and Bigin reminds the owner. You can also set a rule that creates a follow-up task automatically, for example three days after a proposal is sent.\n" +
          "- **Email**: connect each person's mailbox so messages with a client appear on the deal.\n" +
          "- **Files**: attach the proposal PDF to the deal, so the latest version is always in one place.\n" +
          "\n" +
          "Why not the others here:\n" +
          "\n" +
          "- HubSpot's free tier would force three of the five onto paid seats, which costs more than Bigin for the whole team.\n" +
          "- Capsule does all this too, at about two and a half times the price.\n" +
          "\n" +
          "An agency can have this running in an afternoon, which matters more than any extra feature.",
        memories: [],
      },
      {
        question: "Does Bigin have a mobile app?",
        answer:
          "Yes, for iOS and Android.\n" +
          "\n" +
          "What the app does:\n" +
          "\n" +
          "- View and update deals and move them between pipeline stages.\n" +
          "- Add notes after a client meeting, by typing or dictating.\n" +
          "- See today's tasks and follow-ups, with notifications.\n" +
          "- Call or email a contact from the record, and log the call afterwards.\n" +
          "- Scan a business card to create a contact.\n" +
          "- Work offline for basic viewing and edits, which sync when the phone is back online.\n" +
          "\n" +
          "It is included in the Express plan, with no extra charge per device.\n" +
          "\n" +
          "For a design agency whose people are often at client offices, the two features that get used most are the follow-up reminders and adding a quick note straight after a meeting. Setting up the pipeline and automation is still easier on a laptop, so do the first configuration there and use the phone for day-to-day updates.",
        memories: [],
      },
      {
        question: "I'll tell her to try Bigin.",
        answer:
          "Good. It has a 15-day trial, with no card needed to start.\n" +
          "\n" +
          "A few suggestions you can pass on to her so the trial is a fair test:\n" +
          "\n" +
          "1. Set up one pipeline with her real stages for proposals, not the default ones.\n" +
          "2. Import current clients and open proposals from a spreadsheet as a CSV file. Twenty real deals are enough.\n" +
          "3. Connect the team's email, so client conversations appear on the deals.\n" +
          "4. Add a follow-up task to every open proposal.\n" +
          "5. Have all five people use it for two weeks, including on their phones.\n" +
          "\n" +
          "How she'll know it is working:\n" +
          "\n" +
          '- Nobody asks "did anyone reply to that client?" in the group chat.\n' +
          "- No proposal sits for more than a week without a next step.\n" +
          "- She can see the total value of open proposals at a glance.\n" +
          "\n" +
          "If the team finds it too much, a shared board in a tool they already use may be enough. If they outgrow it, Zoho CRM is the direct upgrade and the data moves across.",
        memories: [
          decision("The user recommended Zoho Bigin to their friend's design agency.", "Zoho"),
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
          "Plan for 16 to 18 weeks, with four runs a week: one long run, one tempo run and two easy runs. Build the long run up to 32 km three weeks before race day.\n" +
          "\n" +
          "Counting back from April, that means starting in early to mid December.\n" +
          "\n" +
          "How the weeks are shaped:\n" +
          "\n" +
          "- **Weeks 1 to 6, base**: build weekly distance gradually, with the long run growing from about 12 km to 20 km.\n" +
          "- **Weeks 7 to 13, build**: the long run climbs towards 28 to 32 km, and the tempo run gets a little longer.\n" +
          "- **Weeks 14 to 15, peak**: your biggest weeks, including the 32 km run.\n" +
          "- **Last 2 to 3 weeks, taper**: cut the distance by a third, then by half, and keep a little speed.\n" +
          "\n" +
          "Rules that prevent most injuries:\n" +
          "\n" +
          "- Raise weekly distance by no more than about 10% a week.\n" +
          "- Every fourth week, drop back by 20 to 30% to recover.\n" +
          "- Keep the easy runs truly easy: you should be able to hold a conversation.\n" +
          "\n" +
          "Add one or two short strength sessions a week for hips, glutes and calves. They do more to keep you running than extra kilometres.",
        memories: [
          fact("The user's marathon is in April."),
          fact(
            "A 16 to 18 week plan with four runs a week was recommended for the user's marathon.",
          ),
        ],
      },
      {
        question: "I can run 10 km comfortably now. Is April realistic?",
        answer:
          "Yes. From a comfortable 10 km, 18 weeks is enough to finish a marathon without injury.\n" +
          "\n" +
          "Why it is realistic:\n" +
          "\n" +
          "- Running 10 km comfortably means you already have the base that most beginner plans assume in week one.\n" +
          "- The plan adds distance slowly. The long run grows by about 2 km a week with regular easier weeks, which is well within what the body adapts to.\n" +
          "- For a first marathon the goal is to finish feeling strong, not to hit a time, and that takes consistency more than talent.\n" +
          "\n" +
          "What makes the difference between finishing well and struggling:\n" +
          "\n" +
          "- Missing a run here and there is fine. Missing two weeks is not, so protect the long runs.\n" +
          "- Don't make up missed runs by cramming; just carry on with the plan.\n" +
          "- Take any sharp or one-sided pain seriously and rest for a few days. A few days off costs nothing; an injury costs weeks.\n" +
          "- Practise eating and drinking on the long runs from about week six.\n" +
          "\n" +
          "If you can fit in a half marathon race around week 10 or 11, it is a good rehearsal and a confidence boost.",
        memories: [fact("The user can currently run 10 km comfortably.")],
      },
      {
        question: "Which days should the runs be on? I can't run on Wednesdays.",
        answer:
          "Tuesday easy, Thursday tempo, Saturday easy and Sunday long.\n" +
          "\n" +
          "Why this layout works around a Wednesday off:\n" +
          "\n" +
          "- **Tuesday, easy**: a relaxed start to the week, 6 to 8 km.\n" +
          "- **Wednesday**: rest, which falls neatly before the hardest midweek run.\n" +
          "- **Thursday, tempo**: the quality session, on fresh legs.\n" +
          "- **Friday**: rest or a short strength session.\n" +
          "- **Saturday, easy**: short and gentle, 5 to 6 km, to loosen up.\n" +
          "- **Sunday, long**: the key run of the week.\n" +
          "- **Monday**: rest, to recover from Sunday.\n" +
          "\n" +
          "Some runners prefer not to run the day before a long run. If Saturday's run leaves your legs heavy on Sunday, move it to Friday and rest on Saturday.\n" +
          "\n" +
          "Other things to fit in:\n" +
          "\n" +
          "- Put strength work on Monday or Friday, not the day before the tempo run.\n" +
          "- If you miss Thursday, don't squeeze it in on Saturday. Just run easy and keep Sunday as planned.\n" +
          "- Wednesday could be a walk, a swim or yoga if you want to move without running.",
        memories: [preference("The user cannot run on Wednesdays.")],
      },
      {
        question: "What pace for the long runs?",
        answer:
          "60 to 90 seconds per km slower than your goal marathon pace.\n" +
          "\n" +
          "That feels almost too slow at first, and that is the point. The long run trains your body to keep going for hours, to burn fat as fuel and to toughen muscles and tendons. Running it fast adds injury risk and tiredness without adding much fitness.\n" +
          "\n" +
          "How to judge the pace without a watch:\n" +
          "\n" +
          "- You can speak in full sentences.\n" +
          "- You finish feeling you could have done another few kilometres.\n" +
          "- Your breathing never becomes laboured.\n" +
          "\n" +
          "Later in the plan, you can add a little marathon-pace running to some long runs:\n" +
          "\n" +
          "- From about week 10, finish every second long run with the last 5 to 8 km at goal pace.\n" +
          "- Keep the 32 km run entirely easy.\n" +
          "\n" +
          "Until you have a goal time, use effort as the guide. A recent 10 km time gives a rough marathon estimate: multiply it by about 4.7 for a first marathon. On hot or hilly days, slow down further and go by effort, not the number on the watch.",
        memories: [],
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
          "All three have a cheap way in:\n" +
          "\n" +
          "- **Neon**: a free plan with 0.5 GB of storage; the paid Launch plan starts at $19/month [1].\n" +
          "- **Supabase**: a free plan with a 500 MB database; Pro is $25/month per organization and includes $10 of compute credits [2].\n" +
          "- **Railway**: the Hobby plan is $5/month, which includes $5 of usage [3].\n" +
          "\n" +
          "For a small project, start on Neon's or Supabase's free plan. Of the paid plans, Railway's is the cheapest.\n" +
          "\n" +
          "How they differ beyond price:\n" +
          "\n" +
          "- **Neon** is Postgres only, and serverless: compute scales down to zero when idle, and you can branch a database like a git branch, which is handy for preview deployments.\n" +
          "- **Supabase** is a whole backend around Postgres: authentication, file storage, auto-generated APIs and realtime subscriptions. Good value if you would use those; more than you need if you only want a database.\n" +
          "- **Railway** is a general hosting platform. Postgres runs as an ordinary container next to your app, billed by the resources it uses.\n" +
          "\n" +
          "For a database on its own behind a Next.js app, Neon's free plan is the simplest start. Check each provider's limits on connections and on inactivity before you commit.",
        sources: pages(
          ["Neon pricing", NEON],
          ["Supabase pricing", SUPABASE],
          ["Railway pricing", RAILWAY],
        ),
        memories: [
          fact("The user needs managed Postgres for a small side project.", "Postgres"),
          about(
            "Neon Launch plan price",
            claim(
              "Neon's free plan includes 0.5 GB of storage, and its Launch plan starts at $19 per month.",
              NEON,
              "Neon",
            ),
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
      {
        question: "Which of them scale to zero when nothing is using the database?",
        answer:
          "Neon does, and wakes in under a second. Supabase pauses free projects after a week without use. Railway bills for whatever runs.\n" +
          "\n" +
          "In more detail:\n" +
          "\n" +
          "- **Neon**: after about five minutes with no connections, compute suspends and you stop paying for it. The next query wakes it, typically in a few hundred milliseconds. On paid plans you can change or turn off the suspend delay.\n" +
          "- **Supabase**: paid projects run all the time. Free projects are paused after about a week of inactivity, and you have to restore them by hand from the dashboard, which takes a few minutes. That is a pause, not scale to zero.\n" +
          "- **Railway**: the database is a container that runs continuously, so it uses memory and CPU even when idle. A small Postgres typically stays within the $5 of included usage.\n" +
          "\n" +
          "What it means for a side project with occasional traffic: Neon costs the least when idle, at the price of a short delay on the first request after a quiet spell. If that first slow request bothers you, a scheduled ping keeps it awake, though that also uses compute hours.",
        memories: [],
      },
      {
        question: "I want to keep it under $10 a month.",
        answer:
          "Then use a free plan, or Railway's Hobby plan.\n" +
          "\n" +
          "How each option fits under $10:\n" +
          "\n" +
          "- **Neon free**: $0. 0.5 GB of storage and scale to zero. The best fit if the data stays small.\n" +
          "- **Supabase free**: $0. A 500 MB database, but the project pauses after a week without use, which is awkward for something you want always available.\n" +
          "- **Railway Hobby**: $5 a month including $5 of usage. A small always-on Postgres usually stays within that, so the bill is typically $5.\n" +
          "\n" +
          "What does not fit: Neon Launch at $19 and Supabase Pro at $25 are both over your limit.\n" +
          "\n" +
          "So the practical choice is:\n" +
          "\n" +
          "- Neon's free plan while the database is under 0.5 GB and you can accept the short wake-up delay.\n" +
          "- Railway Hobby if you want it always on, or expect to pass 0.5 GB soon.\n" +
          "\n" +
          "On Railway, set a usage limit in the dashboard so a runaway query or a traffic spike can't take the bill past the $10 you have in mind.",
        memories: [
          preference("The user wants the side project's database to cost under $10 a month."),
        ],
      },
      {
        question: "Do all three have a region in the eastern US?",
        answer:
          "Yes, all three.\n" +
          "\n" +
          "- **Neon**: US East in Virginia and in Ohio, on AWS.\n" +
          "- **Supabase**: US East in North Virginia, also on AWS.\n" +
          "- **Railway**: a US East region in Virginia.\n" +
          "\n" +
          "What matters more than the provider is matching the region to where your app runs. Vercel's default function region is in Washington, D.C., which is a few milliseconds from all of these. If the database is in Virginia and the functions are in, say, Europe, every query crosses the Atlantic and each page gets noticeably slower.\n" +
          "\n" +
          "So:\n" +
          "\n" +
          "1. Choose the database region first.\n" +
          "2. Set the Vercel function region to the nearest one.\n" +
          "3. If your users are spread around the world, keep the database and functions together in one place and let the CDN handle the static content.\n" +
          "\n" +
          "The region is chosen when you create the database and is not simple to change afterwards; moving means a dump and restore. It is worth getting right on day one.",
        memories: [],
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
          "**Sales Navigator Core** is $99.99 per month, or $79.99 per month billed annually [1].\n" +
          "\n" +
          "That is per seat, and Core is the entry plan, meant for individual reps.\n" +
          "\n" +
          "What Core includes:\n" +
          "\n" +
          "- Advanced search for leads and accounts, with many more filters than regular LinkedIn.\n" +
          "- Lead and account lists, with alerts when someone changes job or a company posts news.\n" +
          "- 50 InMail messages a month to people you aren't connected with.\n" +
          "- Recommendations for similar leads.\n" +
          "\n" +
          "Things to know before buying:\n" +
          "\n" +
          "- Annual billing saves about 20%, but you pay the year up front: about $960 per seat.\n" +
          "- LinkedIn often gives a free month's trial to new users.\n" +
          "- Prices vary by country and LinkedIn changes them from time to time, so confirm on the checkout page for your region.\n" +
          "\n" +
          "If a team is buying, the next plan up adds shared lists and admin controls. For a few individual reps doing their own prospecting, Core is usually enough.",
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
      {
        question: "What does the next plan up cost?",
        answer:
          "**Sales Navigator Advanced** is $179.99 per month, or $149.99 per month billed annually [1].\n" +
          "\n" +
          "What it adds to Core:\n" +
          "\n" +
          "- **TeamLink**: see which colleagues are connected to a prospect, so a rep can ask for a warm introduction.\n" +
          "- **Smart Links**: share a deck or document and see who opened it and for how long.\n" +
          "- **Buyer intent signals** on accounts.\n" +
          "- **Shared lists and notes** across the team.\n" +
          "- **Admin tools**: central billing, seat management and usage reports.\n" +
          "\n" +
          "Over a year, the gap is $840 per seat on annual billing: about $1,800 against $960.\n" +
          "\n" +
          "When Advanced is worth it:\n" +
          "\n" +
          "- Several reps work the same accounts and would benefit from each other's networks.\n" +
          "- A manager wants to see who is actually using the tool.\n" +
          "- You send a lot of proposals and want to know who reads them.\n" +
          "\n" +
          "Above this sits Advanced Plus, which is priced by quote and adds CRM integration. For a team where each rep prospects alone, Core gives most of the value at about half the price.",
        sources: pages([
          "Sales Navigator pricing",
          "https://business.linkedin.com/sales-solutions/compare-plans",
        ]),
        memories: [
          claim(
            "LinkedIn Sales Navigator Advanced costs $179.99 per month, or $149.99 per month billed annually.",
            "https://business.linkedin.com/sales-solutions/compare-plans",
            "LinkedIn Sales Navigator",
          ),
        ],
      },
      {
        question: "We'd give it only to the 8 SDRs. What is that a year on Core?",
        answer:
          "8 seats at $79.99 a month, billed annually, is about $7,679 a year.\n" +
          "\n" +
          "The arithmetic: $79.99 times 12 is $959.88 per seat per year, times 8 seats.\n" +
          "\n" +
          "For comparison:\n" +
          "\n" +
          "- **Core, billed monthly**: 8 seats at $99.99 is about $9,599 over a year, so annual billing saves roughly $1,920.\n" +
          "- **Advanced, billed annually**: 8 seats at $149.99 is about $14,399 a year.\n" +
          "\n" +
          "Giving it only to the SDRs makes sense, since prospecting is their whole job and they will use the search and the InMail allowance every day. Account executives working inbound or existing accounts get much less from it.\n" +
          "\n" +
          "Things to check before you commit to a year:\n" +
          "\n" +
          "- Start with a monthly plan or the free trial for a few weeks, then switch to annual once you see it being used.\n" +
          "- Ask whether seats can be reassigned when an SDR leaves; on team plans they can.\n" +
          "- With 8 seats, ask LinkedIn's sales team for a quote, since there is sometimes a discount at that size.\n" +
          "\n" +
          "Taxes are added where they apply.",
        memories: [],
      },
      {
        question: "Does Core sync with a CRM?",
        answer:
          "No. CRM sync needs Advanced Plus, which is sold through LinkedIn's sales team.\n" +
          "\n" +
          "What each plan offers for CRM work:\n" +
          "\n" +
          "- **Core**: nothing built in. Reps copy details into the CRM by hand.\n" +
          "- **Advanced**: still no sync, though you can upload a list of accounts as a CSV file to match against LinkedIn.\n" +
          "- **Advanced Plus**: two-way integration with Salesforce, HubSpot and Microsoft Dynamics. Leads and accounts can be saved to the CRM from Sales Navigator, activity such as InMails is written back, and LinkedIn can flag contacts in the CRM who have changed jobs.\n" +
          "\n" +
          "Advanced Plus has no public price and usually comes with a minimum number of seats, so you would need a quote.\n" +
          "\n" +
          "Workarounds on Core:\n" +
          "\n" +
          "- Browser extensions from some CRMs and sales tools can capture a profile into the CRM with one click. Check that any such tool follows LinkedIn's terms, since scraping can get accounts restricted.\n" +
          "- A simple rule that SDRs paste the Sales Navigator profile link into the CRM contact goes a long way.\n" +
          "\n" +
          "For 8 SDRs, I would start on Core and ask for an Advanced Plus quote only if the manual step turns out to be a real drag.",
        memories: [],
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
          "Good choice for staying under your budget. Two things to set up first:\n" +
          "\n" +
          "1. **Turn on daily backups.** Railway can take scheduled backups of the database volume; set them to daily and keep at least a week.\n" +
          "2. **Set a usage limit**, so a runaway query can't run up the bill. It is under the workspace's usage settings, with an email alert at a lower threshold.\n" +
          "\n" +
          "Then a few more that take ten minutes and save trouble later:\n" +
          "\n" +
          "- **Region**: put the database in US East, next to your Vercel functions.\n" +
          "- **Private access**: if anything else runs on Railway, connect over the private network. From Vercel you'll use the public address, so make sure the password is the long generated one.\n" +
          "- **Postgres version**: pick the current major version now; upgrading later means a dump and restore.\n" +
          "- **Connection limit**: note the maximum connections, since serverless functions can use them up quickly.\n" +
          "- **A second backup**: run pg_dump to a file outside Railway now and then. A backup held by the same provider is not a full safety net.\n" +
          "\n" +
          "Finally, restore one backup into a scratch database, to be sure the backups work.",
        memories: [
          about(
            "side project database host",
            decision("The user decided to host the side project's database on Railway.", "Railway"),
          ),
        ],
      },
      {
        question: "How do I connect to it from Vercel?",
        answer:
          "Add its connection string as the DATABASE_URL environment variable, and use a pooled connection, since serverless functions open many.\n" +
          "\n" +
          "Step by step:\n" +
          "\n" +
          "1. In Railway, open the Postgres service and copy the public connection string from the Variables or Connect tab.\n" +
          "2. In Vercel, go to the project's settings, then Environment Variables, and add DATABASE_URL for production. Add a separate database or branch for preview if you don't want previews touching real data.\n" +
          "3. Redeploy, since environment variables apply to new deployments only.\n" +
          "\n" +
          "On pooling:\n" +
          "\n" +
          "- Each serverless function instance opens its own connection, and under load you can have dozens at once, more than a small Postgres allows.\n" +
          "- A pooler such as PgBouncer sits in front of the database and shares a few real connections among many clients. You can run one as a second service on Railway and point DATABASE_URL at it.\n" +
          "- In your code, create the database client once at module level, not inside the request handler, and keep the pool size at one or two per function.\n" +
          "\n" +
          "Add sslmode=require to the connection string so traffic is encrypted between Vercel and Railway.",
        memories: [],
      },
      {
        question: "What usage limit is sensible?",
        answer:
          "$10 a month: twice what you expect to use.\n" +
          "\n" +
          "The reasoning:\n" +
          "\n" +
          "- Your database should stay within the $5 of usage that the Hobby plan includes.\n" +
          "- A limit at exactly $5 would trip on an ordinary busy week and take the project offline for no good reason.\n" +
          "- A limit at double leaves room for real growth, and still stops a mistake before it costs much.\n" +
          "\n" +
          "How to set it up:\n" +
          "\n" +
          "- **Soft alert at $7**: you get an email, nothing stops.\n" +
          "- **Hard limit at $10**: Railway stops the services when it is reached. That means downtime, so the alert at $7 is your warning to look.\n" +
          "\n" +
          "What usually causes a jump:\n" +
          "\n" +
          "- A query with no index that scans a growing table on every request.\n" +
          "- A background job stuck in a loop.\n" +
          "- Storage that grows because logs or cache rows are never deleted.\n" +
          "\n" +
          "Look at the usage graph after the first two weeks. If you are steadily at $3 to $4, the limit is right. If you are near $8 with normal traffic, raise it and look at what is using the memory.",
        memories: [],
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
          "Yes, it changed. Neon's **Launch** plan is now pay-as-you-go with a $5 monthly minimum, down from a $19 flat fee [1].\n" +
          "\n" +
          "What that means:\n" +
          "\n" +
          "- You pay for what you use, in compute hours and storage, and the bill is at least $5 a month.\n" +
          "- A small project that would have paid $19 before now pays close to the minimum.\n" +
          "- A busy database pays more as usage grows, with no jump between plan tiers.\n" +
          "\n" +
          "What stays the same:\n" +
          "\n" +
          "- The free plan, with 0.5 GB of storage.\n" +
          "- Scale to zero when idle, and database branching.\n" +
          "\n" +
          "Why it matters for you: when you compared hosts, Neon's paid plan at $19 was over your $10 limit, which is what pointed you to Railway's $5 Hobby plan. At a $5 minimum the two now cost about the same for a small database, so the choice comes down to features: Neon's branching and scale to zero against having everything on one platform at Railway.\n" +
          "\n" +
          "Usage-based prices can change again, so check the pricing page before you commit.",
        sources: pages(["Neon pricing", NEON]),
        memories: [
          about(
            "Neon Launch plan price",
            claim(
              "Neon's Launch plan is now pay-as-you-go with a $5 monthly minimum.",
              NEON,
              "Neon",
            ),
          ),
        ],
      },
      {
        question: "Then I'll move the side project's database from Railway to Neon.",
        answer:
          "Noted: the side project's database moves from Railway to Neon. Use pg_dump and pg_restore; for a small database it takes minutes.\n" +
          "\n" +
          "The steps:\n" +
          "\n" +
          "1. **Create the Neon project** in a US East region, with the same Postgres major version as on Railway.\n" +
          "2. **Stop writes** to the old database. For a side project, a few minutes of maintenance mode is the simplest way.\n" +
          "3. **Dump** the Railway database with pg_dump in custom format.\n" +
          "4. **Restore** into Neon with pg_restore, using the direct connection string, not the pooled one. Add the no-owner option so role names don't cause errors.\n" +
          "5. **Check** row counts on the main tables, and that extensions you use are enabled.\n" +
          "6. **Switch** DATABASE_URL in Vercel to Neon's pooled connection string, and redeploy.\n" +
          "7. **Verify** the app, then keep the Railway database for a week as a fallback before deleting it.\n" +
          "\n" +
          "Things that sometimes go wrong:\n" +
          "\n" +
          "- Sequences out of step after the restore. A custom-format dump normally carries them over; check one insert works.\n" +
          "- Extensions that exist on one host and not the other.\n" +
          "\n" +
          "Take a final dump file and keep it somewhere safe, whatever happens.",
        memories: [
          about(
            "side project database host",
            decision(
              "The user decided to move the side project's database from Railway to Neon.",
              "Neon",
              "Railway",
            ),
          ),
        ],
      },
      {
        question: "What will it cost me with about 1 GB and light traffic?",
        answer:
          "Most likely the $5 minimum.\n" +
          "\n" +
          "Why: with about 1 GB of data and light traffic, your actual usage comes to less than $5, so the minimum is what you pay.\n" +
          "\n" +
          "Roughly where the usage comes from:\n" +
          "\n" +
          "- **Storage**: 1 GB costs well under a dollar a month.\n" +
          "- **Compute**: you are billed only while the database is awake. With light traffic it sleeps most of the day, so the compute hours stay low.\n" +
          "- **History**: the data kept for point-in-time restore counts as storage, and stays small if you don't write much.\n" +
          "\n" +
          "What could push it above $5:\n" +
          "\n" +
          "- Something that keeps the database awake all day, such as an uptime checker that hits a page with a query every minute, or a cron job. A database that never sleeps on the smallest size can cost noticeably more than the minimum.\n" +
          "- Many branches left running.\n" +
          "- A lot of writes, which grows the stored history.\n" +
          "\n" +
          "To stay at the minimum, leave scale to zero on, point health checks at a page that doesn't touch the database, and delete preview branches when their pull requests close. The billing page shows usage for the current month, so check it after the first week.",
        memories: [],
      },
      {
        question: "Can I get a database branch for each preview deployment?",
        answer:
          "Yes. Neon's Vercel integration creates one for each preview.\n" +
          "\n" +
          "How it works:\n" +
          "\n" +
          "- Install the Neon integration from the Vercel marketplace and link your project.\n" +
          "- Each time you push a branch, Vercel builds a preview deployment, and the integration creates a matching Neon branch from your main database.\n" +
          "- It sets DATABASE_URL for that preview to the new branch, so the preview runs against its own copy of the data.\n" +
          "- A branch is a copy-on-write snapshot, so it is created in about a second and takes almost no extra storage until the data changes.\n" +
          "\n" +
          "Why this is useful:\n" +
          "\n" +
          "- You can run a migration in a pull request and see it work against realistic data, without touching production.\n" +
          "- Two pull requests with different schema changes don't interfere.\n" +
          "\n" +
          "Things to set:\n" +
          "\n" +
          "- Turn on automatic deletion of branches when the git branch is deleted or merged, or they pile up.\n" +
          "- If production holds personal data, think about whether previews should see it. You can branch from a sanitised database instead.\n" +
          "- Run migrations as part of the preview build, so the branch's schema matches the code.\n" +
          "\n" +
          "Branches scale to zero when idle, so they cost little as long as they are cleaned up.",
        memories: [],
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
          "Pedernales Falls State Park. The 5 km Twin Falls and river loop is easy, and the park is about 50 minutes west of the city.\n" +
          "\n" +
          "What to expect:\n" +
          "\n" +
          "- **The falls**: wide limestone shelves that the Pedernales River runs across. You can walk out onto the rock and look along the river.\n" +
          "- **Twin Falls nature trail**: a short shaded loop through oak and juniper to an overlook of a small double waterfall.\n" +
          "- **The river trail**: flat walking along the water, with places to sit and paddle.\n" +
          "\n" +
          "Practical notes:\n" +
          "\n" +
          "- Start by 9:00. It gets busy by late morning on weekends, and it is cooler early.\n" +
          "- Bring water, a hat and shoes with grip; the limestone is slick when wet.\n" +
          "- Swimming is allowed only in the marked area downstream, not at the falls themselves.\n" +
          "- After heavy rain the river can rise quickly, so check the park's page for alerts before you go.\n" +
          "\n" +
          "Two other easy options within an hour: McKinney Falls, which is inside Austin, and Hamilton Pool, which needs a reservation. Pedernales has the most to see for the least effort.",
        memories: [
          fact("Pedernales Falls State Park was suggested as a day hike near Austin.", "Austin"),
        ],
      },
      {
        question: "Is it OK for a 9-year-old?",
        answer:
          "Yes. The loop is flat, and the river pools are the highlight for children.\n" +
          "\n" +
          "Why it suits a 9-year-old:\n" +
          "\n" +
          "- 5 km on easy ground is about an hour and a half of walking, with plenty of stops.\n" +
          "- The rock shelves at the falls are fun to scramble over, and there are small pools with fish and tadpoles.\n" +
          "- The Twin Falls loop is short and shaded if she tires early.\n" +
          "- In the swimming area downstream, the water is shallow at the edge.\n" +
          "\n" +
          "What to watch:\n" +
          "\n" +
          "- At the falls, keep her back from the edges and off wet rock. The current is stronger than it looks, which is why swimming is banned there.\n" +
          "- There is little shade on the rock, so bring sun cream and more water than you think you need.\n" +
          "- Water shoes or old trainers are better than sandals.\n" +
          "\n" +
          "Things that make it more fun for her: a small net or a magnifying glass for the pools, a picnic on the rocks, and the park's junior ranger activity sheet from the headquarters. Pack a change of clothes; she will get wet.",
        memories: [fact("The user's daughter is 9 years old.")],
      },
      {
        question: "What does it cost to get in?",
        answer:
          "$6 per adult; children of 12 and under are free [1].\n" +
          "\n" +
          "So two adults and your daughter would pay $12 for the day.\n" +
          "\n" +
          "Reserve a day pass online for weekends. The park limits how many people can enter, and on fine Saturdays and Sundays it often reaches that limit by mid-morning. With a reservation you are guaranteed entry; without one you may be turned away at the gate.\n" +
          "\n" +
          "How to book:\n" +
          "\n" +
          "- Reserve on the Texas State Parks reservation site, up to 30 days ahead.\n" +
          "- Choose a morning arrival slot.\n" +
          "- Show the confirmation on your phone at the entrance.\n" +
          "\n" +
          "If you expect to visit state parks more than a few times a year, the Texas State Parks Pass covers entry for everyone in your car at every state park for a year, and pays for itself in about six visits for two adults.\n" +
          "\n" +
          "Check the park's page the day before for closures; trails near the river sometimes close after rain.",
        sources: pages([
          "Pedernales Falls State Park",
          "https://tpwd.texas.gov/state-parks/pedernales-falls",
        ]),
        memories: [
          claim(
            "Pedernales Falls State Park charges $6 per adult; children of 12 and under are free.",
            "https://tpwd.texas.gov/state-parks/pedernales-falls",
            "Pedernales Falls State Park",
          ),
        ],
      },
      {
        question: "Where can we get lunch afterwards?",
        answer:
          "In Johnson City, 15 minutes away. Pecan Street Brewing has vegetarian options.\n" +
          "\n" +
          "What to know about it:\n" +
          "\n" +
          "- It is on the main square, in an old building with a large patio, and is relaxed about children.\n" +
          "- The menu is pub food: pizzas from a wood-fired oven, salads and sandwiches. The vegetarian choices include a margherita and a vegetable pizza and a veggie burger; ask them to leave mushrooms off the vegetable pizza.\n" +
          "- They brew their own beer, and have root beer and lemonade for your daughter.\n" +
          "- It gets busy from 12:30 on weekends, so arrive a little before or after.\n" +
          "\n" +
          "Other options nearby:\n" +
          "\n" +
          "- A picnic at the park's shaded tables, if you'd like to stay by the river.\n" +
          "- The cafes on Johnson City's square for something lighter.\n" +
          "- On the drive back towards Austin, the Dripping Springs area has several places with outdoor seating.\n" +
          "\n" +
          "If you finish lunch early, the Lyndon B. Johnson boyhood home is a few minutes' walk away and is free to visit, and the Science Mill, a hands-on science museum, is good for a 9-year-old.",
        memories: [],
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
          "A lentil and sweet potato dal. It keeps for five days, freezes well and is vegetarian. Cook rice fresh every two days.\n" +
          "\n" +
          "How to make it, in about 40 minutes with little hands-on time:\n" +
          "\n" +
          "1. Fry a chopped onion in oil until soft, then add garlic, ginger and two tablespoons of curry powder or paste.\n" +
          "2. Add red lentils, diced sweet potato, a tin of coconut milk and water or stock to cover.\n" +
          "3. Simmer for 25 minutes, stirring now and then, until the lentils break down and the sweet potato is soft.\n" +
          "4. Season with salt and lime juice, and stir in spinach if you have some.\n" +
          "\n" +
          "Why it works for the week:\n" +
          "\n" +
          "- The flavour improves over the first two days.\n" +
          "- It reheats in the microwave without drying out; add a splash of water.\n" +
          "- It is filling, with protein and slow carbohydrates, which suits training days.\n" +
          "\n" +
          "To keep lunches from feeling the same every day, change what goes with it: rice on two days, flatbread on one, and a spoon of yoghurt and some crunchy seeds on top. Portion it into containers tonight, so each morning you only have to pick one up.",
        memories: [],
      },
      {
        question: "How many portions does that make?",
        answer:
          "Six, from 400 g of red lentils and two large sweet potatoes.\n" +
          "\n" +
          "The full quantities for six portions:\n" +
          "\n" +
          "- 400 g of red lentils\n" +
          "- 2 large sweet potatoes, about 700 g, peeled and diced\n" +
          "- 1 tin of coconut milk, 400 ml\n" +
          "- 1 large onion, 3 cloves of garlic and a thumb of ginger\n" +
          "- 2 tablespoons of curry powder or paste\n" +
          "- About 1 litre of water or vegetable stock\n" +
          "- Salt, and the juice of a lime\n" +
          "\n" +
          "Each portion is about 400 g of dal, with roughly 20 g of protein before you add rice.\n" +
          "\n" +
          "How to store it:\n" +
          "\n" +
          "- Four portions in the fridge for Monday to Thursday.\n" +
          "- Two portions in the freezer, for Friday and for a day next week when you don't feel like cooking. Thaw overnight in the fridge.\n" +
          "\n" +
          "Use a large pot, at least 5 litres, because the lentils swell and the dal thickens as it cools. If it sets solid in the fridge, that is normal; it loosens when you reheat it with a little water.",
        memories: [],
      },
      {
        question: "Something for breakfasts too?",
        answer:
          "Overnight oats. Five jars take ten minutes, and they keep until Friday.\n" +
          "\n" +
          "The base for each jar:\n" +
          "\n" +
          "- 50 g of rolled oats\n" +
          "- 150 ml of milk or a plant milk\n" +
          "- 2 tablespoons of yoghurt\n" +
          "- 1 tablespoon of chia seeds, which thicken it and add protein\n" +
          "- A pinch of salt and a little honey or maple syrup\n" +
          "\n" +
          "Stir, put the lid on, and leave in the fridge. They are ready by morning and are eaten cold.\n" +
          "\n" +
          "Ways to vary them through the week:\n" +
          "\n" +
          "- **Monday and Tuesday**: grated apple and cinnamon, mixed in now.\n" +
          "- **Wednesday**: peanut butter and banana. Add the banana in the morning, so it doesn't go brown.\n" +
          "- **Thursday and Friday**: frozen berries, which thaw into the oats and keep them fresh for longer.\n" +
          "\n" +
          "Tips:\n" +
          "\n" +
          "- Use rolled oats, not instant, or it turns to paste by day three.\n" +
          "- Add nuts and seeds just before eating, so they stay crunchy.\n" +
          "- For more protein on training days, stir in a spoon of protein powder or use Greek yoghurt.\n" +
          "\n" +
          "With the dal and these, breakfasts and lunches for the working week are done in under an hour.",
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
          "Five that fit, billed annually, cheapest first:\n" +
          "\n" +
          "1. **Freshsales Growth**: $9 per user per month [1].\n" +
          "2. **HubSpot Sales Hub Starter**: $15 per seat per month [2].\n" +
          "3. **Zoho CRM Professional**: $23 per user per month [3].\n" +
          "4. **Salesforce Starter Suite**: $25 per user per month [4].\n" +
          "5. **Pipedrive Growth**: $34 per user per month [5].\n" +
          "\n" +
          "For 20 people, that's $2,160, $3,600, $5,520, $6,000 and $8,160 a year.\n" +
          "\n" +
          "What each is best at:\n" +
          "\n" +
          "- **Freshsales**: the lowest price, with a built-in phone and email sequences. A good all-rounder.\n" +
          "- **HubSpot**: the easiest to learn, with a free marketing and service layer around it. The price rises steeply on the higher tiers.\n" +
          "- **Zoho**: the most features for the money, and very customisable. The interface takes longer to learn.\n" +
          "- **Salesforce**: the industry standard. Starter is simple, and you can grow into the full platform without migrating.\n" +
          "- **Pipedrive**: the clearest pipeline view, built around what reps do each day.\n" +
          "\n" +
          "All five are under your $50 limit with room to spare. To narrow it down, it helps to know which email and calendar you use, whether you need phone calling built in, and how much reporting your managers want.",
        sources: pages(
          ["Freshsales pricing", "https://www.freshworks.com/crm/pricing/"],
          ["HubSpot Sales Hub pricing", HUBSPOT],
          ["Zoho CRM pricing", ZOHO],
          ["Salesforce Sales Cloud pricing", "https://www.salesforce.com/sales/pricing/"],
          ["Pipedrive pricing", "https://www.pipedrive.com/en/pricing"],
        ),
        memories: [
          about("sales team size", fact("The user's sales team has 20 people.")),
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
          about(
            "Pipedrive Growth plan price",
            claim(
              "Pipedrive's Growth plan costs $34 per user per month, billed annually.",
              "https://www.pipedrive.com/en/pricing",
              "Pipedrive",
            ),
          ),
        ],
      },
      {
        question: "Which of them works best with Gmail?",
        answer:
          "All five sync with Gmail. Pipedrive's two-way sync and email tracking are the most complete at this price; HubSpot's Gmail extension is the quickest to set up.\n" +
          "\n" +
          "How each one handles it:\n" +
          "\n" +
          "- **Pipedrive**: full two-way sync, so emails sent from Gmail or from Pipedrive show up in both. Open and click tracking, templates and scheduling are included on this plan, and a Gmail add-on shows the deal next to the message.\n" +
          "- **HubSpot**: a Chrome extension that logs and tracks email from inside Gmail with one checkbox. Reps can be using it within minutes. The Starter plan includes templates and tracking, with limits on some features.\n" +
          "- **Zoho**: a Gmail add-on and two-way sync that work well but take more configuration.\n" +
          "- **Freshsales**: two-way sync and a Chrome extension, with tracking and templates.\n" +
          "- **Salesforce**: a Gmail integration that logs emails and shows records in a side panel. It is solid, though some of its features need higher editions.\n" +
          "\n" +
          "All five also sync Google Calendar, so meetings appear on the contact. For a team that lives in Gmail, the two to look at first are Pipedrive and HubSpot.",
        memories: [preference("The user wants a CRM that works well with Gmail.", "Gmail")],
      },
      {
        question:
          "Do any of them have a minimum number of seats or an onboarding fee on these plans?",
        answer:
          "No. None of the five has a seat minimum or a required onboarding fee on the plan listed.\n" +
          "\n" +
          "For each:\n" +
          "\n" +
          "- **Freshsales Growth**: buy any number of seats, with no setup fee.\n" +
          "- **HubSpot Sales Hub Starter**: sold per seat with no minimum. The required onboarding fees apply to the Professional and Enterprise tiers only.\n" +
          "- **Zoho CRM Professional**: no minimum and no setup fee.\n" +
          "- **Salesforce Starter Suite**: no minimum, and you can buy it online without talking to sales. It is capped at a maximum number of users, which a team of 20 can run into as it grows, so check the current cap.\n" +
          "- **Pipedrive Growth**: no minimum and no onboarding fee.\n" +
          "\n" +
          "Costs that can still appear:\n" +
          "\n" +
          "- Annual billing means paying the year up front; monthly billing costs more per seat.\n" +
          "- Add-ons such as extra automation, phone credits or document signing.\n" +
          "- Paid help with data migration, which is optional.\n" +
          "\n" +
          "So the annual figures for 20 seats are close to what you would actually pay, before tax. Ask each vendor to confirm in writing when you get a quote.",
        memories: [],
      },
      {
        question: "Which two would you trial first?",
        answer:
          "HubSpot, for the quickest setup, and Pipedrive, for the best pipeline view.\n" +
          "\n" +
          "Why these two:\n" +
          "\n" +
          "- They are the strongest for a team that works in Gmail, which you said matters.\n" +
          "- They represent two different approaches. HubSpot is a broad platform with marketing and service tools around the CRM. Pipedrive does one thing, managing deals, and does it very well.\n" +
          "- Trying both shows you which approach your reps prefer, and that tells you more than a feature list.\n" +
          "\n" +
          "What each trial will tell you:\n" +
          "\n" +
          "- **HubSpot**: how fast reps get going, and whether the Starter plan's limits on automation and reporting are a problem for you.\n" +
          "- **Pipedrive**: whether the pipeline view makes reps update deals more reliably, and whether its reports are enough for your managers.\n" +
          "\n" +
          "Why not the other three first:\n" +
          "\n" +
          "- **Freshsales** is the cheapest and worth a look if these two disappoint.\n" +
          "- **Zoho** needs more setup time than a short trial allows.\n" +
          "- **Salesforce** makes most sense if you expect to need heavy customisation later.\n" +
          "\n" +
          "Both offer free trials with no card.",
        memories: [],
      },
      {
        question: "OK, we'll trial HubSpot and Pipedrive for two weeks.",
        answer:
          "Noted: a two-week trial of HubSpot and Pipedrive. Have the same five reps use both, so the comparison is fair.\n" +
          "\n" +
          "How to run it:\n" +
          "\n" +
          "1. **Pick the five**: a mix of account executives and SDRs, including one sceptic.\n" +
          "2. **Load real data**: import the same 50 to 100 open deals and their contacts into both.\n" +
          "3. **Connect Gmail and the calendar** on day one in both tools.\n" +
          "4. **Split the time**: one week in each, or half the group starting in each tool and swapping at the midpoint.\n" +
          "5. **Use them for real work**: log calls, move deals, send emails from the CRM.\n" +
          "\n" +
          "What to score at the end, from 1 to 5:\n" +
          "\n" +
          "- How long it took to feel comfortable.\n" +
          "- How easy it is to update a deal after a call.\n" +
          "- The Gmail integration.\n" +
          "- The reports a manager needs for the weekly pipeline review.\n" +
          "- The mobile app.\n" +
          "\n" +
          "Also write down everything that needed a workaround. At the end, get a written quote for 20 seats from both, including any add-ons the trial showed you need, so you compare the real prices and not the list prices.",
        memories: [
          decision(
            "The user's sales team will trial HubSpot Sales Hub Starter and Pipedrive Growth for two weeks before choosing a CRM.",
            "HubSpot",
            "Pipedrive",
          ),
        ],
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
          "The typical structure has three parts: a 50/50 split of base and variable pay, about 10% commission on new annual contract value, and accelerators above quota.\n" +
          "\n" +
          "In more detail:\n" +
          "\n" +
          "- **Pay mix**: on-target earnings are half base salary and half variable. For example, $70,000 base and $70,000 variable for $140,000 on target.\n" +
          "- **Quota**: usually four to six times on-target earnings, so a rep with $140,000 OTE might carry $600,000 to $800,000 a year.\n" +
          "- **Commission rate**: the variable pay divided by the quota, which typically lands between 8% and 12% of annual contract value.\n" +
          "- **Accelerators**: a higher rate on everything sold above 100% of quota, to reward the best reps.\n" +
          "\n" +
          "Common additions:\n" +
          "\n" +
          "- A lower rate, or none, on renewals, and a moderate rate on expansion.\n" +
          "- A bonus for multi-year deals or payment up front.\n" +
          "- Clawbacks if a customer cancels within the first few months.\n" +
          "- No cap on earnings. Caps tell your best reps to stop selling.\n" +
          "\n" +
          "Pay monthly or quarterly, on signed contracts or on cash received, and keep the plan simple enough that a rep can work out their own commission on a napkin.",
        memories: [],
      },
      {
        question: "Our average deal is $18,000 a year. What would a rep earn on quota?",
        answer:
          "With a $600,000 quota and 10% commission, $60,000 in variable pay: about 33 deals a year.\n" +
          "\n" +
          "The arithmetic:\n" +
          "\n" +
          "- $600,000 of quota divided by an $18,000 average deal is 33.3 deals a year, or just under three a month.\n" +
          "- 10% of $18,000 is $1,800 in commission per deal.\n" +
          "- 33 deals at $1,800 is about $60,000.\n" +
          "\n" +
          "So a rep exactly on quota earns $60,000 on top of base. With a 50/50 mix that implies a $60,000 base and $120,000 on-target earnings.\n" +
          "\n" +
          "Checks worth doing on those numbers:\n" +
          "\n" +
          "- **Is three deals a month achievable?** Look at how many your current reps close. If the good ones do two, the quota is too high for this deal size.\n" +
          "- **Quota to OTE ratio**: $600,000 against $120,000 is five times, which is in the normal range.\n" +
          "- **Pipeline needed**: at a 25% win rate, each rep needs about 12 qualified opportunities a month.\n" +
          "\n" +
          "If your deals vary a lot in size, pay the same percentage on every deal and avoid a flat amount per deal, so reps are not pushed towards many small ones.",
        memories: [fact("The user's average deal is about $18,000 in annual contract value.")],
      },
      {
        question: "How should SDRs be paid?",
        answer:
          "A 70/30 split, with the variable part paid per qualified meeting and a smaller bonus when a meeting becomes a deal.\n" +
          "\n" +
          "How it usually looks:\n" +
          "\n" +
          "- **Pay mix**: 70% base and 30% variable. For example, $50,000 base and about $21,000 variable.\n" +
          "- **Main measure**: qualified meetings held, not meetings booked. A meeting counts when the account executive accepts it as a real opportunity.\n" +
          "- **Second measure**: a smaller bonus tied to pipeline created or deals closed from their meetings, so quality matters as well as quantity.\n" +
          "\n" +
          "A common weighting is 70 to 80% of the variable pay on meetings and 20 to 30% on what happens afterwards.\n" +
          "\n" +
          "Why SDRs are paid differently from account executives:\n" +
          "\n" +
          "- They don't control whether a deal closes, so paying them mostly on revenue feels like a lottery.\n" +
          "- The feedback loop needs to be short. Paying monthly on meetings keeps motivation up.\n" +
          "\n" +
          "What to define clearly:\n" +
          "\n" +
          '- What "qualified" means, in writing, agreed between SDRs and account executives.\n' +
          "- What happens when a prospect doesn't turn up.\n" +
          "- Who gets credit for inbound leads against outbound ones.\n" +
          "\n" +
          "Add an accelerator above target for SDRs too.",
        memories: [],
      },
      {
        question: "What's a common accelerator?",
        answer:
          "1.5 times the commission rate on everything above 100% of quota.\n" +
          "\n" +
          "With your numbers: the base rate is 10%, so above quota a rep earns 15%. On an $18,000 deal, that is $2,700 where a deal below quota pays $1,800.\n" +
          "\n" +
          "Variations you will see:\n" +
          "\n" +
          "- **Tiered accelerators**: 1.5 times from 100% to 150% of quota, and 2 times above 150%.\n" +
          "- **Quarterly and annual**: accelerators that apply each quarter, with a true-up at the end of the year.\n" +
          "- **Decelerators**: a reduced rate below, say, 50% of quota. These are less popular and can demoralise new reps.\n" +
          "\n" +
          "Why accelerators are worth their cost:\n" +
          "\n" +
          "- A deal above quota costs the company no extra salary, so it can afford to share more of it.\n" +
          "- They keep top reps selling in the last month and discourage them from holding deals over into the next period.\n" +
          "- They help you keep your best people.\n" +
          "\n" +
          "Check the cost before you publish the plan: model a rep at 150% and at 200% of quota, and make sure the company is still comfortable with the total pay. Don't cap it; if the model looks too expensive, lower the multiplier.",
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
        answer:
          "At $15 per seat per month, billed annually, 25 seats cost $4,500 a year [1].\n" +
          "\n" +
          "The arithmetic: 25 seats at $15 is $375 a month, times 12.\n" +
          "\n" +
          "How that compares:\n" +
          "\n" +
          "- For the 20 people you had when we made the shortlist, it was $3,600 a year, so the five new reps add $900.\n" +
          "- On monthly billing the per-seat price is higher, so the same 25 seats cost more over a year. Annual billing means paying the $4,500 up front.\n" +
          "\n" +
          "Things to confirm before you sign:\n" +
          "\n" +
          "- That every one of the 25 needs a paid Sales Hub seat. People who only need to view records can use free view-only seats.\n" +
          "- Whether you need anything Starter leaves out, such as sequences, custom reports or required fields on deals. Those are on Professional, which costs several times more per seat.\n" +
          "- Any discount for new customers. HubSpot sometimes offers one on Starter in the first year, so ask.\n" +
          "\n" +
          "Tax is added where it applies. If the team is likely to grow again this year, ask how adding seats mid-term is priced; they are normally charged pro rata until your renewal date.",
        sources: pages(["HubSpot Sales Hub pricing", HUBSPOT]),
        memories: [
          about(
            "sales team size",
            fact("The user's sales team has 25 people, after hiring five more reps."),
          ),
        ],
      },
      {
        question: "Do the new reps each need a seat, or can they share one?",
        answer:
          "Each needs their own: a seat is tied to one login.\n" +
          "\n" +
          "Why sharing doesn't work, apart from the terms of service:\n" +
          "\n" +
          "- **Activity tracking**: emails, calls and notes are logged under the seat's user. With a shared login you can't tell who did what, and reports per rep become meaningless.\n" +
          "- **Email and calendar**: each seat connects to one person's Gmail and calendar. Two reps can't both connect.\n" +
          "- **Ownership**: deals and contacts are assigned to a user. Commission and pipeline reviews depend on that being accurate.\n" +
          "- **Security**: a shared password can't be switched off for one person when they leave.\n" +
          "\n" +
          "What you can do to keep the cost down:\n" +
          "\n" +
          "- Give paid seats only to people who sell. Managers who only read dashboards, or finance, can have free view-only seats.\n" +
          "- Add the new reps' seats when they actually start, not in advance.\n" +
          "- If a rep leaves, reassign the seat to their replacement; you don't need to buy another.\n" +
          "\n" +
          "So for 25 people who all work deals, plan on 25 paid seats.",
        memories: [],
      },
      {
        question: "Is there an onboarding fee on Starter?",
        answer:
          "No. Only Professional and Enterprise have one.\n" +
          "\n" +
          "How it breaks down:\n" +
          "\n" +
          "- **Starter**: no onboarding fee. You sign up and set it up yourself, with help articles, the academy courses and chat support.\n" +
          "- **Professional**: a required one-time onboarding fee, typically in the low thousands of dollars.\n" +
          "- **Enterprise**: a larger required onboarding fee.\n" +
          "\n" +
          "HubSpot does sell optional paid onboarding and consulting for Starter, and partners offer setup packages, but none of it is required.\n" +
          "\n" +
          "For a team of 25, setting up Starter yourselves is realistic. Plan about a week of someone's part-time attention for:\n" +
          "\n" +
          "- Importing contacts, companies and open deals.\n" +
          "- Defining the pipeline stages.\n" +
          "- Connecting Gmail and calendars for each rep.\n" +
          "- Creating a few email templates and the main dashboard.\n" +
          "- A one-hour training session.\n" +
          "\n" +
          "If you later move to Professional, the onboarding fee applies at that point, so include it when you compare the cost of upgrading with other tools.",
        memories: [],
      },
    ],
  },
  // --- More chats across the same weeks: personal ones, more of the company's tools, and three
  // more facts that change later (analytics, a CRM price, the Vercel bill).
  {
    title: "Podcast microphone",
    at: on(TUE, "20:00", 6),
    turns: [
      {
        question: "I'm starting a podcast with a friend. Which USB microphone should I buy?",
        answer:
          "Two USB microphones stand out for a new podcast:\n" +
          "\n" +
          "- **Shure MV7+** ($279): sounds best in an untreated room [1]. It has built-in processing that evens out your level and reduces background noise, and it has both USB-C and XLR outputs, so you can move to a mixer later.\n" +
          "- **Rode PodMic USB** ($199): close in sound and cheaper [2]. Solidly built, also with USB-C and XLR, and a built-in pop filter.\n" +
          "\n" +
          "Why these and not a cheaper condenser microphone: both are dynamic microphones, which mostly pick up the voice directly in front of them and little of the room. In a normal home without acoustic treatment, that matters more than anything else.\n" +
          "\n" +
          "What else you need:\n" +
          "\n" +
          "- A boom arm or stand for each, so the microphone sits close to your mouth.\n" +
          "- Closed-back headphones, to hear yourselves without the sound leaking back into the mic.\n" +
          "- One microphone per person. Sharing one never sounds good.\n" +
          "\n" +
          "With two of you, both recording into one computer over USB takes a little setup, which I can walk you through. If the budget allows, the MV7+ is the more forgiving; the PodMic USB is the better value.",
        sources: pages(
          ["Shure MV7+", "https://www.shure.com/en-US/products/microphones/mv7-plus"],
          ["Rode PodMic USB", "https://rode.com/en-us/products/podmic-usb"],
        ),
        memories: [
          fact("The user is starting a podcast with a friend."),
          claim(
            "The Shure MV7+ microphone costs $279.",
            "https://www.shure.com/en-US/products/microphones/mv7-plus",
            "Shure MV7+",
          ),
          claim(
            "The Rode PodMic USB microphone costs $199.",
            "https://rode.com/en-us/products/podmic-usb",
            "Rode PodMic",
          ),
        ],
      },
      {
        question: "We record in my spare room, and it echoes.",
        answer:
          "That's manageable. Both are dynamic microphones, which pick up little of the room. Speak 5 to 10 cm from the mic and hang a duvet behind you.\n" +
          "\n" +
          "Why those two things work:\n" +
          "\n" +
          "- **Distance**: the closer you are, the louder your voice is compared with the echo. At 5 to 10 cm, your voice dominates and the room almost disappears. At 30 cm, the echo is clearly audible.\n" +
          "- **Soft surfaces**: echo is sound bouncing off hard walls. Anything thick and soft absorbs it, and the wall behind you matters most, because the microphone points at it.\n" +
          "\n" +
          "More cheap fixes, most effective first:\n" +
          "\n" +
          "- Record facing into the room with a duvet, a full bookshelf or an open wardrobe of clothes behind you.\n" +
          "- Put a rug on a hard floor.\n" +
          "- Close the curtains.\n" +
          "- Sit away from the middle of the room and away from bare walls.\n" +
          "\n" +
          "What not to bother with: thin foam tiles do little, and a small reflection shield behind the mic helps less than a duvet behind your head.\n" +
          "\n" +
          "Make a one-minute test recording before and after. The difference from the duvet alone is usually obvious, and a little noise reduction in editing handles the rest.",
        memories: [],
      },
      {
        question: "Do I need an audio interface?",
        answer:
          "No. Both plug straight into a laptop over USB-C.\n" +
          "\n" +
          "Each of these microphones has the interface built in: it converts the sound to digital itself, and has a headphone socket on the body so you can hear yourself without delay.\n" +
          "\n" +
          "What that means for two people:\n" +
          "\n" +
          '- **Two USB microphones into one laptop** works, with a little setup. On a Mac, you combine them into one "aggregate device" in the Audio MIDI Setup app; on Windows, it is easier to use recording software that accepts two inputs.\n' +
          "- Record each microphone to its own track, so you can adjust one voice without the other.\n" +
          "\n" +
          "When an interface becomes worth buying:\n" +
          "\n" +
          "- You add a third or fourth person.\n" +
          "- You want physical volume knobs and one set of controls.\n" +
          "- You want to mix in sound effects or phone calls live.\n" +
          "\n" +
          "Both microphones also have an XLR output, so if you outgrow USB you can plug the same microphones into an interface or a podcast mixer later, and nothing you buy now is wasted. For two hosts starting out, USB is simpler and one thing fewer to learn.",
        memories: [],
      },
      {
        question: "What should we record with?",
        answer:
          "It depends on whether you are in the same room.\n" +
          "\n" +
          "- **Riverside**, if you record from two places. It saves each voice locally on each person's computer and uploads it afterwards, so the quality doesn't suffer when the internet connection wobbles. You get a separate track per person, and video if you want it.\n" +
          "- **Audacity** is free if you sit in the same room. It records both microphones to separate tracks and has all the editing you need: cutting, noise reduction and levelling.\n" +
          "\n" +
          "Other options:\n" +
          "\n" +
          "- **GarageBand** on a Mac is free and friendlier than Audacity.\n" +
          "- **Descript** lets you edit the recording by editing a transcript, which many beginners find much faster.\n" +
          "- **Zencastr** and **SquadCast** are alternatives to Riverside for remote recording.\n" +
          "\n" +
          "A simple workflow to start with:\n" +
          "\n" +
          "1. Record each voice on its own track.\n" +
          "2. Trim the start and end, and cut the obvious mistakes.\n" +
          "3. Apply noise reduction and even out the loudness.\n" +
          "4. Export as an MP3.\n" +
          "\n" +
          "Record ten minutes of test conversation before your first real episode. Everyone's first recording has a problem, and it is better to find it on a test.",
        memories: [],
      },
      {
        question: "I'll get two Rode PodMics.",
        answer:
          "Noted: two Rode PodMic USBs, $398 for the pair. Add two boom arms, at about $40 each.\n" +
          "\n" +
          "Why the boom arms matter: they hold the microphone at mouth height, 5 to 10 cm away, wherever you sit, and they keep it off the desk so it doesn't pick up typing and bumps. They do more for the sound than any other accessory.\n" +
          "\n" +
          "The rest of a sensible starter kit:\n" +
          "\n" +
          "- **Closed-back headphones** for each of you. Any decent pair works to start with.\n" +
          "- **Two USB-C cables** long enough to reach, and a hub if your laptop is short of ports.\n" +
          "- The PodMic has a pop filter built in, so you don't need to buy one.\n" +
          "\n" +
          "Setup on the day they arrive:\n" +
          "\n" +
          "1. Mount each microphone on its arm, pointing at your mouth, slightly off to one side.\n" +
          "2. Install Rode's free app to set the level and switch on the built-in processing.\n" +
          "3. Set up both microphones as separate inputs in your recording software.\n" +
          "4. Record a test with the duvet behind you and listen back on headphones.\n" +
          "\n" +
          "That brings the whole setup to about $480 before headphones.",
        memories: [
          decision(
            "The user decided to buy two Rode PodMic USB microphones for the podcast.",
            "Rode PodMic",
          ),
        ],
      },
    ],
  },
  {
    title: "Customer onboarding emails",
    at: on(WED, "11:30", 5),
    turns: [
      {
        question:
          "We sell scheduling software to dental clinics. Draft an outline for a five-email onboarding sequence.",
        answer:
          "Here is an outline for five emails across a two-week trial:\n" +
          "\n" +
          "- **Day 0: welcome and one first step.** Thank them, and ask for one thing only: import your calendar. Link straight to that screen.\n" +
          "- **Day 2: set up online booking.** Show how patients can book themselves, with a screenshot of the booking page.\n" +
          "- **Day 5: reminders that cut no-shows.** Explain text and email reminders, with a number from a real clinic if you have one.\n" +
          "- **Day 9: a customer story.** A clinic like theirs, in the office manager's own words: what changed in the first month.\n" +
          "- **Day 14: the trial ends, with an offer of a call.** Say plainly what happens next and how to continue, and offer help.\n" +
          "\n" +
          "Principles behind it:\n" +
          "\n" +
          "- Each email has one job and one button.\n" +
          "- The order follows the path to value: connect the calendar, take a booking, lose fewer appointments.\n" +
          "- Send from a named person, and make replies go to a real inbox.\n" +
          "\n" +
          "To make it better, skip an email when the clinic has already done the step, and send a short nudge on day 3 to anyone who hasn't imported a calendar, since that is the step everything else depends on.",
        memories: [fact("The user's company sells scheduling software to dental clinics.")],
      },
      {
        question: "Our trial is 14 days. Should the last email offer a discount?",
        answer:
          "No. Offer a 15-minute setup call instead: clinics that finish setup convert without a discount.\n" +
          "\n" +
          "Why a discount is the wrong tool here:\n" +
          "\n" +
          "- A clinic that hasn't finished setup doesn't see the value yet. A lower price doesn't change that; help does.\n" +
          "- A clinic that has finished setup and is taking bookings was going to buy anyway, so the discount only costs you revenue.\n" +
          "- Discounts at the end of a trial teach customers to wait for one, and lower the price they expect for good.\n" +
          "\n" +
          "What the last email should do:\n" +
          "\n" +
          "- Say clearly that the trial ends today and what happens to their data and bookings.\n" +
          "- Give one button to choose a plan.\n" +
          '- Offer the call: "Not set up yet? Book 15 minutes and we\'ll do it together."\n' +
          "- Offer an extension to anyone who asks. A week more is cheaper than a discount, and is often all a busy office manager needs.\n" +
          "\n" +
          "If you want to test a financial incentive, tie it to commitment and not to hesitation: for example, two months free on an annual plan, offered to everyone.",
        memories: [fact("The user's product has a 14-day free trial.")],
      },
      {
        question: "Write the subject line for the day-5 email.",
        answer:
          '"Cut your no-shows in half this week".\n' +
          "\n" +
          "Why this works for an office manager:\n" +
          "\n" +
          "- It names a problem they deal with every day.\n" +
          "- It promises a specific result and a short time frame.\n" +
          "- At seven words, it shows in full on a phone.\n" +
          "\n" +
          "A few alternatives to test against it:\n" +
          "\n" +
          '- "The 2-minute setup that fills empty chairs"\n' +
          '- "Stop calling patients to confirm"\n' +
          '- "Turn on reminders before Monday"\n' +
          "\n" +
          'And a line of preview text to go with it: "Text reminders take two minutes to switch on. Here\'s how."\n' +
          "\n" +
          'One caution: only say "in half" if your own customers\' numbers support it. If the typical drop is nearer a third, say "Cut your no-shows this week", or use a real figure from a clinic you can name. A subject line that overpromises gets the open and loses the trust.',
        memories: [],
      },
      {
        question: "Keep the tone plain. Our customers are office managers, not engineers.",
        answer:
          "Understood: short sentences, no product jargon, one action per email.\n" +
          "\n" +
          "What that means in practice:\n" +
          "\n" +
          '- **Use their words.** "Patients", "appointments", "the front desk" and "no-shows", not "users", "workflows", "integrations" or "sync".\n' +
          '- **Say what to do, not how the software works.** "Connect your calendar" with a button, not an explanation of the calendar import.\n' +
          "- **Keep it short.** Three to five sentences, readable in under 20 seconds between patients.\n" +
          '- **One button per email**, with a label that says what happens: "Turn on reminders".\n' +
          "- **Write like a person.** Sign with a first name, and say that replies reach you.\n" +
          "\n" +
          "An example for the day-5 email:\n" +
          "\n" +
          '"Hi Maria,\n' +
          "\n" +
          "Most clinics lose a few appointments every week to patients who forget.\n" +
          "\n" +
          "Text reminders fix most of that. They take two minutes to turn on, and patients can confirm with one tap.\n" +
          "\n" +
          "[Turn on reminders]\n" +
          "\n" +
          "Stuck? Reply to this email and I'll help.\n" +
          "\n" +
          'Sam"\n' +
          "\n" +
          "I'll keep to this style for anything else I draft for your customers.",
        memories: [
          preference(
            "The user wants customer emails in plain language: their readers are dental office managers.",
          ),
        ],
      },
    ],
  },
  {
    title: "Home internet plans",
    at: on(THU, "19:00", 5),
    turns: [
      {
        question: "Which home internet providers are worth it in Austin?",
        answer:
          "Two fibre providers are worth it in Austin, where they reach your address:\n" +
          "\n" +
          "- **Google Fiber 1 Gig**: $70/month [1].\n" +
          "- **AT&T Fiber 500**: $65/month [2].\n" +
          "\n" +
          "Both are symmetric, with no data cap. Symmetric means the upload speed matches the download speed, which cable internet can't offer.\n" +
          "\n" +
          "How they compare:\n" +
          "\n" +
          "- **Google Fiber**: simple pricing with no promotional rate that later rises, the router is included, and customer service has a good reputation. Coverage is patchy and goes street by street.\n" +
          "- **AT&T Fiber**: wider coverage across the city, and several speeds to choose from. The equipment fee is included on fibre plans, but check the offer for your address.\n" +
          "\n" +
          "If neither reaches you:\n" +
          "\n" +
          "- **Spectrum** cable is available almost everywhere. Download speeds are fine, upload is much slower, and the price usually goes up after the first year.\n" +
          "- **T-Mobile or Verizon home internet** over 5G can be good value if you have a strong signal.\n" +
          "\n" +
          "Check both fibre providers' sites with your exact address first, since availability can differ between neighbouring buildings. If both serve you, either is a good choice.",
        sources: pages(
          ["Google Fiber plans", "https://fiber.google.com/plans/"],
          ["AT&T Fiber", "https://www.att.com/internet/fiber/"],
        ),
        memories: [
          claim(
            "Google Fiber 1 Gig costs $70 per month.",
            "https://fiber.google.com/plans/",
            "Google Fiber",
          ),
          claim(
            "AT&T Fiber 500 costs $65 per month.",
            "https://www.att.com/internet/fiber/",
            "AT&T Fiber",
          ),
        ],
      },
      {
        question: "I work from home two days a week and I'm on video calls most of the day.",
        answer:
          "Either is far more than video calls need. Upload speed matters most, and both give you plenty.\n" +
          "\n" +
          "The numbers:\n" +
          "\n" +
          "- A high-definition video call uses about 3 to 4 Mbps in each direction.\n" +
          "- AT&T Fiber 500 gives you 500 Mbps up and down; Google Fiber 1 Gig gives you 1,000.\n" +
          "- So even the slower plan could carry a hundred calls at once.\n" +
          "\n" +
          "What actually makes video calls good or bad at home:\n" +
          "\n" +
          "- **Wi-Fi, not the line.** Most call problems come from a weak signal between the laptop and the router. If your desk is far from the router, use a network cable or a mesh Wi-Fi system.\n" +
          "- **Other people at home.** With fibre, someone streaming or gaming at the same time won't affect your calls.\n" +
          "- **Reliability.** Fibre drops out less often than cable, which matters more than speed when you are on calls most of the day.\n" +
          "\n" +
          "Since you work from home two days a week, it is also worth keeping your phone's hotspot ready as a backup for the rare outage. On speed alone, you don't need to pay for more than either of these.",
        memories: [fact("The user works from home two days a week.")],
      },
      {
        question: "Is there a contract?",
        answer:
          "No, both are month to month.\n" +
          "\n" +
          "What that means for each:\n" +
          "\n" +
          "- **Google Fiber**: no annual contract, no cancellation fee, and the price is the standard price, not a first-year offer.\n" +
          "- **AT&T Fiber**: no annual contract on its fibre plans. Check whether the price shown for your address is a promotion with an end date, and whether it depends on automatic payment and paperless billing.\n" +
          "\n" +
          "Other terms worth reading before you sign:\n" +
          "\n" +
          "- **Equipment**: both include the router or gateway. If you cancel, you return it, and an unreturned unit is charged for.\n" +
          "- **Installation**: often free, but confirm it on the order page.\n" +
          "- **Price changes**: with no contract, the provider can also change the price with notice. Google Fiber has kept its prices steady for years, which is part of its appeal.\n" +
          "- **Taxes and fees**: fibre plans usually have fewer extra fees than cable, so the bill should be close to the advertised price.\n" +
          "\n" +
          "With no contract, you can also switch later if the other provider improves its offer.",
        memories: [],
      },
      {
        question: "Google Fiber then.",
        answer:
          "Noted: Google Fiber 1 Gig. Installation is free, and is usually booked a week or two ahead.\n" +
          "\n" +
          "What to expect:\n" +
          "\n" +
          "1. **Order online** with your address, and choose an installation slot. You need to be home for it.\n" +
          "2. **The visit** takes two to four hours. The technician runs the fibre line into your home, fits a small box on the wall and sets up the router.\n" +
          "3. **Choose the spot** for the router beforehand: as central as possible, out in the open and off the floor. The fibre box usually goes near where the line enters, and they can run a cable from there.\n" +
          "\n" +
          "Tips:\n" +
          "\n" +
          "- Put the router near your desk if you can, or ask for a network cable to be run to it. That gives your work calls the most stable connection.\n" +
          "- If the home is large or on two floors, ask about the mesh extender; one is often included.\n" +
          "- Keep your current service until the new one is working, then cancel and return the old equipment.\n" +
          "- If you rent, tell your landlord, since the installer may need to drill a small hole.\n" +
          "\n" +
          "Run a speed test over a cable on day one, to confirm you are getting the full speed.",
        memories: [
          decision("The user decided to get Google Fiber 1 Gig for home internet.", "Google Fiber"),
        ],
      },
    ],
  },
  {
    title: "Standing desk for the home office",
    at: on(SAT, "11:00", 4),
    turns: [
      {
        question: "I want a standing desk for my home office. Which ones are good under $700?",
        answer:
          "Two good electric standing desks under $700:\n" +
          "\n" +
          "- **Uplift V2**: starts at $599 [1]. Very stable, with a wide choice of desktop sizes and materials, and many accessories you can add later.\n" +
          "- **Flexispot E7**: starts at $499 [2]. A heavy steel frame with two motors, a little cheaper, and often on sale.\n" +
          "\n" +
          "Both are stable at full height, which is the thing that separates a good standing desk from a wobbly one.\n" +
          "\n" +
          "What to compare:\n" +
          "\n" +
          "- **What the price includes**: the starting prices are for the frame with a basic desktop in the smallest size. Larger or solid-wood tops add $100 to $300.\n" +
          "- **Height range**: check it suits your height both sitting and standing.\n" +
          "- **Controls**: both have keypads with memory presets, so one press takes you to your sitting or standing height.\n" +
          "- **Lifting capacity**: both lift well over 100 kg, far more than a computer setup weighs.\n" +
          "\n" +
          "Extras worth budgeting for: an anti-fatigue mat for standing, and a cable tray so wires don't pull when the desk moves. If you tell me your height and what goes on the desk, I can check the fit.",
        sources: pages(
          [
            "Uplift V2 standing desk",
            "https://www.upliftdesk.com/uplift-v2-standing-desk-v2-or-v2-commercial/",
          ],
          ["Flexispot E7", "https://www.flexispot.com/e7"],
        ),
        memories: [
          claim(
            "The Uplift V2 standing desk starts at $599.",
            "https://www.upliftdesk.com/uplift-v2-standing-desk-v2-or-v2-commercial/",
            "Uplift V2",
          ),
          claim(
            "The Flexispot E7 standing desk starts at $499.",
            "https://www.flexispot.com/e7",
            "Flexispot E7",
          ),
        ],
      },
      {
        question: "I'm 190 cm tall. Do they go high enough?",
        answer:
          "Yes. Both reach about 125 cm, and at your height you need about 118 cm.\n" +
          "\n" +
          "How the number is worked out: when you stand, the desktop should be at elbow height, with your forearms level and your shoulders relaxed. For someone of 190 cm, that is roughly 115 to 120 cm, a little more with thick-soled shoes or a mat.\n" +
          "\n" +
          "So you would have 5 to 10 cm to spare at the top, which matters, because desks wobble most when fully extended. A desk used below its maximum is steadier.\n" +
          "\n" +
          "Other things to check at your height:\n" +
          "\n" +
          "- **Sitting height**: you will want about 76 to 80 cm. Both go low enough.\n" +
          "- **Monitor height**: the top of the screen should be at or just below eye level. At 190 cm, a monitor arm or a tall stand is close to essential, or you will look down all day.\n" +
          "- **Depth**: a deeper desktop lets you push the screen further back, which is more comfortable.\n" +
          "\n" +
          "If you add a thick mat or wear shoes with a heel, both desks still have the range. Check the exact maximum for the frame version you order, since some have a shorter or taller variant.",
        memories: [fact("The user is 190 cm tall.")],
      },
      {
        question: "What desktop size for a laptop and one monitor?",
        answer:
          "140 by 70 cm.\n" +
          "\n" +
          "Why that size:\n" +
          "\n" +
          "- **Width**: a laptop on a stand, a 27-inch monitor, a keyboard and a mouse fit side by side with room for a notebook and a cup. At 120 cm it all fits, but with no spare space.\n" +
          "- **Depth**: 70 cm lets you sit 60 to 70 cm from the screen, which is easier on your eyes than a shallow 60 cm desk.\n" +
          "\n" +
          "When to go bigger or smaller:\n" +
          "\n" +
          "- **160 by 80 cm**: if you might add a second monitor, or you like to spread out paper.\n" +
          "- **120 by 60 cm**: only if the room is tight. It works with a monitor arm, which frees the space under the screen.\n" +
          "\n" +
          "Things to check before ordering:\n" +
          "\n" +
          "- Measure the room, and leave about a metre behind the desk for the chair.\n" +
          "- Make sure the desktop is inside the range of widths the frame adjusts to. Both frames take 140 cm.\n" +
          "- A 25 mm thick top is noticeably stiffer than a thin one.\n" +
          "\n" +
          "At 190 cm you will be glad of the extra depth, since your arms and legs need the room.",
        memories: [],
      },
      {
        question: "How long is the warranty?",
        answer:
          "15 years on both frames.\n" +
          "\n" +
          "What the warranty covers on each:\n" +
          "\n" +
          "- **Uplift V2**: 15 years on the frame, the motors, the controller and the electronics, as well as the desktop.\n" +
          "- **Flexispot E7**: 15 years on the frame and motors. The controller and electronics, and the desktop, are covered for a shorter period, so check the current terms on the product page.\n" +
          "\n" +
          "What to know about claims:\n" +
          "\n" +
          "- The parts most likely to fail are the motors and the control box, usually in the first couple of years if at all. Both companies send replacement parts that you fit yourself.\n" +
          "- Keep the order confirmation, since the warranty is for the original buyer.\n" +
          "- Normal wear, scratches and damage from overloading are not covered.\n" +
          "- Both offer a 30-day return window, though you may pay return shipping, and a desk is heavy. Check before ordering.\n" +
          "\n" +
          "A long warranty on a standing desk mostly tells you the maker trusts the motors. In practice the two desks are equally well regarded for reliability.",
        memories: [],
      },
      {
        question: "I'll order the Flexispot.",
        answer:
          "Noted: the Flexispot E7. Assembly takes about an hour, and is easier with two people.\n" +
          "\n" +
          "What to expect:\n" +
          "\n" +
          "- It arrives in two or three heavy boxes: the frame is about 30 kg, and the desktop comes separately.\n" +
          "- You need a Phillips screwdriver, or better, a drill with a screwdriver bit on a low setting. The Allen key is in the box.\n" +
          "- Build it upside down: lay the desktop face down on the cardboard, attach the frame, the control box and the keypad, then turn it over. The turning over is where the second person helps.\n" +
          "\n" +
          "Tips:\n" +
          "\n" +
          "- Before tightening, check the frame is centred and the keypad is on the side you want.\n" +
          "- Plug the motor cables in firmly. A loose cable is the most common cause of an error code.\n" +
          "- Run the reset on first use: hold the down button until the desk reaches the bottom and beeps.\n" +
          "- Save two presets: about 78 cm for sitting and 118 cm for standing.\n" +
          "- Leave slack in every cable, so nothing pulls tight when the desk goes up.\n" +
          "\n" +
          "Start with 20 to 30 minutes of standing at a time, a few times a day.",
        memories: [
          decision("The user decided to buy the Flexispot E7 standing desk.", "Flexispot E7"),
        ],
      },
    ],
  },
  {
    title: "Analytics for the side project",
    at: on(THU, "21:30", 3),
    turns: [
      {
        question:
          "What should the side project use for web analytics? I don't want a cookie banner.",
        answer:
          "Three options that fit, two of them with no cookies at all:\n" +
          "\n" +
          "- **Plausible**: starts at $9/month [1]. Simple, open source and hosted in the EU.\n" +
          "- **Fathom Analytics**: starts at $15/month [2]. Similar in approach, with a very polished dashboard.\n" +
          "\n" +
          "Neither uses cookies, so neither needs a cookie banner.\n" +
          "\n" +
          "- **PostHog**: a free tier of 1 million events a month [3]. A full product analytics tool, with funnels, session recordings and feature flags. It uses cookies by default, but has a cookieless mode.\n" +
          "\n" +
          "How to choose:\n" +
          "\n" +
          "- If you want to know how many people visit, where they come from and which pages they read, pick Plausible or Fathom. They show that on a single page.\n" +
          "- If you want to understand what people do inside the product, such as where they drop out of sign-up, PostHog does much more, at the cost of more setup.\n" +
          "\n" +
          "Why cookieless tools need no banner: they don't store anything on the visitor's device or track people across sites, and they count visits in a way that can't identify a person. If your audience is in Europe, that keeps you on the right side of the privacy rules without a consent pop-up.",
        sources: pages(
          ["Plausible pricing", "https://plausible.io/#pricing"],
          ["Fathom Analytics pricing", "https://usefathom.com/pricing"],
          ["PostHog pricing", "https://posthog.com/pricing"],
        ),
        memories: [
          preference("The user wants web analytics that need no cookie banner."),
          claim("Plausible starts at $9 per month.", "https://plausible.io/#pricing", "Plausible"),
          claim(
            "Fathom Analytics starts at $15 per month.",
            "https://usefathom.com/pricing",
            "Fathom Analytics",
          ),
          claim(
            "PostHog's free tier includes 1 million events per month.",
            "https://posthog.com/pricing",
            "PostHog",
          ),
        ],
      },
      {
        question: "I only need page views and referrers.",
        answer:
          "Then Plausible. It does exactly that on one screen.\n" +
          "\n" +
          "What you see on the dashboard:\n" +
          "\n" +
          "- Visitors and page views over time, with the current number of people on the site.\n" +
          "- **Top sources**: which sites, search engines and campaigns send visitors.\n" +
          "- **Top pages**, and the pages people enter and leave on.\n" +
          "- Countries, devices and browsers.\n" +
          "\n" +
          "There are no menus to learn. You can click any source or page to filter everything else by it.\n" +
          "\n" +
          "Why not the others, for this need:\n" +
          "\n" +
          "- **Fathom Analytics** does the same job well, at $15 against $9 a month.\n" +
          "- **PostHog** is free at your size but is built for product analytics. For page views and referrers, it is more tool than you need.\n" +
          "\n" +
          "Useful extras in Plausible:\n" +
          "\n" +
          "- Tag links with UTM parameters, to see which post or newsletter brought people.\n" +
          "- Define a goal, such as a sign-up, with one line of code.\n" +
          "- A weekly email report, so you don't have to remember to look.\n" +
          "\n" +
          "It has a 30-day free trial, with no card.",
        memories: [],
      },
      {
        question: "Does it slow the page down?",
        answer:
          "No. Its script is under 1 KB.\n" +
          "\n" +
          "For comparison, Google Analytics loads roughly 45 KB or more, so Plausible's script is tens of times smaller.\n" +
          "\n" +
          "Why it has no noticeable effect:\n" +
          "\n" +
          "- It loads with the defer attribute, so the browser fetches it without pausing the page.\n" +
          "- It sets no cookies and makes one small request per page view.\n" +
          "- It is served from a CDN, close to the visitor.\n" +
          "\n" +
          "So it won't affect your Lighthouse score or your Core Web Vitals.\n" +
          "\n" +
          "Two things to do when adding it to a Next.js app:\n" +
          "\n" +
          "- Load it through the Next.js Script component, so it is handled correctly on page changes.\n" +
          "- Check that page views are counted when a visitor moves between pages without a full reload. Plausible's script handles this for the standard router, but test it.\n" +
          "\n" +
          "Optionally, serve the script through your own domain as a proxy. That stops ad blockers hiding some visits, so your numbers are more complete. Plausible's documentation has the Next.js configuration for it.",
        memories: [],
      },
      {
        question: "Plausible it is.",
        answer:
          "Noted: Plausible for the side project's analytics.\n" +
          "\n" +
          "Setup takes about ten minutes:\n" +
          "\n" +
          "1. Create the account and add your domain. The trial runs for 30 days.\n" +
          "2. Add the script to the root layout of the Next.js app, using the Script component.\n" +
          "3. Deploy, open the site, and check the visit appears on the dashboard within a few seconds.\n" +
          "4. Exclude your own visits, either with the browser setting Plausible documents or by blocking the script locally.\n" +
          "\n" +
          "Worth adding in the first week:\n" +
          "\n" +
          "- **A goal for sign-ups**, so you see conversions as well as traffic.\n" +
          "- **UTM tags** on links you share, so each source is counted separately.\n" +
          "- **The proxy** through your own domain, for more accurate numbers.\n" +
          "- **The weekly email report.**\n" +
          "\n" +
          "A note for later: Plausible answers \"how many came, and from where\". If you start to wonder why people don't finish signing up, that is a funnel question, and PostHog's free tier is where to look then.",
        memories: [
          about(
            "side project analytics",
            decision(
              "The user decided to use Plausible for the side project's analytics.",
              "Plausible",
            ),
          ),
        ],
      },
    ],
  },
  {
    title: "Gift for dad's 60th birthday",
    at: on(SUN, "16:00", 3),
    turns: [
      {
        question: "My dad turns 60 on 22 November. He reads a lot. Gift ideas under $200?",
        answer:
          "Two ideas for a keen reader, both under $200:\n" +
          "\n" +
          "- A **Kindle Paperwhite** ($159.99) [1]. The screen reads like paper, with no glare in sunlight, the battery lasts for weeks, and he can make the type as large as he likes. It is waterproof too.\n" +
          "- A year of a book subscription with a good reading light. A new book chosen for him arrives each month, so the present lasts all year.\n" +
          "\n" +
          "How to choose:\n" +
          "\n" +
          "- The Kindle suits someone who reads a lot, travels, or finds small print tiring.\n" +
          "- The subscription suits someone who loves physical books and the pleasure of a parcel in the post.\n" +
          "\n" +
          "Other ideas in the same budget:\n" +
          "\n" +
          "- A signed or first edition of a book he loves.\n" +
          "- A gift card for his favourite bookshop, with a handwritten list of your own recommendations.\n" +
          "- A comfortable reading chair cushion or a proper floor lamp.\n" +
          "\n" +
          "With the birthday on 22 November, order by about the 15th to be safe, or a little earlier if you want anything personalised. If you tell me what he likes to read, I can suggest something more specific.",
        sources: pages(["Kindle Paperwhite", "https://www.amazon.com/dp/B0CFPJYX7P"]),
        memories: [
          fact("The user's father turns 60 on 22 November and reads a lot."),
          claim(
            "The Kindle Paperwhite costs $159.99.",
            "https://www.amazon.com/dp/B0CFPJYX7P",
            "Kindle Paperwhite",
          ),
        ],
      },
      {
        question: "He mostly reads history, in paperback.",
        answer:
          "Then the Kindle still fits. Long history books are heavy, and it lets him enlarge the type.\n" +
          "\n" +
          "Why it suits a reader of history in particular:\n" +
          "\n" +
          "- Big histories often run to 700 pages or more. In paperback they are heavy to hold in bed or in a chair; on a Kindle each one weighs the same as a thin paperback.\n" +
          "- He can change the type size and the font, which helps a lot from 60 onwards.\n" +
          "- Tap a name or a place and a note or dictionary entry pops up, which is handy in books full of unfamiliar people.\n" +
          "- Older and out-of-copyright histories are often free or very cheap.\n" +
          "\n" +
          "What it does less well:\n" +
          "\n" +
          "- Maps, family trees and photographs are small and grey on the screen.\n" +
          "- Flipping back and forth to the notes or the index is slower than in a paper book.\n" +
          "\n" +
          "Some people who love paperbacks never take to a screen, so make it easy for him: load two or three books he'd like before you wrap it, and keep the gift receipt. Many readers end up using both, the Kindle for long books and travel and paper for everything else.",
        memories: [],
      },
      {
        question: "The Kindle then. Should I add a case?",
        answer:
          "Yes, a fabric cover is about $30. It keeps the total under $200: about $190 with the Kindle.\n" +
          "\n" +
          "Why a cover is worth it:\n" +
          "\n" +
          "- It protects the screen in a bag or on a bedside table.\n" +
          "- It opens like a book, which feels more natural to someone who loves paperbacks.\n" +
          "- It wakes the Kindle when opened and puts it to sleep when closed.\n" +
          "- It makes the gift look finished when he unwraps it.\n" +
          "\n" +
          "Before you order, check that the cover matches the exact Paperwhite generation, since the sizes changed between versions.\n" +
          "\n" +
          "To make it feel personal:\n" +
          "\n" +
          "- Set it up on your account first, or as a gift, and load two or three history books you think he would enjoy.\n" +
          "- Add a card with why you chose each book.\n" +
          "- Charge it fully, so he can start reading at once.\n" +
          "\n" +
          "The Kindle comes with a cable but no wall plug, so add a USB plug if he doesn't have a spare. With the birthday on 22 November, ordering in the next week leaves time for delivery and setup.",
        memories: [
          decision(
            "The user decided to give their father a Kindle Paperwhite for his 60th birthday.",
            "Kindle Paperwhite",
          ),
        ],
      },
    ],
  },
  {
    title: "Sales quota planning for Q1",
    at: on(TUE, "15:00", 3),
    turns: [
      {
        question: "Help me plan Q1 quotas. We have 12 account executives and 8 SDRs.",
        answer:
          "Start from the company target and work down: divide it across the 12 account executives, then add 15 to 20% so the team can miss a little and still hit the number.\n" +
          "\n" +
          "The steps:\n" +
          "\n" +
          "1. **Company target for Q1**: the new revenue the business needs from the sales team.\n" +
          "2. **Add the buffer**: multiply by 1.15 to 1.2. Not everyone reaches quota, so the sum of quotas must be higher than the target.\n" +
          "3. **Divide across the account executives**, adjusting for anyone who is new and still ramping.\n" +
          "4. **Check from the bottom up**: is each quota achievable given average deal size, win rate and the pipeline each person can realistically work?\n" +
          "\n" +
          "For the 8 SDRs, set targets in qualified meetings or pipeline created, not revenue. Their numbers should add up to enough pipeline for the account executives: normally three to four times the revenue target.\n" +
          "\n" +
          "Things to adjust for in Q1:\n" +
          "\n" +
          "- January starts slowly after the holidays.\n" +
          "- New hires on a ramp.\n" +
          "- Deals that slipped from Q4 into January.\n" +
          "\n" +
          "If you give me the annual quota per account executive and how long new reps take to ramp, I can put numbers on each step.",
        memories: [fact("The user's sales team has 12 account executives and 8 SDRs.")],
      },
      {
        question: "The annual quota per account executive is $600,000.",
        answer:
          "Then $150,000 a quarter each, or $1.8 million for the 12 in Q1.\n" +
          "\n" +
          "The arithmetic: $600,000 divided by four quarters is $150,000, and times 12 account executives is $1.8 million.\n" +
          "\n" +
          "What that implies:\n" +
          "\n" +
          "- **Company target**: if the sum of quotas carries the usual 15 to 20% buffer, the company's Q1 plan should be about $1.5 million to $1.55 million. If the company needs the full $1.8 million, the quotas are too low to deliver it safely.\n" +
          "- **Deals**: divide $150,000 by your average deal size to see how many deals each rep needs in the quarter.\n" +
          "- **Pipeline**: at a 25% win rate, each rep needs roughly $600,000 of qualified pipeline for the quarter.\n" +
          "\n" +
          "Should every quarter be equal? Not always:\n" +
          "\n" +
          "- Many teams weight the year, for example 22%, 24%, 26% and 28%, because pipeline builds through the year and Q1 starts slowly.\n" +
          "- With that weighting, Q1 would be $132,000 per rep, and $1.58 million for the team.\n" +
          "\n" +
          "Equal quarters are simpler to explain. Weighted quarters are fairer if your sales really are seasonal, so look at last year's bookings by quarter before deciding.",
        memories: [fact("The annual quota per account executive is $600,000.")],
      },
      {
        question: "New reps take about three months to ramp.",
        answer:
          "Give a new rep 25% of quota in month one, 50% in month two and 75% in month three. From month four they carry the full number.\n" +
          "\n" +
          "With your figures: a full monthly quota is $50,000, so a new rep's first three months are $12,500, $25,000 and $37,500. That adds up to $75,000 for their first quarter, half of the normal $150,000.\n" +
          "\n" +
          "What that does to the team number:\n" +
          "\n" +
          "- Each rep who starts on 1 January lowers the Q1 team quota by $75,000.\n" +
          "- With two new reps among the 12, the team's Q1 quota is $1.65 million, not $1.8 million.\n" +
          "- Make sure the company target reflects that, or the experienced reps end up carrying the gap.\n" +
          "\n" +
          "How to pay during ramp:\n" +
          "\n" +
          "- Pay commission at the normal rate against the reduced quota, so a new rep can earn their full variable pay by hitting the ramp numbers.\n" +
          "- Or guarantee part of the variable pay for the first two or three months. That is a non-recoverable draw, and it takes the pressure off while they learn.\n" +
          "\n" +
          "A new rep's first deals often close only in month three or four. Judge the first two months on activity and pipeline built, not on revenue.",
        memories: [fact("New sales reps at the user's company take about three months to ramp.")],
      },
      {
        question: "How many meetings should each SDR book a month?",
        answer:
          "12 to 15 qualified meetings a month each. With 8 SDRs that is about 100 a month, enough for 12 account executives.\n" +
          "\n" +
          "How the numbers connect:\n" +
          "\n" +
          "- 8 SDRs at 12 to 15 meetings is 96 to 120 meetings a month.\n" +
          "- Spread across 12 account executives, that is 8 to 10 new meetings each per month.\n" +
          "- If about half become real opportunities and a quarter of those close, each account executive gets one or two deals a month from SDR meetings.\n" +
          "- For most teams with this ratio, that is roughly half the pipeline an account executive needs. The rest has to come from inbound leads, referrals and the account executives' own prospecting.\n" +
          "\n" +
          "That balance is typical. If you want the SDRs to supply more, you need more of them or better conversion, not a higher target for each one.\n" +
          "\n" +
          "Setting the target well:\n" +
          "\n" +
          "- Count meetings held and accepted by the account executive, not meetings booked.\n" +
          "- Give new SDRs a ramp as well: about half the target in month one.\n" +
          "- Look at conversion from meeting to opportunity each month. If it falls, the SDRs are booking weaker meetings to hit the number.\n" +
          "\n" +
          "Fifteen is a stretch for outbound into mid-sized companies; twelve is a fair starting point.",
        memories: [],
      },
      {
        question: "What attainment should I expect?",
        answer:
          "In a healthy team, 60 to 70% of reps reach quota.\n" +
          "\n" +
          "How to read your own numbers against that:\n" +
          "\n" +
          "- **Above 80%** reaching quota: the quotas are probably too low, and the company is paying full commission for results it would have got anyway.\n" +
          "- **60 to 70%**: about right. Quotas are a stretch but achievable.\n" +
          "- **Below 50%**: quotas are too high, the pipeline is too thin, or there is a hiring or training problem. Morale and turnover suffer quickly.\n" +
          "\n" +
          "Team attainment, which is total sales against total quota, usually comes in at 85 to 100% in a team like this, because a few reps well above quota offset those below.\n" +
          "\n" +
          "For your 12 account executives, that means planning for about 7 or 8 at or above quota, 2 or 3 between 70% and 100%, and 1 or 2 well below.\n" +
          "\n" +
          "This is why the 15 to 20% buffer matters. With $1.8 million of quota and 85 to 90% team attainment, you should expect about $1.55 million to $1.6 million of bookings in Q1.\n" +
          "\n" +
          "Look at the spread as well as the average. If the same people miss every quarter, that is a coaching or hiring question; if everyone misses, look at the quota or the pipeline.",
        memories: [],
      },
    ],
  },
  {
    title: "Team chat: Slack or Teams",
    at: on(FRI, "10:00", 2),
    turns: [
      {
        question:
          "Finance asked whether we should move from Slack to Microsoft Teams to save money. What do they cost?",
        answer:
          "The list prices:\n" +
          "\n" +
          "- **Slack Pro** is $8.75 per user per month, billed annually [1].\n" +
          "- **Microsoft Teams Essentials** is $4 per user per month [2].\n" +
          "\n" +
          "So on price alone, Teams Essentials costs less than half as much.\n" +
          "\n" +
          "What each includes:\n" +
          "\n" +
          "- **Slack Pro**: unlimited message history, group calls with screen sharing, unlimited app integrations, shared channels with other companies, and guest access.\n" +
          "- **Teams Essentials**: chat, meetings of up to 300 people, 10 GB of file storage per user, and recordings. It is the standalone version, without the Office apps or business email.\n" +
          "\n" +
          "What finance should know before comparing only those two numbers:\n" +
          "\n" +
          "- Most companies get Teams as part of Microsoft 365. If you already pay for Microsoft 365, Teams costs nothing extra, and that is the usual source of the saving. If you don't, the comparison is different.\n" +
          "- Moving has costs of its own: migrating history, rebuilding integrations, and retraining everyone.\n" +
          "- The products are not equivalent. Slack is stronger at chat, search and integrations; Teams is stronger at meetings and at working inside Office documents.\n" +
          "\n" +
          "Tell me how many people you have and which office suite you use, and I can work out the real difference.",
        sources: pages(
          ["Slack pricing", "https://slack.com/pricing"],
          [
            "Microsoft Teams pricing",
            "https://www.microsoft.com/en-us/microsoft-teams/compare-microsoft-teams-business-options",
          ],
        ),
        memories: [
          fact("The user's company uses Slack."),
          claim(
            "Slack Pro costs $8.75 per user per month, billed annually.",
            "https://slack.com/pricing",
            "Slack",
          ),
          claim(
            "Microsoft Teams Essentials costs $4 per user per month.",
            "https://www.microsoft.com/en-us/microsoft-teams/compare-microsoft-teams-business-options",
            "Microsoft Teams",
          ),
        ],
      },
      {
        question: "For 40 people, what's the difference per year?",
        answer:
          "Slack is $4,200 a year and Teams $1,920, so the difference is $2,280 a year.\n" +
          "\n" +
          "The arithmetic:\n" +
          "\n" +
          "- **Slack Pro**: 40 users at $8.75 is $350 a month, or $4,200 a year.\n" +
          "- **Teams Essentials**: 40 users at $4 is $160 a month, or $1,920 a year.\n" +
          "\n" +
          "That is $57 per person per year.\n" +
          "\n" +
          "To put the saving in context for finance:\n" +
          "\n" +
          "- $2,280 is roughly the cost of one employee for a week or two, depending on salary.\n" +
          "- If the move costs each of 40 people even two hours of lost time in setup and confusion, that is 80 hours, which is likely worth more than the first year's saving.\n" +
          "- The saving repeats every year, though, and the cost of moving is paid once.\n" +
          "\n" +
          "Other numbers to check:\n" +
          "\n" +
          "- Whether Slack's price holds at renewal. Its list price has gone up before.\n" +
          "- Whether you are paying for inactive Slack accounts. Slack bills only for active members, so removing people who have left may save money with no migration at all.\n" +
          "- Any add-ons on either side, such as Slack's AI features or Teams Premium.",
        memories: [],
      },
      {
        question: "We use Google Workspace, not Microsoft 365.",
        answer:
          "Then Teams loses most of its advantage: its calendar and file features assume Microsoft 365.\n" +
          "\n" +
          "What changes when you are on Google Workspace:\n" +
          "\n" +
          "- **Calendar**: Teams meetings are scheduled through Outlook and Exchange. With Google Calendar, you rely on an add-on that is less smooth, and people end up with two places to look.\n" +
          "- **Files**: Teams stores and co-edits files in SharePoint and OneDrive, in Word, Excel and PowerPoint. Your documents are in Google Docs and Drive, so they would open as links outside Teams, with none of the built-in editing.\n" +
          "- **Sign-in and directory**: Teams wants Microsoft accounts. You would be managing a second set of identities next to Google's.\n" +
          "- **Meetings**: you already have Google Meet in Workspace, so Teams meetings would duplicate something you pay for.\n" +
          "\n" +
          "Slack, by contrast, works well with Google: Calendar, Drive and Meet all have first-class integrations, with file previews and permission prompts in the channel.\n" +
          "\n" +
          "So for a Google Workspace company, moving to Teams Essentials saves $2,280 a year and gives up a setup where chat, calendar and documents fit together. That is rarely worth it. One alternative finance might ask about is Google Chat, which is already included in Workspace at no extra cost.",
        memories: [],
      },
      {
        question: "What would the move itself cost us?",
        answer:
          "Mostly time: rebuilding channels and integrations, and a few weeks of slower communication.\n" +
          "\n" +
          "Where the cost falls:\n" +
          "\n" +
          "- **History**: Slack's message history doesn't move cleanly into Teams. You can export and archive it, or use a paid migration tool, but old conversations won't be searchable in the same way. Many teams end up keeping Slack read-only for months.\n" +
          "- **Integrations**: every app, bot and alert connected to Slack has to be rebuilt or replaced. For an engineering team that means deploy notifications, error alerts and support tools.\n" +
          "- **Workflows**: any Slack workflows and custom commands have to be recreated.\n" +
          "- **Shared channels**: channels shared with customers or partners can't move, and those companies may not use Teams.\n" +
          "- **People**: 40 people learning a new tool and looking for things in the wrong place. Expect two to four weeks of friction.\n" +
          "\n" +
          "A rough estimate:\n" +
          "\n" +
          "- 40 to 80 hours of admin and engineering time for the migration itself.\n" +
          "- A few hours per person in lost productivity.\n" +
          "- Possibly a migration tool, at a few hundred to a few thousand dollars.\n" +
          "\n" +
          "Together that is likely more than the $2,280 saved in the first year, so the move would pay back in year two at the earliest.",
        memories: [],
      },
      {
        question: "We'll stay on Slack.",
        answer:
          "Noted: you'll stay on Slack. $2,280 a year is a fair answer for finance.\n" +
          "\n" +
          "A short summary you can send them:\n" +
          "\n" +
          "- **The saving**: moving to Teams Essentials would save $2,280 a year for 40 people, or $57 per person.\n" +
          "- **The cost of moving**: 40 to 80 hours of setup, lost history, rebuilt integrations and a few weeks of disruption, which is worth more than the first year's saving.\n" +
          "- **The fit**: we use Google Workspace. Teams is built around Microsoft 365, so we would lose the calendar and document integration we have today.\n" +
          "- **Conclusion**: the saving doesn't justify the move.\n" +
          "\n" +
          "Finance will probably ask where else the Slack bill can come down, so it helps to offer something:\n" +
          "\n" +
          "- Deactivate accounts for people who have left, and convert occasional users to guests where the rules allow.\n" +
          "- Check that you are on annual billing, which is cheaper than monthly.\n" +
          "- Review any paid add-ons nobody uses.\n" +
          "- Ask Slack for a discount at renewal; at 40 seats there is sometimes room.\n" +
          "\n" +
          "Set a reminder to look again if the company moves to Microsoft 365 or roughly doubles in size, since either would change the numbers.",
        memories: [
          decision(
            "The user's company decided to stay on Slack and not move to Microsoft Teams.",
            "Slack",
            "Microsoft Teams",
          ),
        ],
      },
    ],
  },
  {
    title: "Lisbon flights and day trips",
    at: on(SAT, "09:30", 2),
    turns: [
      {
        question:
          "For the Lisbon trip we're looking at 14 to 21 March. What do flights from Austin cost?",
        answer:
          "About $780 return per person with one stop, usually through Newark or Boston. There is no direct flight from Austin to Lisbon.\n" +
          "\n" +
          "So for the two of you, plan on about $1,560.\n" +
          "\n" +
          "What to expect:\n" +
          "\n" +
          "- **Routes**: Austin to Newark, Boston, New York JFK or Philadelphia, then overnight to Lisbon. Total travel time is 12 to 15 hours.\n" +
          "- **Airlines**: TAP Air Portugal from the East Coast, and United, Delta or American with their partners.\n" +
          "- **Timing**: mid-March overlaps with spring break in parts of the US, so some dates cost more. Leaving on a Tuesday or Wednesday is usually cheaper than a Friday or Saturday.\n" +
          "\n" +
          "How to get a better price:\n" +
          "\n" +
          "- Set a price alert now for 14 to 21 March, and for a day either side.\n" +
          "- Booking two to three months ahead is usually the best time for transatlantic flights in spring, which means December or early January.\n" +
          "- Compare a single ticket with booking Austin to the East Coast separately. It can be cheaper, but if the first flight is late you are not protected.\n" +
          "- Check the bag fees. The cheapest fares often include only a small cabin bag.\n" +
          "\n" +
          "Fares change daily, so treat $780 as a guide and check the live price before you plan around it.",
        memories: [fact("The user's Lisbon trip is planned for 14 to 21 March.", "Lisbon")],
      },
      {
        question: "Is it worth going up to Porto for a night?",
        answer:
          "Yes. The train takes about three hours, and one night gives you a full day there.\n" +
          "\n" +
          "Why Porto is worth it:\n" +
          "\n" +
          "- It feels different from Lisbon: smaller, steeper and built of granite, with the river running through a gorge in the middle.\n" +
          "- It is very walkable, and the food is excellent, which suits what the two of you like.\n" +
          "- The port wine lodges across the river offer tours and tastings.\n" +
          "\n" +
          "How to fit it into a week:\n" +
          "\n" +
          "- Take a morning train from Lisbon's Santa Apolónia or Oriente station, and arrive before lunch.\n" +
          "- **Afternoon**: the Ribeira riverfront, across the Dom Luís bridge on foot, and a port lodge in Vila Nova de Gaia.\n" +
          "- **Next morning**: the São Bento station tiles, the Lello bookshop if you book ahead, and the Bolhão market.\n" +
          "- Take a late afternoon train back.\n" +
          "\n" +
          "Things to weigh:\n" +
          "\n" +
          "- It costs you about a day and a half of your Lisbon time. With seven nights, that still leaves plenty.\n" +
          "- You could instead fly home from Porto and skip the return train, if the fare is similar.\n" +
          "\n" +
          "Two nights would be more relaxed, but one is enough to see the heart of it.",
        memories: [],
      },
      {
        question: "How do we get to Sintra?",
        answer:
          "By train from Rossio station: 40 minutes, about €5 return. Go early; Pena Palace is crowded by 11:00.\n" +
          "\n" +
          "The details:\n" +
          "\n" +
          "- **Trains** leave Rossio, in the centre of Lisbon and a short walk from Chiado, every 20 to 30 minutes. Buy a ticket at the machines, or load it onto a Viva Viagem card.\n" +
          "- **From Sintra station**, bus 434 runs a loop up the hill to the Moorish Castle and Pena Palace. You can also take a tuk-tuk or a taxi, or walk up through the woods in about an hour, which is steep.\n" +
          "- **Tickets for the sights**: book Pena Palace online in advance, with a timed entry slot. The queue for tickets at the gate can be an hour.\n" +
          "\n" +
          "A plan that works for a day:\n" +
          "\n" +
          "1. Catch a train at about 8:30 and be at Pena by 9:30, when it opens.\n" +
          "2. Walk down to the Moorish Castle.\n" +
          "3. Have lunch in the old town, then visit Quinta da Regaleira in the afternoon. Its gardens and the spiral well are many people's favourite part.\n" +
          "\n" +
          "Don't drive: the roads are narrow, and parking near the palaces is close to impossible. Bring a layer, since Sintra's hill is cooler and mistier than Lisbon, especially in March.",
        memories: [],
      },
      {
        question: "Any good vegetarian restaurants?",
        answer:
          "Two good ones, both fully plant-based:\n" +
          "\n" +
          "- **Ao 26 Vegan Food Project** in Chiado. Creative versions of Portuguese dishes, such as a vegan take on the francesinha sandwich and on bacalhau, in a lively room. It is in the area recommended for your stay, and popular, so book for dinner.\n" +
          "- **The Food Temple** in Mouraria. A small place with a short menu that changes daily and tables outside on a staircase in the old quarter. It is relaxed and inexpensive, and good for a slow evening.\n" +
          "\n" +
          "More that are worth knowing:\n" +
          "\n" +
          "- **Jardim das Cerejas**, near Chiado: a cheap vegetarian buffet, handy for lunch.\n" +
          "- **Arkhe**: a vegetarian fine-dining restaurant, for a special evening.\n" +
          "- **Time Out Market**: several stalls with good vegetarian dishes.\n" +
          "\n" +
          "Eating vegetarian in traditional Portuguese restaurants is harder, since menus lean on fish and pork. A few things help:\n" +
          "\n" +
          "- Ask whether the vegetable soup is made with meat stock or chouriço; it often is.\n" +
          "- Dishes of eggs, cheese, grilled vegetables and rice are usually possible if you ask.\n" +
          "- Pastéis de nata are vegetarian, and they are everywhere.\n" +
          "\n" +
          "In Porto and Sintra, a quick search before lunch saves wandering around hungry.",
        memories: [],
      },
      {
        question: "We'll do one night in Porto and a day in Sintra.",
        answer:
          "Noted: one night in Porto and a day in Sintra. Book the Porto train a month ahead for the cheap fares.\n" +
          "\n" +
          "How the week could look, for 14 to 21 March:\n" +
          "\n" +
          "- **Saturday 14**: arrive, settle into Chiado, an easy walk and an early dinner.\n" +
          "- **Sunday 15**: Baixa, Chiado and the viewpoints.\n" +
          "- **Monday 16**: Alfama and the castle.\n" +
          "- **Tuesday 17**: Sintra by train. A weekday is quieter than the weekend.\n" +
          "- **Wednesday 18**: morning train to Porto, with the afternoon on the riverfront.\n" +
          "- **Thursday 19**: a morning in Porto, and the late afternoon train back.\n" +
          "- **Friday 20**: Belém, and a last dinner.\n" +
          "- **Saturday 21**: fly home.\n" +
          "\n" +
          "What to book, and when:\n" +
          "\n" +
          "- **Flights**: December or early January.\n" +
          "- **Porto train**: tickets go on sale about a month ahead, and the discounted fares sell out first. Book both directions with seats together.\n" +
          "- **Pena Palace**: a timed ticket a week or two ahead.\n" +
          "- **Hotels**: Chiado for the week, and one night in Porto near the Ribeira or São Bento. Ask the Lisbon hotel whether you can leave your big bags there overnight, and travel to Porto with a day bag.",
        memories: [
          decision(
            "The user decided to add one night in Porto and a day trip to Sintra to the Lisbon trip.",
            "Lisbon",
            "Porto",
            "Sintra",
          ),
        ],
      },
    ],
  },
  {
    title: "CI for the side project",
    at: on(SUN, "20:30", 2),
    turns: [
      {
        question: "What's the simplest way to run tests on every push for the side project?",
        answer:
          "**GitHub Actions**. Private repositories get 2,000 free minutes a month [1], and since your code is already on GitHub, there is no other service to sign up for.\n" +
          "\n" +
          "How it works:\n" +
          "\n" +
          "- You add one YAML file to the repository, under .github/workflows.\n" +
          "- On every push or pull request, GitHub starts a fresh virtual machine, checks out your code, installs dependencies and runs your tests.\n" +
          "- The result appears as a tick or a cross next to the commit and on the pull request.\n" +
          "\n" +
          "A minimal workflow for a Next.js project has four steps:\n" +
          "\n" +
          "1. Check out the code.\n" +
          "2. Set up Node.js, with caching of the package manager's downloads turned on.\n" +
          "3. Install dependencies.\n" +
          "4. Run the linter, the type check and the tests.\n" +
          "\n" +
          "Things worth setting from the start:\n" +
          "\n" +
          "- Run on pull requests and on pushes to the main branch.\n" +
          "- Cache dependencies, which usually cuts the run time by a third or more.\n" +
          "- Cancel a run that is still in progress when a newer commit arrives on the same branch.\n" +
          "\n" +
          "Public repositories get unlimited free minutes, so the 2,000-minute allowance only matters while the repository is private.",
        sources: pages([
          "GitHub Actions billing",
          "https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions",
        ]),
        memories: [
          claim(
            "GitHub Actions includes 2,000 free minutes a month for private repositories.",
            "https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions",
            "GitHub Actions",
          ),
        ],
      },
      {
        question: "My tests take about four minutes.",
        answer:
          "Then you can run about 500 times a month for free.\n" +
          "\n" +
          "The arithmetic: 2,000 minutes divided by 4 minutes a run is 500 runs, or about 16 a day.\n" +
          "\n" +
          "For one developer that is plenty. Even with pushes to branches and to main, you are unlikely to pass 200 runs a month.\n" +
          "\n" +
          "Details that affect the count:\n" +
          "\n" +
          "- Minutes are rounded up per job, so a run of 3 minutes 10 seconds counts as 4.\n" +
          "- The free minutes are for Linux runners. macOS and Windows runners use up the allowance many times faster, so stay on Linux.\n" +
          "- If you split the workflow into several parallel jobs, each job's minutes are counted separately.\n" +
          "\n" +
          "Ways to make each run shorter:\n" +
          "\n" +
          "- Cache dependencies, so installation takes seconds.\n" +
          "- Run only the tests affected by a change, if your test runner supports it.\n" +
          "- Skip the workflow for changes that touch only documentation.\n" +
          "- Cancel superseded runs.\n" +
          "\n" +
          "If you ever do run out, extra minutes on Linux cost under a cent each, and you can set a spending limit of $0 so nothing is charged without your say.",
        memories: [],
      },
      {
        question: "Should it deploy too?",
        answer:
          "No. Vercel already deploys on push; let Actions only run the tests and block the merge when they fail.\n" +
          "\n" +
          "Why keeping them separate is better:\n" +
          "\n" +
          "- Vercel's own GitHub integration builds and deploys every push and gives each pull request a preview. Doing the same from Actions would duplicate that and spend your free minutes.\n" +
          "- Two systems deploying the same project can race each other and leave you unsure which build is live.\n" +
          "\n" +
          "How to make the two work together:\n" +
          "\n" +
          "1. Turn on branch protection for the main branch in the GitHub repository settings.\n" +
          "2. Require the test workflow to pass before a pull request can be merged.\n" +
          "3. Work on branches, and merge through pull requests.\n" +
          "\n" +
          "The result:\n" +
          "\n" +
          "- Every pull request gets a Vercel preview and a test result.\n" +
          "- A failing test blocks the merge, so broken code never reaches main.\n" +
          "- Merging to main triggers the production deployment on Vercel.\n" +
          "\n" +
          "One gap to know about: if you push straight to main, Vercel deploys whether or not the tests pass. Branch protection closes it by not allowing direct pushes. If you'd like a stricter setup later, Vercel can also be told to wait for GitHub checks before promoting a build to production.",
        memories: [],
      },
      {
        question: "OK, GitHub Actions for tests only.",
        answer:
          "Noted: GitHub Actions, for tests only.\n" +
          "\n" +
          "To finish the setup:\n" +
          "\n" +
          "1. **Add the workflow file** with the four steps: check out, set up Node.js with caching, install, and run lint, type check and tests.\n" +
          "2. **Push a branch** and open a pull request, to see it run.\n" +
          "3. **Protect main**: require the workflow's check to pass before merging, and don't allow direct pushes.\n" +
          "4. **Add a status badge** to the README if you like seeing it green.\n" +
          "\n" +
          "Things to handle for a project with a database:\n" +
          "\n" +
          "- If the tests need Postgres, add a Postgres service container to the workflow. It starts in a few seconds and gives each run a clean database.\n" +
          "- Put any secrets the tests need in the repository's Actions secrets, not in the workflow file.\n" +
          "- Use separate test values, never production credentials.\n" +
          "\n" +
          "Good habits from here:\n" +
          "\n" +
          "- Keep the run under five minutes. Slow tests get skipped.\n" +
          "- Fix a failing main branch before doing anything else.\n" +
          "- When a test fails now and then for no reason, fix or delete it; unreliable tests teach you to ignore red.",
        memories: [
          decision(
            "The user decided to run the side project's tests on GitHub Actions.",
            "GitHub Actions",
          ),
        ],
      },
    ],
  },
  {
    title: "E-signature tools for contracts",
    at: on(THU, "11:20", 1),
    turns: [
      {
        question:
          "Our sales contracts go out as PDFs by email. Which e-signature tool should we use?",
        answer:
          "Three good options, cheapest first:\n" +
          "\n" +
          "- **Dropbox Sign Essentials** is $15 per user per month [1].\n" +
          "- **PandaDoc Starter** is $19 [2].\n" +
          "- **DocuSign Standard** is $25 [3].\n" +
          "\n" +
          "All three let you upload a PDF, place signature fields, send it for signing and get back a signed copy with an audit trail.\n" +
          "\n" +
          "How they differ:\n" +
          "\n" +
          "- **Dropbox Sign**: the simplest and cheapest. Upload, add fields, send. A good fit if contracts stay as PDFs made elsewhere.\n" +
          "- **PandaDoc**: a document builder as well as a signing tool. You create proposals and contracts inside it from templates, with pricing tables and content blocks, and it tracks when the customer opens them.\n" +
          "- **DocuSign**: the best-known name, which some customers' legal teams prefer, with the most integrations and compliance options.\n" +
          "\n" +
          "Questions that would settle it:\n" +
          "\n" +
          "- How many people send contracts? Pricing is per sender, not per signer.\n" +
          "- Do you want to keep creating the PDF elsewhere, or build the contract in the tool?\n" +
          "- Does it need to connect to your CRM?\n" +
          "\n" +
          "Check the limits on each plan too. Entry tiers often cap the number of documents or templates per month.",
        sources: pages(
          ["Dropbox Sign pricing", "https://sign.dropbox.com/pricing"],
          ["PandaDoc pricing", "https://www.pandadoc.com/pricing/"],
          ["DocuSign pricing", "https://ecom.docusign.com/plans-and-pricing/esignature"],
        ),
        memories: [
          claim(
            "Dropbox Sign Essentials costs $15 per user per month.",
            "https://sign.dropbox.com/pricing",
            "Dropbox Sign",
          ),
          claim(
            "PandaDoc Starter costs $19 per user per month.",
            "https://www.pandadoc.com/pricing/",
            "PandaDoc",
          ),
          claim(
            "DocuSign Standard costs $25 per user per month.",
            "https://ecom.docusign.com/plans-and-pricing/esignature",
            "DocuSign",
          ),
        ],
      },
      {
        question: "Only the 12 account executives send contracts.",
        answer:
          "Then 12 seats: $180, $228 or $300 a month.\n" +
          "\n" +
          "Over a year:\n" +
          "\n" +
          "- **Dropbox Sign Essentials**: 12 at $15 is $180 a month, or $2,160 a year.\n" +
          "- **PandaDoc Starter**: 12 at $19 is $228 a month, or $2,736 a year.\n" +
          "- **DocuSign Standard**: 12 at $25 is $300 a month, or $3,600 a year.\n" +
          "\n" +
          "Only the people who send documents need a seat. Customers who sign, and colleagues who only countersign, don't need one.\n" +
          "\n" +
          "Ways to keep the cost down:\n" +
          "\n" +
          "- These are the annual billing prices; monthly billing costs more per seat.\n" +
          "- If only some account executives send contracts every week, you could start with fewer seats and add more.\n" +
          "- A shared seat for the whole team is against the terms, and it also breaks the audit trail, which should show who sent each contract.\n" +
          "\n" +
          "Before choosing on price alone, check each plan's limits:\n" +
          "\n" +
          "- How many documents or envelopes each seat can send per month or per year.\n" +
          "- How many templates you can save.\n" +
          "- Whether CRM integration is included or needs a higher tier.\n" +
          "\n" +
          "With 12 account executives each closing two or three deals a month, you would send 25 to 40 contracts a month, which is inside the entry plans' limits.",
        memories: [],
      },
      {
        question: "We also want templates with pricing tables.",
        answer:
          "That points to PandaDoc. Pricing tables and a template library are its main strength.\n" +
          "\n" +
          "What you get:\n" +
          "\n" +
          "- **Templates**: build your contract once, with your branding and standard terms, and each rep starts from it. Fields such as the customer's name, dates and amounts fill in automatically.\n" +
          "- **Pricing tables**: add products as line items with quantities, discounts and taxes, and the totals calculate themselves. You can let the customer choose between options or change quantities, and the total updates.\n" +
          "- **Product catalogue**: store your products and prices once, so reps pick from a list and don't type prices by hand.\n" +
          "- **Tracking**: see when the customer opens the document and how long they spend on each page.\n" +
          "\n" +
          "How the others compare on this:\n" +
          "\n" +
          "- **Dropbox Sign** has reusable templates for signature fields on a PDF, but no pricing tables. You would keep building the quote elsewhere.\n" +
          "- **DocuSign Standard** has templates too, though document generation with calculated pricing is a separate, more expensive product.\n" +
          "\n" +
          "One thing to confirm: check that the Starter plan includes the pricing table features you need. Some, such as the product catalogue, approval workflows and CRM integrations, sit in PandaDoc's Business plan, which costs considerably more per seat.",
        memories: [preference("The user wants contract templates with pricing tables.")],
      },
      {
        question: "Are these signatures legally binding in the US?",
        answer:
          "Yes, all three comply with the ESIGN Act and UETA.\n" +
          "\n" +
          "What those laws say:\n" +
          "\n" +
          "- The federal **ESIGN Act** and the **UETA**, which nearly every state has adopted, give an electronic signature the same legal standing as a handwritten one.\n" +
          "- A contract can't be denied effect just because it was signed electronically.\n" +
          "\n" +
          "What makes a signature hold up, which all three tools provide:\n" +
          "\n" +
          "- **Intent to sign**: the signer takes a clear action, such as clicking to sign.\n" +
          "- **Consent** to do business electronically.\n" +
          "- **An audit trail**: who signed, when, from which email address and IP address, with a tamper-evident seal on the final document.\n" +
          "- **A copy** for each party.\n" +
          "\n" +
          "Exceptions to know about:\n" +
          "\n" +
          "- A few kinds of document are excluded, such as wills, some family-law papers and certain notices. Ordinary sales contracts are not among them.\n" +
          "- Some regulated industries add their own requirements.\n" +
          "\n" +
          "For customers outside the US, the same tools support the EU's eIDAS rules and equivalents elsewhere. A standard electronic signature is enough for commercial contracts in most countries.\n" +
          "\n" +
          "This is general information, not legal advice. If your contracts are large or unusual, have your lawyer confirm the signing process once.",
        memories: [],
      },
      {
        question: "PandaDoc then.",
        answer:
          "Noted: PandaDoc, with 12 seats at $228 a month.\n" +
          "\n" +
          "That is $2,736 a year on annual billing.\n" +
          "\n" +
          "A rollout that gets the value quickly:\n" +
          "\n" +
          "1. **Build the master contract template**, with your terms, branding and signature blocks. Have legal approve it once.\n" +
          "2. **Set up the pricing table** with your products and standard prices.\n" +
          "3. **Lock the legal text**, so reps can change the customer details and the pricing but not the terms.\n" +
          "4. **Connect the CRM**, if your plan includes it, so customer and deal details fill in automatically.\n" +
          "5. **Train the 12 account executives** in a 30-minute session: create from the template, send, and track.\n" +
          "\n" +
          "What to watch in the first month:\n" +
          "\n" +
          "- How long from sending to signature, compared with emailing PDFs. It usually falls from days to hours.\n" +
          "- Whether reps actually use the template, or still upload their own PDFs.\n" +
          "- Whether Starter's limits get in the way. If you need approval steps for discounts or a deeper CRM integration, that is the sign to look at the Business plan.\n" +
          "\n" +
          "Start with the 14-day trial and send two or three real contracts through it before you pay for all 12 seats.",
        memories: [
          decision("The user's company decided to use PandaDoc for sales contracts.", "PandaDoc"),
        ],
      },
    ],
  },
  {
    title: "Marathon nutrition",
    at: on(SAT, "08:15", 1),
    turns: [
      {
        question: "What should I eat during long runs?",
        answer:
          "From 90 minutes on, take 30 to 60 g of carbohydrate an hour: one gel every 30 to 40 minutes, with water.\n" +
          "\n" +
          "Why: your body stores enough carbohydrate for roughly 90 minutes to two hours of running. After that, without topping up, you slow down sharply, which runners call hitting the wall.\n" +
          "\n" +
          "How it works on a long run:\n" +
          "\n" +
          "- **Runs under 75 to 90 minutes**: water is enough.\n" +
          "- **Longer runs**: take the first gel at about 45 minutes, before you feel you need it, then one every 30 to 40 minutes.\n" +
          "- **Water**: a few mouthfuls with each gel. Most gels need water to be absorbed properly.\n" +
          "- **Salt**: on hot days or runs over two hours, add an electrolyte tablet to your water.\n" +
          "\n" +
          "One gel has 20 to 25 g of carbohydrate, so two an hour puts you in the middle of the range.\n" +
          "\n" +
          "Alternatives, if you don't like gels:\n" +
          "\n" +
          "- Chews or jelly sweets.\n" +
          "- A sports drink, which combines fluid and carbohydrate.\n" +
          "- Real food, such as dates, a banana or a small boiled potato with salt.\n" +
          "\n" +
          "The most important rule is to practise on every long run. Your stomach needs training just as your legs do, and race day is the wrong time to try something new.",
        memories: [],
      },
      {
        question: "Which gels are easy on the stomach?",
        answer:
          "Two that are known for being gentle:\n" +
          "\n" +
          "- **Maurten Gel 100** ($3.90 each) is the gentlest [1]. It has a firm, jelly-like texture and almost no taste, with no added flavourings or colours. Many runners who feel sick with ordinary gels can take it without trouble.\n" +
          "- **SiS GO Isotonic** needs no water with it [2]. It is thinner and more liquid, so it goes down easily, but each sachet is bulkier for the amount of carbohydrate.\n" +
          "\n" +
          "What makes a gel hard on the stomach:\n" +
          "\n" +
          "- Very concentrated sugar, taken without enough water.\n" +
          "- Caffeine, which some people don't tolerate while running.\n" +
          "- Strong sweet flavours late in a run.\n" +
          "\n" +
          "How to find what suits you:\n" +
          "\n" +
          "- Buy singles of two or three types, and try one type on each long run.\n" +
          "- Take it with water, in small sips.\n" +
          "- Start with half a gel if you are nervous.\n" +
          "- Avoid caffeinated versions until you know the plain one works.\n" +
          "\n" +
          "Maurten is the most expensive option, so some runners train with a cheaper gel and keep Maurten for the longest runs and race day. Find out, too, which brand your marathon hands out on the course; if it suits you, that is fewer to carry.",
        sources: pages(
          ["Maurten Gel 100", "https://www.maurten.com/products/gel-100"],
          [
            "SiS GO Isotonic Energy Gel",
            "https://www.scienceinsport.com/products/go-isotonic-energy-gel",
          ],
        ),
        memories: [
          claim(
            "A Maurten Gel 100 costs $3.90.",
            "https://www.maurten.com/products/gel-100",
            "Maurten",
          ),
        ],
      },
      {
        question: "Are they vegetarian?",
        answer:
          "Yes, both are vegan.\n" +
          "\n" +
          "- **Maurten Gel 100**: made from water, glucose, fructose and two natural gelling agents, alginate from seaweed and pectin from fruit. No gelatine and no animal products.\n" +
          "- **SiS GO Isotonic**: made from maltodextrin, which comes from corn, with water and a gelling agent from plants. The standard range is suitable for vegans.\n" +
          "\n" +
          "Things to check on other gels, since you are vegetarian:\n" +
          "\n" +
          "- **Gelatine** appears in some chews and jelly-type products.\n" +
          '- **Honey** is in a few "natural" gels: fine for vegetarians, not for vegans.\n' +
          "- **Beeswax or shellac** is used as a coating on some sports sweets.\n" +
          "- **Milk protein** appears in some recovery gels and bars.\n" +
          "\n" +
          "Flavours within the same brand can differ, and recipes change, so read the label when you buy a new one.\n" +
          "\n" +
          "Further vegetarian options for long runs: dates, bananas and most sports drinks. For after the run, a recovery drink based on soy or pea protein, or simply chocolate soy milk, gives you the carbohydrate and protein you need.",
        memories: [],
      },
      {
        question: "My goal is to finish in under 4 hours 30.",
        answer:
          "That is 6:24 per km. Plan on seven gels for the race, and practise with them on every long run.\n" +
          "\n" +
          "The arithmetic: 4 hours 30 minutes is 270 minutes, and 270 divided by 42.2 km is 6.4 minutes, or 6 minutes 24 seconds per km. To finish under 4:30 with a small margin, aim for about 6:20.\n" +
          "\n" +
          "A gel plan for the race:\n" +
          "\n" +
          "- First gel at 40 minutes, then one every 35 minutes or so: seven gels by about 4 hours.\n" +
          "- That gives roughly 40 g of carbohydrate an hour, inside the 30 to 60 g range.\n" +
          "- Take each one just before a water station, so you can wash it down.\n" +
          "\n" +
          "What this means for training:\n" +
          "\n" +
          "- **Long runs**: 60 to 90 seconds per km slower than race pace, so about 7:25 to 7:55 per km.\n" +
          "- **Tempo runs**: a little faster than race pace.\n" +
          "- From about week 10, run the last few kilometres of some long runs at 6:24 to learn how the pace feels on tired legs.\n" +
          "\n" +
          "On race day:\n" +
          "\n" +
          "- Start at 6:30 for the first 5 km. Going out too fast is the most common mistake in a first marathon.\n" +
          "- Carry four gels, and pick up the rest on the course if the race provides a brand you have tested.",
        memories: [fact("The user's goal is to finish the marathon in under 4 hours 30 minutes.")],
      },
    ],
  },
  {
    title: "Switching analytics to PostHog",
    at: on(WED, "08:30"),
    turns: [
      {
        question:
          "I want to see sign-up funnels in the side project, and Plausible doesn't really do that. Is PostHog's free tier enough?",
        answer:
          "Yes. Its free tier includes 1 million events a month and has funnels [1]. Set it to cookieless mode and you still need no banner.\n" +
          "\n" +
          "What you get for sign-up funnels:\n" +
          "\n" +
          "- **Funnels**: define the steps, for example landing page, sign-up form, email confirmed and first action, and see how many people make it through each one and where they drop out.\n" +
          "- **Breakdowns**: split the funnel by traffic source, device or country, to see whether one group struggles.\n" +
          "- **Time to convert**: how long people take between steps.\n" +
          "- **Session recordings**, also with a free allowance, to watch what people did just before they gave up.\n" +
          "\n" +
          "On the cookie banner:\n" +
          "\n" +
          "- By default PostHog stores an identifier in a cookie and in local storage.\n" +
          "- You can set its persistence to memory, so nothing is stored on the device. A visitor is then counted as new on each visit, which makes returning-visitor numbers less accurate, but a funnel within a single session still works.\n" +
          "\n" +
          "What changes compared with Plausible:\n" +
          "\n" +
          "- The script is much larger, so load it after the page is interactive.\n" +
          "- The dashboard is far more complex. Build one dashboard with the sign-up funnel and ignore the rest at first.\n" +
          "- You send events from your code for each step you want to measure.",
        sources: pages(["PostHog pricing", "https://posthog.com/pricing"]),
        memories: [fact("The user wants to see sign-up funnels in the side project.")],
      },
      {
        question: "How many events would I use?",
        answer:
          "With 40,000 visits a month, about 200,000 events: well inside the free tier.\n" +
          "\n" +
          "The estimate:\n" +
          "\n" +
          "- A typical visit produces about five events: a page view or two, a couple of automatically captured clicks, and a page leave.\n" +
          "- 40,000 visits times 5 is 200,000 events.\n" +
          "- That is a fifth of the 1 million free events.\n" +
          "\n" +
          "What could push the number up:\n" +
          "\n" +
          "- **Autocapture**, which records every click and form change. It is useful at first but noisy. You can limit it to certain elements or turn it off and send only the events you define.\n" +
          "- **Custom events** you add for each funnel step. These are few and worth it.\n" +
          "- **Bots and crawlers**. PostHog filters the known ones, but check the first week's numbers.\n" +
          "\n" +
          "Billed separately, each with a free allowance of its own:\n" +
          "\n" +
          "- **Session recordings**.\n" +
          "- **Feature flag requests**, if you use them.\n" +
          "\n" +
          "To be safe, set a billing limit of $0 on each product in PostHog's settings. If you ever pass the free allowance, data collection pauses and no charge is made. At your current traffic you have room to grow about five times before that matters.",
        memories: [],
      },
      {
        question: "OK, I'll switch from Plausible to PostHog.",
        answer:
          "Noted: you'll switch from Plausible to PostHog's free tier. Run both for a week so you can compare the numbers before you cancel Plausible.\n" +
          "\n" +
          "Why the overlap helps:\n" +
          "\n" +
          "- The two tools count a little differently, so visitor totals won't match exactly. A week side by side shows you the normal gap, and after that you can trust the new numbers.\n" +
          "- If something in the PostHog setup is wrong, such as missing page views on client-side navigation, you'll see it against Plausible's figures.\n" +
          "\n" +
          "The steps:\n" +
          "\n" +
          "1. **Install PostHog** in the Next.js app, loaded after the page is interactive, with memory persistence for cookieless mode.\n" +
          "2. **Capture page views** on route changes. The Next.js app router needs a small component for this.\n" +
          "3. **Send events** for each sign-up step: form viewed, form submitted, email confirmed.\n" +
          "4. **Build the funnel** from those events, and save it to a dashboard.\n" +
          "5. **Compare** daily visitors with Plausible for a week.\n" +
          "6. **Cancel Plausible** and remove its script, which saves $9 a month.\n" +
          "\n" +
          "Before you cancel, export your Plausible history as a CSV file. The old numbers don't carry over, and you may want them for comparison later.",
        memories: [
          about(
            "side project analytics",
            decision(
              "The user decided to switch the side project's analytics from Plausible to PostHog's free tier.",
              "PostHog",
              "Plausible",
            ),
          ),
        ],
      },
    ],
  },
  {
    title: "Vercel bill after a traffic spike",
    at: on(SAT, "21:00"),
    turns: [
      {
        question:
          "The side project hit the front page of Hacker News and got 40,000 visits this week. Will my Vercel bill jump?",
        answer:
          "Unlikely. 40,000 visits is a few GB of bandwidth, and Pro includes 1 TB [1].\n" +
          "\n" +
          "The estimate:\n" +
          "\n" +
          "- A typical visit loads one to three pages, at 1 to 2 MB each with scripts and images, so about 2 to 5 MB a visit.\n" +
          "- 40,000 visits is then roughly 80 to 200 GB at the very most, and usually far less, because browsers cache scripts and Vercel compresses responses.\n" +
          "- Even the high end is a fifth of the 1 TB that Pro includes.\n" +
          "\n" +
          "So bandwidth won't add to the bill this month.\n" +
          "\n" +
          "What to look at instead, since these are metered separately:\n" +
          "\n" +
          "- **Function invocations**, if pages are rendered on the server or call API routes.\n" +
          "- **Image optimisation**, if the site shows many distinct images.\n" +
          "- **Edge requests**, which count every request, including static files.\n" +
          "\n" +
          "How to check where you stand:\n" +
          "\n" +
          "- Open the Usage tab in the Vercel dashboard. It shows each metered item against its included amount for the current billing period.\n" +
          "- Look at which paths use the most.\n" +
          "\n" +
          "Congratulations on the front page, by the way. If the traffic keeps coming, caching your most visited pages will keep every one of these numbers low.",
        sources: pages(["Vercel pricing", "https://vercel.com/pricing"]),
        memories: [
          fact(
            "The side project got about 40,000 visits in a week after reaching the front page of Hacker News.",
          ),
        ],
      },
      {
        question: "What about function invocations?",
        answer:
          "Pro includes 1 million a month. If each visit makes five calls you are at 200,000.\n" +
          "\n" +
          "The arithmetic: 40,000 visits times 5 function calls is 200,000 invocations, a fifth of the allowance.\n" +
          "\n" +
          "So you are fine on the count. Vercel also bills for how long functions run and how much memory they use, so look at that line on the Usage tab as well: a function that waits two seconds on a slow database query costs more than one that returns in 50 ms.\n" +
          "\n" +
          "What counts as an invocation:\n" +
          "\n" +
          "- A page rendered on the server for each request.\n" +
          "- An API route or a server action.\n" +
          "- Middleware, which runs on every matching request and is easy to forget.\n" +
          "\n" +
          "Ways to cut the number:\n" +
          "\n" +
          "- **Render pages statically** where the content is the same for everyone, and revalidate them every few minutes. A cached page costs no function call.\n" +
          "- **Narrow the middleware matcher**, so it skips static files and images.\n" +
          "- **Cache API responses** that don't change per user.\n" +
          "- **Avoid polling** from the browser. A page that refetches every few seconds multiplies invocations.\n" +
          "\n" +
          "For a landing page that many people open at once, static rendering is the biggest win: the page is served from the CDN, and your database never sees the spike.",
        memories: [],
      },
      {
        question: "Should I set a spend limit anyway?",
        answer:
          "Yes. Set spend management to pause the project at $40 a month.\n" +
          "\n" +
          "Why $40: your normal bill is $20 for the Pro seat. A limit of $40 allows up to $20 of extra usage, which covers a busy month, and stops anything worse.\n" +
          "\n" +
          "How to set it:\n" +
          "\n" +
          "1. In the Vercel dashboard, open the team's settings, then Billing, then Spend Management.\n" +
          "2. Set the amount, and choose what happens when it is reached.\n" +
          "3. Turn on notifications at 50%, 75% and 100%.\n" +
          "\n" +
          "The choice to understand:\n" +
          "\n" +
          "- **Pause projects**: when the limit is reached, your site goes offline until you resume it. That is the right setting for a side project where a surprise bill is worse than downtime.\n" +
          "- **Notify only**: the site stays up and you get an alert. Better if the site earns money and downtime costs more than the overage.\n" +
          "\n" +
          "Things to know:\n" +
          "\n" +
          "- The limit applies to usage on top of the plan, and checks run every few minutes, so the final figure can go slightly past the limit.\n" +
          "- A paused project shows visitors an error page, so act on the 75% alert and don't wait for the pause.\n" +
          "\n" +
          "Also turn on the firewall's attack protection, which costs nothing and stops the commonest cause of a runaway bill.",
        memories: [],
      },
      {
        question: "Done, I set it to $40.",
        answer:
          "Noted: a $40 monthly spend limit on the Vercel account.\n" +
          "\n" +
          "That puts a ceiling on the bill, so you can let the traffic come without watching the dashboard.\n" +
          "\n" +
          "A few follow-ups while the spike is fresh:\n" +
          "\n" +
          "- **Check the alerts** go to an email address you read, and add a phone notification if you want to hear at 75%.\n" +
          "- **Look at the Usage tab** now, and again in a week. It tells you what a 40,000-visit week actually cost, which is a useful number for next time.\n" +
          "- **Cache the landing page** as a static page if it isn't already, so the next spike costs almost nothing.\n" +
          "- **Watch the database too.** Its usage and connections are billed and limited separately from Vercel, and a spike hits both.\n" +
          "\n" +
          "If a spike ever does pause the project:\n" +
          "\n" +
          "1. You'll get an email.\n" +
          "2. Raise the limit or resume the project in the dashboard, which takes effect within a minute or two.\n" +
          "3. Find the path that used the most, and cache it.\n" +
          "\n" +
          "Now is a good time, too, to see where those 40,000 visitors went after the front page, and how many signed up.",
        memories: [
          decision(
            "The user set a $40 monthly spend limit on the side project's Vercel account.",
            "Vercel",
          ),
        ],
      },
    ],
  },
  {
    title: "Backups for the Neon database",
    at: on(SUN, "21:15"),
    turns: [
      {
        question: "Now that the side project is on Neon, how do backups work?",
        answer:
          "Neon keeps a history you can restore from to any moment: 7 days on the Launch plan [1].\n" +
          "\n" +
          "How it works:\n" +
          "\n" +
          "- Neon stores every change to the database as it happens, not as a nightly snapshot.\n" +
          "- You can restore to any second within the history window, for example to one minute before a bad migration ran.\n" +
          "- A restore is done by creating a branch from that point in time. It takes a few seconds, whatever the size of the database.\n" +
          "- You can inspect the branch to check it has what you need, then switch the app to it or copy the missing rows back.\n" +
          "\n" +
          "What this protects you from:\n" +
          "\n" +
          "- A deleted table or a bad update.\n" +
          "- A migration that goes wrong.\n" +
          "- A bug that corrupts data over a few hours, as long as you notice within 7 days.\n" +
          "\n" +
          "What it doesn't protect you from:\n" +
          "\n" +
          "- Problems you notice after 7 days.\n" +
          "- Losing access to the Neon account or project itself, or deleting the project by accident.\n" +
          "- An outage at Neon.\n" +
          "\n" +
          "The history counts towards your storage bill, so a longer window costs a little more. For a side project, 7 days is a sensible setting; pair it with an occasional export held somewhere else.",
        sources: pages(["Neon pricing", NEON]),
        memories: [
          claim(
            "Neon's Launch plan keeps 7 days of history for point-in-time restore.",
            NEON,
            "Neon",
          ),
        ],
      },
      {
        question: "I'd like a copy outside Neon as well.",
        answer:
          "A good idea. Run pg_dump every night from GitHub Actions and upload the file to object storage.\n" +
          "\n" +
          "Why an outside copy matters: Neon's history protects you from mistakes inside the database, but not from losing the account, deleting the project or a problem at the provider. A dump file stored elsewhere covers those.\n" +
          "\n" +
          "How to set it up:\n" +
          "\n" +
          "1. **A scheduled workflow** in your repository, with a cron trigger for a quiet hour, such as 03:00 UTC.\n" +
          "2. **Install the Postgres client** in the job, matching your database's major version. An older pg_dump refuses to dump a newer server.\n" +
          "3. **Run pg_dump** in custom format, which is compressed and lets you restore single tables. Use Neon's direct connection string, not the pooled one.\n" +
          "4. **Upload the file** to object storage, with the date in its name.\n" +
          "5. **Delete old files** with a lifecycle rule on the storage bucket.\n" +
          "\n" +
          "Details that matter:\n" +
          "\n" +
          "- Keep the connection string and the storage keys in the repository's Actions secrets.\n" +
          "- The job wakes the database each night, which uses a few minutes of compute.\n" +
          "- For a 1 GB database, the dump takes a minute or two and compresses to a fraction of that size.\n" +
          "- Have the workflow fail loudly, so you hear about it when a backup doesn't run.",
        memories: [],
      },
      {
        question: "Where should I store the dumps cheaply?",
        answer:
          "**Cloudflare R2**. The first 10 GB are free, and it never charges for downloads [2].\n" +
          "\n" +
          "Why it fits:\n" +
          "\n" +
          "- A compressed dump of a 1 GB database is perhaps 200 to 300 MB. Thirty nightly copies come to 6 to 9 GB, inside the free allowance.\n" +
          "- Restoring means downloading. Most storage services charge for that; R2 doesn't.\n" +
          "- You already have a Cloudflare account for the domain.\n" +
          "- It speaks the same API as Amazon S3, so every backup tool and the AWS command line work with it.\n" +
          "\n" +
          "Setting it up:\n" +
          "\n" +
          "1. Create a bucket in the Cloudflare dashboard, and leave it private.\n" +
          "2. Create an API token limited to that bucket, with write access for the workflow.\n" +
          "3. Add a lifecycle rule that deletes objects after 30 days.\n" +
          "4. In the workflow, upload with the AWS command line pointed at your R2 endpoint.\n" +
          "\n" +
          "Alternatives:\n" +
          "\n" +
          "- **Backblaze B2** is also very cheap, with 10 GB free.\n" +
          "- **Amazon S3** costs pennies at this size but charges for downloads.\n" +
          "\n" +
          "This is separate from Neon's own 7-day history [1], which stays your first resort for quick restores. The R2 copy is for the day when Neon itself is not available to you.",
        sources: pages(
          ["Neon pricing", NEON],
          ["Cloudflare R2 pricing", "https://developers.cloudflare.com/r2/pricing/"],
        ),
        memories: [
          claim(
            "Cloudflare R2 includes 10 GB of free storage and charges nothing for downloads.",
            "https://developers.cloudflare.com/r2/pricing/",
            "Cloudflare R2",
          ),
        ],
      },
      {
        question: "OK: a nightly pg_dump to R2.",
        answer:
          "Noted: a nightly pg_dump to R2. Keep 30 days of dumps, and try a restore once.\n" +
          "\n" +
          "Why 30 days: it covers problems you notice late, well past the 7 days of Neon's own history, and at your database size it still fits in R2's free 10 GB.\n" +
          "\n" +
          "Why a restore test matters: a backup you have never restored is a hope, not a backup. Dumps fail silently more often than people expect, through a wrong version, a missing extension or an empty file from an expired password.\n" +
          "\n" +
          "A restore test, in ten minutes:\n" +
          "\n" +
          "1. Download last night's dump from R2.\n" +
          "2. Create a new Neon branch or a scratch database.\n" +
          "3. Run pg_restore into it.\n" +
          "4. Check the row counts on two or three main tables against production.\n" +
          "5. Delete the scratch database.\n" +
          "\n" +
          "To keep it trustworthy:\n" +
          "\n" +
          "- Have the workflow check that the dump file is larger than a minimum size before it uploads.\n" +
          "- Send yourself a notification when the job fails.\n" +
          "- Repeat the restore test every few months, and after any major Postgres upgrade.\n" +
          "- Write the restore steps in the repository's README, so that in a real emergency you only have to follow them.\n" +
          "\n" +
          "With Neon's point-in-time history for quick fixes and the R2 copies for disasters, the side project's data is well covered.",
        memories: [
          decision(
            "The user decided to back up the side project's database every night with pg_dump to Cloudflare R2.",
            "Cloudflare R2",
            "Neon",
          ),
        ],
      },
    ],
  },
  {
    title: "Pipedrive price increase",
    topic: "CRM shortlist",
    at: on(TUE, "14:10"),
    turns: [
      {
        question: "A rep told me Pipedrive just raised its prices. What is the Growth plan now?",
        answer:
          "Yes, the price went up. **Pipedrive Growth** is now $39 per user per month, billed annually, up from $34 [1].\n" +
          "\n" +
          "That is $5 more per user per month, an increase of about 15%.\n" +
          "\n" +
          "What it means for your shortlist:\n" +
          "\n" +
          "- When we made the shortlist, Pipedrive was already the most expensive of the five at $34. At $39 the gap is wider.\n" +
          "- It is still under your limit of $50 per user per month.\n" +
          "- The other four prices on the list have not changed as far as I know: Freshsales Growth at $9, HubSpot Sales Hub Starter at $15, Zoho CRM Professional at $23 and Salesforce Starter Suite at $25.\n" +
          "\n" +
          "Compared with HubSpot, which you are also trialling, Pipedrive now costs $24 more per user per month where it was $19 more.\n" +
          "\n" +
          "Things to check on Pipedrive's pricing page:\n" +
          "\n" +
          "- Whether the features in Growth changed along with the price. Vendors often rename or regroup plans when they raise prices.\n" +
          "- The monthly billing price, which is higher than the annual one.\n" +
          "- Whether there is an introductory discount for new customers.\n" +
          "\n" +
          "It is worth asking Pipedrive's sales team whether they will honour the old price for a team that was already in a trial when it changed.",
        sources: pages(["Pipedrive pricing", "https://www.pipedrive.com/en/pricing"]),
        memories: [
          about(
            "Pipedrive Growth plan price",
            claim(
              "Pipedrive's Growth plan now costs $39 per user per month, billed annually.",
              "https://www.pipedrive.com/en/pricing",
              "Pipedrive",
            ),
          ),
        ],
      },
      {
        question: "Does the trial we started keep the old price?",
        answer:
          "No. A trial has no price lock: you pay the price on the day you subscribe.\n" +
          "\n" +
          "How it works:\n" +
          "\n" +
          "- A trial gives you access, not a contract. No price is agreed until you choose a plan and enter payment details.\n" +
          "- The price shown at checkout on the day you subscribe is the one that applies, so that is now $39 per user per month on annual billing.\n" +
          "- Once you subscribe annually, that price is fixed until your renewal date, even if the list price rises again during the year.\n" +
          "\n" +
          "What you can try:\n" +
          "\n" +
          "- **Ask.** Contact Pipedrive's sales team, say you started the trial at $34 and are choosing between them and HubSpot for 25 seats. Vendors can often apply a discount for a team that size, especially near the end of a quarter.\n" +
          "- **Ask for a longer commitment discount**, such as two years at the old rate.\n" +
          "- **Get it in writing** before you subscribe, as a quote with the per-seat price and the term.\n" +
          "\n" +
          "Whatever they say, compare on the real quotes. The $5 difference matters less than which tool your five trial reps actually preferred, but a 15% rise during a trial is fair to raise in the negotiation.",
        memories: [],
      },
      {
        question: "What is that per year for 25 of us?",
        answer:
          "25 seats at $39 a month is $11,700 a year, against $10,200 at the old price.\n" +
          "\n" +
          "The arithmetic:\n" +
          "\n" +
          "- **New price**: 25 times $39 is $975 a month, or $11,700 a year.\n" +
          "- **Old price**: 25 times $34 is $850 a month, or $10,200 a year.\n" +
          "- **Difference**: $1,500 a year.\n" +
          "\n" +
          "Next to the other tool you are trialling:\n" +
          "\n" +
          "- **HubSpot Sales Hub Starter** for 25 seats is $4,500 a year.\n" +
          "- So Pipedrive now costs $7,200 a year more than HubSpot, where the gap was $5,700 at the old price.\n" +
          "\n" +
          "For the rest of the shortlist at 25 seats: Freshsales Growth is $2,700, Zoho CRM Professional is $6,900 and Salesforce Starter Suite is $7,500 a year.\n" +
          "\n" +
          "How to weigh it:\n" +
          "\n" +
          "- $7,200 a year is $288 per rep. If Pipedrive's pipeline view helps each rep close even one extra deal a year at your $18,000 average, it pays for itself many times over.\n" +
          "- If the trial shows the reps are equally happy in both, the cheaper tool wins.\n" +
          "\n" +
          "These are annual billing prices before tax and before any add-ons. Ask both vendors for a written quote for 25 seats before you decide.",
        memories: [],
      },
    ],
  },
];
