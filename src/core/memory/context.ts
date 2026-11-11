import type { Embedder } from "@/adapters/embedder";
import type { StoredMessage } from "@/shared/dto";
import { type DayRange, formatDay, mentionedDates } from "./dates";
import { type Memory, type MemoryStore, normalize } from "./memories";
import type { LoggedMessage, Store } from "./store";

const MESSAGES_PER_RANGE = 40;
const QUESTION_CHARS = 500;
const ANSWER_CHARS = 400;
// Memories of the conversations a date points to: those answers are quoted cut short.
const MEMORIES_FROM_DATES = 16;
const KEYWORD_MATCHES = 12;
// By meaning: the closest few, and only if they are close at all. Below this cosine similarity,
// the sample history's matches were unrelated ("Thanks!" scores 0.18 against its nearest memory).
const NEAREST = 8;
const MIN_SIMILARITY = 0.25;
const MEMORIES_PER_ENTITY = 5;
const MAX_MEMORIES = 24;
// How much each way of finding a memory counts when the lists are merged. A day the user named
// is the strongest signal; a memory that only shares a product with another find is the weakest.
const WEIGHTS = { date: 3, keyword: 1, meaning: 1, named: 1, related: 0.5 };
// A conversation is a unit: if a search finds part of a shortlist, the rest of it belongs too.
// So the memories of the conversations the best finds come from are added.
const CONVERSATIONS_TO_COMPLETE = 2;
const MEMORIES_PER_CONVERSATION = 12;
// The usual constant of reciprocal rank fusion: it flattens the gap between ranks 1 and 2.
const RRF_K = 60;
const RECENT_SESSIONS = 20;

// Words that would match almost every memory.
const STOPWORDS = new Set(
  (
    "a about after again all also am an and any are as ask asked at be been before but by can " +
    "could did do does for from get got had has have he her him his how i if in into is it its " +
    "just last let me more most my no not now of on or our out please said say she since so " +
    "some still tell than that the their them then there these they this those to told too us " +
    "very was we were what when where which who why will with would you your " +
    // What an apostrophe leaves behind ("we're", "I've"), and "per", which is in every price.
    "re ve ll don didn doesn isn im per"
  ).split(" "),
);

export type ContextDeps = {
  store: Store;
  memories: MemoryStore;
  /** Without it, or while its model loads, recall works by date, keyword and name only. */
  embedder?: Pick<Embedder, "embedIfReady">;
};
export type ContextInput = {
  userId: string;
  sessionId: string;
  message: string;
  /** The last few messages of this session, to resolve "them" and "it". */
  recent: StoredMessage[];
  now: Date;
  timeZone: string;
};

/**
 * What the agent knows beyond this session, built in code on every turn with no call to a
 * language model: conversations on the days the message mentions, saved memories from them and
 * memories that match the message by keyword, meaning or product name, and the list of recent
 * conversations. An empty section says so, so the
 * model can tell "nothing happened" apart from "not shown".
 */
export async function buildContext(deps: ContextDeps, input: ContextInput): Promise<string> {
  const dates = datesSection(deps.store, input);
  const meaning = await deps.embedder?.embedIfReady(input.message);
  return [
    `Now: ${formatNow(input.now, input.timeZone)}`,
    ...dates.lines,
    memoriesSection(deps.memories, input, dates.sessionIds, meaning),
    sessionsSection(deps.store, input),
    ...dates.notes,
  ].join("\n\n");
}

function datesSection(store: Store, input: ContextInput) {
  const { userId, sessionId, message, now, timeZone } = input;
  const seen = new Set<string>();
  const sessionIds = new Set<string>();
  const notes: string[] = [];
  const lines = mentionedDates(message, now, timeZone).flatMap(({ phrase, ranges }) => {
    const labels = ranges.map((range) => range.label);
    const days = ranges.flatMap((range) => {
      if (seen.has(range.label)) return []; // "on Monday ... since Monday"
      seen.add(range.label);
      const messages = store.messagesBetween(userId, range, sessionId, MESSAGES_PER_RANGE);
      for (const m of messages) sessionIds.add(m.sessionId);
      const titles = [...new Set(messages.map((m) => `"${m.sessionTitle}"`))];
      // Last in the context, right before the question. Seen live: asked "what did I ask that
      // day, and is it still right?", the model named only the conversation worth checking,
      // whatever the system prompt or the day's heading said.
      if (titles.length > 1) {
        notes.push(
          `Note: ${range.label} has ${titles.length} separate conversations: ${titles.join(", ")}. ` +
            "If the user asks what they asked or discussed that day, begin the answer with one " +
            `sentence that names all ${titles.length}, before any detail or checking. If they ` +
            "name a topic, use only the one that matches.",
        );
      }
      return [{ range, messages }];
    });
    const meaning =
      ranges.length === 1
        ? `"${phrase}" means ${labels[0]}.`
        : `"${phrase}" could mean ${labels.join(" or ")}; all are shown.${bestFit(message, days)}`;
    return [meaning, ...days.map((day) => conversationsOn(day.range, day.messages, timeZone))];
  });
  return { lines, notes, sessionIds: [...sessionIds] };
}

/**
 * When a phrase like "last Tuesday" could be two days, says which day's conversations share the
 * most words with the message, if one clearly does.
 */
function bestFit(message: string, days: { range: DayRange; messages: LoggedMessage[] }[]): string {
  const terms = keywords(message);
  const scored = days
    .map(({ range, messages }) => {
      const words = new Set(normalize(messages.map((m) => m.content).join(" ")).split(" "));
      return { label: range.label, score: terms.filter((term) => words.has(term)).length };
    })
    .sort((a, b) => b.score - a.score);
  const [best, next] = scored;
  if (!best || best.score === 0 || best.score === next?.score) return "";
  return ` The conversations on ${best.label} fit this message best.`;
}

function conversationsOn(range: DayRange, messages: LoggedMessage[], timeZone: string): string {
  const heading = `Conversations on ${range.label}, apart from this one`;
  if (messages.length === 0) return `${heading}: none.`;
  const bySession = new Map<string, LoggedMessage[]>();
  for (const message of messages) {
    bySession.set(message.sessionId, [...(bySession.get(message.sessionId) ?? []), message]);
  }
  const blocks = [...bySession.values()].map((session) => {
    const lines = session.map((m) => {
      const time = formatTime(m.createdAt, timeZone);
      if (m.role === "user") return `  ${time} User: ${cut(m.content, QUESTION_CHARS)}`;
      // Old citation numbers would clash with this turn's, so list the pages instead.
      const answer = cut(m.content.replace(/\s*\[\d+\]/g, ""), ANSWER_CHARS);
      const pages = m.sources.map((s) => s.url).join(", ");
      return `  ${time} You: ${answer}${pages ? `\n  Pages cited: ${pages}` : ""}`;
    });
    return [`- "${session[0]?.sessionTitle}"`, ...lines].join("\n");
  });
  return [`${heading}:`, ...blocks].join("\n");
}

function memoriesSection(
  memories: MemoryStore,
  input: ContextInput,
  sessionIds: string[],
  meaning: Float32Array | undefined,
) {
  const { userId, message, recent, timeZone } = input;
  const query = keywordQuery(message);
  const entityIds = mentionedEntities(memories, userId, [message, ...recent.map((m) => m.content)]);
  const byDate = memories.fromSessions(userId, sessionIds, MEMORIES_FROM_DATES);
  const byKeyword = query ? memories.matching(userId, query, KEYWORD_MATCHES) : [];
  const byMeaning = meaning ? memories.nearest(userId, meaning, NEAREST, MIN_SIMILARITY) : [];
  const named = memories.linkedTo(userId, entityIds, MEMORIES_PER_ENTITY);
  // One hop further: what else is known about the products those memories mention, such as a
  // newer price, or the price a decision was made at.
  const hop = memories.entitiesOf([...byDate, ...byKeyword].map((m) => m.id));
  const related = memories.linkedTo(userId, hop, MEMORIES_PER_ENTITY);
  const ranked = [
    { list: byDate, weight: WEIGHTS.date },
    { list: byKeyword, weight: WEIGHTS.keyword },
    { list: byMeaning, weight: WEIGHTS.meaning },
    { list: named, weight: WEIGHTS.named },
    { list: related, weight: WEIGHTS.related },
  ];
  const conversations = [...new Set(fuse(ranked).map((m) => m.sessionId))].slice(
    0,
    CONVERSATIONS_TO_COMPLETE,
  );
  const rest = memories.fromSessions(userId, conversations, MEMORIES_PER_CONVERSATION * 2);
  const found = fuse([...ranked, { list: rest, weight: WEIGHTS.related }])
    .slice(0, MAX_MEMORIES)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  if (found.length === 0) return "Saved memories: none match this message.";
  const lines = found.map((m) => {
    const source = m.sourceUrl ? ` (source: ${m.sourceUrl})` : "";
    const day = formatDay(new Date(m.observedAt), timeZone);
    return `- ${day}, in "${m.sessionTitle}", ${m.kind}: ${m.text}${source}`;
  });
  return ["Saved memories that may be relevant (oldest first):", ...lines].join("\n");
}

function sessionsSection(store: Store, input: ContextInput): string {
  const sessions = store
    .listSessions(input.userId, RECENT_SESSIONS + 1)
    .filter((session) => session.id !== input.sessionId)
    .slice(0, RECENT_SESSIONS);
  if (sessions.length === 0) return "Earlier conversations: none. This is the first one.";
  const day = (iso: string) => formatDay(new Date(iso), input.timeZone);
  const lines = sessions.map((s) => `- ${day(s.updatedAt)}: ${s.title}`);
  const { count, first } = store.sessionStats(input.userId);
  if (first && count > RECENT_SESSIONS + 1) {
    // Seen live: asked "have I ever asked about X?", the model answered "I can't tell, the list
    // is not complete". The memories are searched over everything, so it can tell.
    lines.push(
      `There are ${count} conversations in all. The first was on ${day(first.createdAt)}: ${first.title}`,
      "The saved memories were searched across all of them, not only the ones listed: if nothing " +
        "about a topic is shown, there is no record of it.",
    );
  }
  return ["Recent conversations, by last message (newest first):", ...lines].join("\n");
}

/** Known entity names that appear as whole words in the texts. */
function mentionedEntities(memories: MemoryStore, userId: string, texts: string[]): number[] {
  const haystack = ` ${normalize(texts.join(" "))} `;
  return memories
    .entities(userId)
    .filter((entity) => haystack.includes(` ${entity.norm} `))
    .map((entity) => entity.id);
}

/** An FTS5 query matching any meaningful word of the message, or null if there is none. */
export function keywordQuery(message: string): string | null {
  const terms = keywords(message);
  // normalize() leaves only letters and digits, so quoting each word is safe.
  return terms.length ? terms.map((term) => `"${term}"`).join(" OR ") : null;
}

/** The message's distinct words, without the ones that say nothing. */
function keywords(message: string): string[] {
  const words = new Set(normalize(message).split(" "));
  return [...words].filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

/**
 * Reciprocal rank fusion: each list gives a memory weight / (RRF_K + its rank), and the sums
 * decide the order. A memory found in several ways beats one found in a single way, and no
 * list's raw scores (BM25, dates) have to be comparable with another's.
 */
function fuse(ranked: { list: Memory[]; weight: number }[]): Memory[] {
  const scores = new Map<string, { memory: Memory; score: number }>();
  for (const { list, weight } of ranked) {
    list.forEach((memory, rank) => {
      const entry = scores.get(memory.id) ?? { memory, score: 0 };
      entry.score += weight / (RRF_K + rank + 1);
      scores.set(memory.id, entry);
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || b.memory.observedAt.localeCompare(a.memory.observedAt))
    .map((entry) => entry.memory);
}

function cut(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}... (cut)`;
}

function formatNow(now: Date, timeZone: string): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  });
  return `${date.format(now)} (${timeZone})`;
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, timeStyle: "short" }).format(new Date(iso));
}
