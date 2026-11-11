import type { Embedder } from "@/adapters/embedder";
import type { StoredMessage } from "@/shared/dto";
import { type DayRange, formatDay, mentionedDates } from "./dates";
import { type Memory, type MemoryStore, normalize } from "./memories";
import type { LoggedMessage, LoggedTurn, Store } from "./store";

// A day or two is quoted in full. A longer stretch (a busy week, a month) would be thousands of
// words, so it is shown as the user's questions only, and past the second limit as the first
// question of each conversation. The facts in the answers still arrive, as saved memories.
const MESSAGES_QUOTED_IN_FULL = 40;
const MESSAGES_QUOTED_AS_QUESTIONS = 160;
const MESSAGES_PER_RANGE = 600;
const QUESTION_CHARS = 500;
const SHORT_QUESTION_CHARS = 160;
const ANSWER_CHARS = 400;
// Past answers quoted whole: the one the best memory was learned from, and the best keyword
// matches in the log itself. Advice such as directions or an agenda leaves no saved memory, and
// a dated answer above is cut short.
const TURNS_QUOTED = 3;
const TURN_CHARS = 1_500;
// Memories of the conversations a date points to: those answers are quoted cut short.
const MEMORIES_FROM_DATES = 60;
const KEYWORD_MATCHES = 24;
// By meaning: the closest few, and only if they are close at all. Below this cosine similarity,
// the sample history's matches were unrelated ("Thanks!" scores 0.18 against its nearest memory).
const NEAREST = 12;
const MIN_SIMILARITY = 0.25;
const MEMORIES_PER_ENTITY = 5;
const MAX_MEMORIES = 60;
const OPTIONS_OF_DECISIONS = 30;
const CHANGED_SUBJECTS = 20;
const ASKS_WHAT_CHANGED = /\b(chang(e|ed|es|ing)|went (up|down)|increased?|dropped)\b/i;
// Seen live: asked "how many conversations about CRMs?", the model wrote "three" first, then
// listed four. Told in the system prompt to list first, it still led with the number. A note
// right before the question is followed.
const ASKS_HOW_MANY = /\bhow (many|often)\b.*\b(conversations?|chats?|times)\b/i;
const COUNT_NOTE =
  "Note: to count conversations, first write one line for each conversation that is on topic, " +
  "with its title and date. Two conversations on the same day are two lines. Give the number " +
  "only after the list: it is the number of lines.";
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
// Who the user is rides along on every turn: their facts, preferences and decisions, newest
// first. Seen live: "What do you know about my family?" found one memory in six, because
// "family" is not close in meaning to "The user's father turns 60" (similarity 0.1 to 0.15, the
// same as noise). Decisions are in it because a fact alone can mislead: "would use Redis to
// cache" was read as "uses Redis", when the decision was not to add it.
const ABOUT_USER = 120;
const ABOUT_KINDS = [
  { kind: "decision", heading: "Decisions" },
  { kind: "fact", heading: "Facts" },
  { kind: "preference", heading: "Preferences" },
] as const;
// Pages worth fetching again when the user asks whether remembered facts still hold.
const SOURCES_TO_CHECK = 5;

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

export type Context = {
  text: string;
  /** The recalled claims that still stand and have a source, the most relevant first. */
  claims: { text: string; url: string }[];
};

/**
 * What the agent knows beyond this session, built in code on every turn with no call to a
 * language model: conversations on the days the message mentions, saved memories from them and
 * memories that match the message by keyword, meaning or product name, and the list of recent
 * conversations. An empty section says so, so the
 * model can tell "nothing happened" apart from "not shown".
 */
export async function buildContext(deps: ContextDeps, input: ContextInput): Promise<Context> {
  const dates = datesSection(deps.store, input);
  const meaning = await deps.embedder?.embedIfReady(input.message);
  const memories = memoriesSection(deps.memories, input, dates.sessionIds, meaning);
  const text = [
    `Now: ${formatNow(input.now, input.timeZone)}`,
    ...dates.lines,
    memories.text,
    ...aboutSection(deps.memories, input),
    ...turnsSection(deps.store, input, dates.sessionIds, memories),
    sessionsSection(deps.store, input),
    ...dates.notes,
    ...(ASKS_HOW_MANY.test(input.message) ? [COUNT_NOTE] : []),
  ].join("\n\n");
  return { text, claims: memories.claims };
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
            "also ask whether an answer is still correct, the second sentence is the verdict: " +
            "yes, no or partly, and what changed. If they name a topic, use only the one that " +
            "matches.",
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
  const sessions = [...bySession.values()];
  if (messages.length > MESSAGES_QUOTED_IN_FULL) {
    const firstOnly = messages.length > MESSAGES_QUOTED_AS_QUESTIONS;
    const blocks = sessions.map((session) => {
      const asked = session.filter((m) => m.role === "user");
      const lines = (firstOnly ? asked.slice(0, 1) : asked).map(
        (m) => `  User: ${cut(m.content, SHORT_QUESTION_CHARS)}`,
      );
      if (firstOnly && asked.length > 1) lines.push(`  (and ${asked.length - 1} more questions)`);
      const day = formatDay(new Date(session[0]?.createdAt ?? range.from), timeZone);
      return [`- ${day}, "${session[0]?.sessionTitle}"`, ...lines].join("\n");
    });
    const what = firstOnly ? "the first question of each" : "the user's questions only";
    return [`${heading} (${sessions.length} conversations; ${what}):`, ...blocks].join("\n");
  }
  const blocks = sessions.map((session) => {
    const lines = session.map((m) => {
      const time = formatTime(m.createdAt, timeZone);
      if (m.role === "user") return `  ${time} User: ${cut(m.content, QUESTION_CHARS)}`;
      return `  ${time} You: ${quoted(m, ANSWER_CHARS)}`;
    });
    return [`- "${session[0]?.sessionTitle}"`, ...lines].join("\n");
  });
  return [`${heading}:`, ...blocks].join("\n");
}

/** A past answer, cut to `max`. Its citation numbers would clash with this turn's, so the pages are listed instead. */
function quoted(answer: LoggedMessage, max: number): string {
  const pages = answer.sources.map((s) => s.url).join(", ");
  const text = cut(answer.content.replace(/\s*\[\d+\]/g, ""), max);
  return `${text}${pages ? `\n  Pages cited: ${pages}` : ""}`;
}

/**
 * Past answers in full: the one the best memory came from, then the ones that share the most
 * telling words with the message. The keyword search looks first where the message points: in
 * the conversations of the days it names, or else in the conversations its best memories come
 * from (found by meaning too, so "the Portugal trip" reaches a chat that only says "Lisbon").
 */
function turnsSection(
  store: Store,
  input: ContextInput,
  sessionIds: string[],
  found: { answerId: string | undefined; conversations: string[] },
): string[] {
  const { userId, sessionId, message, timeZone } = input;
  const query = keywordQuery(message);
  const search = (within: string[] | null) =>
    query ? store.turnsMatching(userId, query, sessionId, within, TURNS_QUOTED) : [];
  const candidates = [
    ...(found.answerId ? [store.turn(userId, found.answerId, sessionId)] : []),
    ...(sessionIds.length
      ? search(sessionIds)
      : [...(found.conversations.length ? search(found.conversations) : []), ...search(null)]),
  ].flatMap((turn) => turn ?? []);
  const turns = [...new Map(candidates.map((turn) => [turn.id, turn])).values()].slice(
    0,
    TURNS_QUOTED,
  );
  if (turns.length === 0) return [];
  const blocks = turns.map((turn: LoggedTurn) => {
    const asked = cut(turn.question, QUESTION_CHARS);
    const day = formatDay(new Date(turn.createdAt), timeZone);
    return `- ${day}, in "${turn.sessionTitle}"\n  User: ${asked}\n  You: ${quoted(turn, TURN_CHARS)}`;
  });
  return [["Earlier answers in full (some may be off topic):", ...blocks].join("\n")];
}

/**
 * The user's facts, preferences and decisions. Each list is complete, also where a line repeats
 * a memory shown above. Seen live: with the two oldest decisions shown only above, asked for
 * "the very first decision I made", the model gave the oldest line of this list, the third.
 */
function aboutSection(memories: MemoryStore, input: ContextInput): string[] {
  const all = memories.about(input.userId, ABOUT_USER);
  // A fact that a newer one replaced (a team of 20, now 25) is left out.
  const subjects = [...new Set(all.flatMap((m) => m.subject ?? []))];
  const current = new Map(memories.historyOf(input.userId, subjects).map((m) => [m.subject, m.id]));
  const rest = all.filter((m) => !m.subject || current.get(m.subject) === m.id);
  if (rest.length === 0) return [];
  // One list per kind. Seen live: in a single list, asked for "my most recent decision", the
  // model gave the newest line, which was a fact.
  const lists = ABOUT_KINDS.flatMap(({ kind, heading }) => {
    const lines = rest
      .filter((m) => m.kind === kind)
      .map((m) => `- ${formatDay(new Date(m.observedAt), input.timeZone)}: ${m.text}`);
    return lines.length ? [`${heading}:`, ...lines] : [];
  });
  return [
    ["About the user, from all conversations (each list newest first):", ...lists].join("\n"),
  ];
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
  const best = fuse([...ranked, { list: rest, weight: WEIGHTS.related }]).slice(0, MAX_MEMORIES);
  if (best.length === 0) {
    const text = "Saved memories: none match this message.";
    return { text, claims: [], answerId: undefined, conversations: [], shown: new Set<string>() };
  }

  // A price, a team size or a choice can be replaced by a newer memory about the same subject.
  // Every value the subject has had is shown, and code says which one stands: the model is not
  // left to work that out from the dates.
  // Asked what changed, every subject that has had two values is shown, found or not. Seen
  // live: "list every price that changed" found Pipedrive's two prices and not Neon's, whose
  // memory doesn't use the word "price".
  const changed = ASKS_WHAT_CHANGED.test(message)
    ? memories.changedSubjects(userId, CHANGED_SUBJECTS)
    : [];
  const history = memories.historyOf(userId, [
    ...new Set([...best.flatMap((m) => m.subject ?? []), ...changed]),
  ]);
  const current = new Map(history.map((m) => [m.subject, m]));
  const replacedBy = (m: Memory) => {
    const newer = m.subject ? current.get(m.subject) : undefined;
    return newer && newer.id !== m.id ? newer : undefined;
  };
  // A decision is read with what it was chosen from: the prices of the options compared in the
  // same conversation. A price whose product the decision does not name is marked as not
  // chosen, by entity link. Seen live: "which tools did I decide against?" found "decided to
  // send email with Resend" but not the Postmark price next to it; and shown unmarked, the
  // model did not connect the two.
  const decisions = best.filter((m) => m.kind === "decision");
  const options = memories
    .fromSessions(userId, [...new Set(decisions.map((m) => m.sessionId))], OPTIONS_OF_DECISIONS * 2)
    .filter((m) => m.kind === "claim")
    .slice(0, OPTIONS_OF_DECISIONS);
  const chosenIn = new Map<string, Set<number>>();
  for (const d of decisions) {
    const chosen = chosenIn.get(d.sessionId) ?? new Set<number>();
    for (const id of memories.entitiesOf([d.id])) chosen.add(id);
    chosenIn.set(d.sessionId, chosen);
  }
  const notChosen = (m: Memory) => {
    const chosen = chosenIn.get(m.sessionId);
    if (m.kind !== "claim" || !chosen?.size) return false;
    const about = memories.entitiesOf([m.id]);
    return about.length > 0 && !about.some((id) => chosen.has(id));
  };
  const shown = [...new Map([...best, ...history, ...options].map((m) => [m.id, m])).values()];
  const day = (m: Memory) => formatDay(new Date(m.observedAt), timeZone);
  const lines = shown
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .map((m) => {
      const source = m.sourceUrl ? ` (source: ${m.sourceUrl})` : "";
      const newer = replacedBy(m);
      const isNewest = !newer && history.some((h) => h.subject === m.subject && h.id !== m.id);
      const status = newer
        ? ` [replaced on ${day(newer)}]`
        : isNewest
          ? " [current]"
          : notChosen(m)
            ? " [compared, not chosen that day]"
            : "";
      return `- ${day(m)}, in "${m.sessionTitle}", ${m.kind}: ${m.text}${source}${status}`;
    });
  // The pages worth fetching again are those of the claims the message points at surely: on a
  // day it names or about a product it names, and found in a second way too (a keyword, its
  // meaning). When it names a day and no topic, all of that day's claims are taken. Without a
  // day or a product, nothing is fetched and the model searches for itself. Seen live: asked
  // about "that db thing" with four database chats, code picked one, and the answer covered
  // only that one.
  const among = (list: Memory[]) => (m: Memory) => list.some((x) => x.id === m.id);
  const ways = (m: Memory) =>
    [byDate, byKeyword, byMeaning, named].filter((list) => among(list)(m)).length;
  const claims = best.filter((m) => m.sourceUrl);
  const sure = claims.filter((m) => ways(m) >= 2);
  const picked = [
    sure.filter(among(byDate)),
    sure.filter(among(named)),
    claims.filter(among(byDate)),
  ].find((list) => list.length);
  const standing = (picked ?? []).map((m) => replacedBy(m) ?? m);
  const byUrl = new Map(standing.flatMap((m) => (m.sourceUrl ? [[m.sourceUrl, m.text]] : [])));
  return {
    text: ["Saved memories that may be relevant (oldest first):", ...lines].join("\n"),
    claims: [...byUrl].slice(0, SOURCES_TO_CHECK).map(([url, text]) => ({ url, text })),
    answerId: best[0]?.answerId,
    conversations,
    shown: new Set(shown.map((m) => m.id)),
  };
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
