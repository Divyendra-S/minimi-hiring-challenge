import type { StoredMessage } from "@/shared/dto";
import { type DayRange, formatDay, mentionedDates } from "./dates";
import { type Memory, type MemoryStore, normalize } from "./memories";
import type { LoggedMessage, Store } from "./store";

const MESSAGES_PER_RANGE = 40;
const QUESTION_CHARS = 500;
const ANSWER_CHARS = 400;
const KEYWORD_MATCHES = 8;
const MEMORIES_PER_ENTITY = 5;
const MAX_MEMORIES = 24;
const RECENT_SESSIONS = 20;

// Words that would match almost every memory.
const STOPWORDS = new Set(
  (
    "a about after again all also am an and any are as ask asked at be been before but by can " +
    "could did do does for from get got had has have he her him his how i if in into is it its " +
    "just last let me more most my no not now of on or our out please said say she since so " +
    "some still tell than that the their them then there these they this those to told too us " +
    "very was we were what when where which who why will with would you your"
  ).split(" "),
);

export type ContextDeps = { store: Store; memories: MemoryStore };
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
 * What the agent knows beyond this session, built in code on every turn with no model call:
 * conversations on the days the message mentions, saved memories that match it, and the list
 * of recent conversations. An empty section says so, so the model can tell "nothing happened"
 * apart from "not shown".
 */
export function buildContext(deps: ContextDeps, input: ContextInput): string {
  return [
    `Now: ${formatNow(input.now, input.timeZone)}`,
    ...datesSection(deps.store, input),
    memoriesSection(deps.memories, input),
    sessionsSection(deps.store, input),
  ].join("\n\n");
}

function datesSection(store: Store, input: ContextInput): string[] {
  const { userId, sessionId, message, now, timeZone } = input;
  const seen = new Set<string>();
  return mentionedDates(message, now, timeZone).flatMap(({ phrase, ranges }) => {
    const labels = ranges.map((range) => range.label);
    const meaning =
      ranges.length === 1
        ? `"${phrase}" means ${labels[0]}.`
        : `"${phrase}" could mean ${labels.join(" or ")}; all are shown.`;
    const days = ranges.flatMap((range) => {
      if (seen.has(range.label)) return []; // "on Monday ... since Monday"
      seen.add(range.label);
      const messages = store.messagesBetween(userId, range, sessionId, MESSAGES_PER_RANGE);
      return [conversationsOn(range, messages, timeZone)];
    });
    return [meaning, ...days];
  });
}

function conversationsOn(range: DayRange, messages: LoggedMessage[], timeZone: string): string {
  const heading = `Conversations on ${range.label}, apart from this one`;
  if (messages.length === 0) return `${heading}: none.`;
  const bySession = Map.groupBy(messages, (message) => message.sessionId);
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

function memoriesSection(memories: MemoryStore, input: ContextInput): string {
  const { userId, message, recent, timeZone } = input;
  const query = keywordQuery(message);
  const entityIds = mentionedEntities(memories, userId, [message, ...recent.map((m) => m.content)]);
  const found = uniqueById([
    ...(query ? memories.matching(userId, query, KEYWORD_MATCHES) : []),
    ...memories.linkedTo(userId, entityIds, MEMORIES_PER_ENTITY),
  ])
    .slice(0, MAX_MEMORIES)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  if (found.length === 0) return "Saved memories: none match this message.";
  const lines = found.map((m) => {
    const source = m.sourceUrl ? ` (source: ${m.sourceUrl})` : "";
    return `- ${formatDay(new Date(m.observedAt), timeZone)}, ${m.kind}: ${m.text}${source}`;
  });
  return ["Saved memories that may be relevant (oldest first):", ...lines].join("\n");
}

function sessionsSection(store: Store, input: ContextInput): string {
  const sessions = store
    .listSessions(input.userId, RECENT_SESSIONS + 1)
    .filter((session) => session.id !== input.sessionId)
    .slice(0, RECENT_SESSIONS);
  if (sessions.length === 0) return "Earlier conversations: none. This is the first one.";
  const lines = sessions.map(
    (s) => `- ${formatDay(new Date(s.updatedAt), input.timeZone)}: ${s.title}`,
  );
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
  const words = new Set(normalize(message).split(" "));
  const terms = [...words].filter((word) => word.length > 1 && !STOPWORDS.has(word));
  // normalize() leaves only letters and digits, so quoting each word is safe.
  return terms.length ? terms.map((term) => `"${term}"`).join(" OR ") : null;
}

function uniqueById(memories: Memory[]): Memory[] {
  return [...new Map(memories.map((memory) => [memory.id, memory])).values()];
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
