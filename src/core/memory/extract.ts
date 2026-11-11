import { z } from "zod";
import type { StructuredLlm } from "@/adapters/llm";
import type { StoredMessage } from "@/shared/dto";
import type { Source } from "@/shared/events";
import { MEMORY_KINDS, type MemoryStore, type NewMemory, type Turn } from "./memories";
import type { Store } from "./store";

const EARLIER_MESSAGES = 4;
const MESSAGE_CHARS = 4000;
const TITLE_CHARS = 80;

// Strict structured output needs every field present, so "absent" is null rather than optional.
const Extraction = z.object({
  title: z.string().nullable(),
  memories: z.array(
    z.object({
      kind: z.enum(MEMORY_KINDS),
      text: z.string(),
      topic: z.string(),
      entities: z.array(z.string()),
      source: z.number().nullable(),
    }),
  ),
});
type Extracted = z.infer<typeof Extraction>["memories"][number];

export const EXTRACTION_PROMPT = `You keep the long-term memory of a research assistant. From the latest turn of a conversation, pick out what would help in later conversations with this user, possibly weeks from now.

Kinds of memory:
- preference: how the user likes things done, or what they want to avoid. "The user prefers EU-hosted services."
- fact: something about the user, their team, company or situation. "The user's sales team has 20 people."
- decision: a choice, shortlist or plan the user made or agreed to. "The user shortlisted HubSpot, Pipedrive and Close as CRM options."
- claim: a specific fact in the assistant's answer that can change over time: a price, plan limit, version, release or date. Only when the answer cites a source for it; set source to that number, e.g. 2 for [2].

Rules:
- Each text is one sentence that makes sense on its own: use names instead of "it" or "they", and keep amounts, units and dates exactly as written.
- Write about the user in the third person ("The user ...").
- topic: 2-4 words for the subject area, e.g. "Postgres hosting" or "CRM tools".
- entities: the products, companies, people or places the memory is about, as they are named.
- source: the citation number for a claim; null for the other kinds.
- Use only what this turn says. Skip greetings, questions that carry no information, and anything listed as already saved.
- Keep every price and plan detail the answer cites. Otherwise prefer a few precise memories to many vague ones, and return an empty list when nothing is worth keeping.
- title: on the first turn of a conversation, a 3-6 word title for it; otherwise null.`;

export type ExtractDeps = { store: Store; memories: MemoryStore; llm: StructuredLlm };

/**
 * Turns the user's new conversation turns into memories. It runs after the answer has been
 * sent, so the user never waits for it. A failed turn is logged and skipped: the log still has
 * it, and `npm run reindex` rebuilds every memory from the log.
 */
export async function memorize(deps: ExtractDeps, userId: string): Promise<void> {
  for (const turn of deps.memories.pending(userId)) {
    try {
      await memorizeTurn(deps, userId, turn);
    } catch (error) {
      console.error(`Memory extraction failed for message ${turn.answerId}:`, error);
      deps.memories.save(userId, turn, []);
    }
  }
}

async function memorizeTurn(deps: ExtractDeps, userId: string, turn: Turn): Promise<void> {
  const session = deps.store.messages(userId, turn.sessionId);
  const at = session.findIndex((message) => message.id === turn.answerId);
  const [question, answer] = [session[at - 1], session[at]];
  if (question?.role !== "user" || !answer) {
    deps.memories.save(userId, turn, []);
    return;
  }
  const firstTurn = at === 1;
  const extracted = await deps.llm({
    name: "memories",
    schema: Extraction,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: describeTurn({
          date: answer.createdAt.slice(0, 10),
          firstTurn,
          earlier: session.slice(Math.max(0, at - 1 - EARLIER_MESSAGES), at - 1),
          saved: deps.memories.textsOfSession(userId, turn.sessionId),
          question,
          answer,
        }),
      },
    ],
  });
  deps.memories.save(
    userId,
    turn,
    extracted.memories.flatMap((memory) => toMemory(memory, answer.sources)),
  );
  const title = extracted.title?.trim();
  if (firstTurn && title) deps.store.setTitle(userId, turn.sessionId, title.slice(0, TITLE_CHARS));
}

/** Claims must cite one of the answer's sources; that is where their URL comes from. */
function toMemory(memory: Extracted, sources: Source[]): NewMemory[] {
  const text = memory.text.trim();
  const source = sources.find((s) => s.n === memory.source);
  if (!text || (memory.kind === "claim" && !source)) return [];
  return [
    {
      kind: memory.kind,
      text,
      topic: memory.topic.trim(),
      entities: memory.entities,
      sourceUrl: memory.kind === "claim" ? source?.url : undefined,
    },
  ];
}

function describeTurn(turn: {
  date: string;
  firstTurn: boolean;
  earlier: StoredMessage[];
  saved: string[];
  question: StoredMessage;
  answer: StoredMessage;
}): string {
  const sources = turn.answer.sources.map((s) => `[${s.n}] ${s.title} - ${s.url}`);
  return [
    `Date of the conversation: ${turn.date}`,
    `First turn of the conversation: ${turn.firstTurn ? "yes" : "no"}`,
    section("Earlier in the conversation", turn.earlier.map(line)),
    section(
      "Already saved from this conversation",
      turn.saved.map((text) => `- ${text}`),
    ),
    section("Latest turn", [line(turn.question), line(turn.answer)]),
    section("Sources cited in the answer", sources),
  ].join("\n\n");
}

function section(heading: string, lines: string[]): string {
  return `${heading}:\n${lines.length ? lines.join("\n") : "(none)"}`;
}

function line(message: StoredMessage): string {
  const who = message.role === "user" ? "User" : "Assistant";
  return `${who}: ${message.content.slice(0, MESSAGE_CHARS)}`;
}
