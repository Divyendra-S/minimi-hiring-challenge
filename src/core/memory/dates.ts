import * as chrono from "chrono-node";

/** Whole days in the user's time zone, as UTC instants: [from, to). */
export type DayRange = { label: string; from: Date; to: Date };
/** A date expression in a message, and the days it may mean: more than one when ambiguous. */
export type DateMention = { phrase: string; ranges: DayRange[] };

const DAY_MS = 86_400_000;

// Spans are computed in wall-clock time: midnight of a local day, written as if it were UTC.
type Span = { from: number; days: number };

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const COUNTS: Record<string, number> = { two: 2, three: 3, four: 4 };

/** Finds dates like "on Monday", "last Tuesday" or "3 November" that point at past days. */
export function mentionedDates(text: string, now: Date, timeZone: string): DateMention[] {
  const wallNow = wallClock(now, timeZone);
  const today = startOfDay(wallNow);
  // chrono reads "the morning of 3 November" as this morning; the day is what matters here.
  const plain = text.replace(/\b(morning|afternoon|evening|night) of\b/gi, "on");
  const parsed = chrono
    .parse(plain, { instant: new Date(wallNow), timezone: 0 })
    .filter((result) => !/weekend/i.test(result.text)) // chrono means the coming one
    .map((result) => {
      // "the Monday before last", "and the Tuesday before?": the words after the match move it
      // a week back.
      const after = plain.slice(result.index + result.text.length).match(/^\s+before( last)?\b/i);
      const phrase = `${result.text}${after?.[0] ?? ""}`;
      return { phrase, spans: spansFor(result, today, after !== null) };
    });
  const found = [...parsed, ...otherSpans(plain, today)]
    .map(({ phrase, spans }) => ({ phrase, spans: spans.filter((span) => span.from <= today) }))
    .filter(({ spans }) => spans.length > 0);
  // "What did I ask on 3 November? Is it still correct today?": next to an earlier day, today is
  // when to compare, not a day to recall. Seen live: today's chats were quoted, and their pages
  // (a cricket site) were re-checked in place of the ones from 3 November.
  const isToday = ({ spans }: { spans: Span[] }) => spans.every((span) => span.from === today);
  const past = found.filter((mention) => !isToday(mention));
  return (past.length ? past : found).map(({ phrase, spans }) => ({
    phrase,
    ranges: spans.map((span) => toRange(span, today, timeZone)),
  }));
}

/** Phrases chrono doesn't know: "two Mondays ago", "last weekend", "on the 3rd". */
function otherSpans(text: string, today: number): { phrase: string; spans: Span[] }[] {
  const found: { phrase: string; spans: Span[] }[] = [];
  const counted = /\b(two|three|four|[2-4]) (sun|mon|tue|wed|thu|fri|sat)[a-z]*days ago\b/gi;
  for (const [phrase, count = "", name = ""] of text.matchAll(counted)) {
    const weeks = COUNTS[count.toLowerCase()] ?? Number(count);
    const latest = today - daysBack(today, WEEKDAYS.indexOf(name.toLowerCase())) * DAY_MS;
    found.push({ phrase, spans: [one(latest - (weeks - 1) * 7 * DAY_MS)] });
  }
  for (const [phrase] of text.matchAll(/\b(last |the )?weekend\b/gi)) {
    // The latest Saturday and Sunday.
    found.push({ phrase, spans: [{ from: today - daysBack(today, 6) * DAY_MS, days: 2 }] });
  }
  // Only after "on": "the 2nd cheapest" is not a date.
  for (const [phrase, number] of text.matchAll(/\bon the (\d{1,2})(?:st|nd|rd|th)\b(?! of)/gi)) {
    const date = new Date(today);
    const month = date.getUTCMonth() - (Number(number) > date.getUTCDate() ? 1 : 0);
    found.push({ phrase, spans: [one(Date.UTC(date.getUTCFullYear(), month, Number(number)))] });
  }
  return found;
}

function spansFor(result: chrono.ParsedResult, today: number, beforeLast: boolean): Span[] {
  const phrase = result.text.toLowerCase();
  const { start } = result;
  const day = startOfDay(start.date().getTime());
  const weekday = start.get("weekday");
  if (phrase === "now" || phrase.startsWith("next")) return []; // not the past

  if (weekday !== null && start.isCertain("weekday") && !start.isCertain("day")) {
    // "Monday" means the latest one before today. "Last Tuesday" can also mean the week before.
    const latest = today - daysBack(today, weekday) * DAY_MS;
    if (beforeLast) return [one(latest - 7 * DAY_MS)];
    return phrase.startsWith("last") ? [one(latest), one(latest - 7 * DAY_MS)] : [one(latest)];
  }
  if (result.end) {
    const end = startOfDay(result.end.date().getTime());
    if (end > day) return [{ from: day, days: (end - day) / DAY_MS + 1 }];
  }
  if (phrase.includes("week")) {
    // "last week", "two weeks ago": the Monday-to-Sunday week (ISO 8601) around that day.
    // chrono starts "this week" on Sunday, so that one is counted from today.
    const within = phrase.startsWith("this") ? today : day;
    return [{ from: within - ((new Date(within).getUTCDay() + 6) % 7) * DAY_MS, days: 7 }];
  }
  const date = new Date(day);
  const month = date.getUTCMonth();
  // Without a year, "20 December" said in November means last year's.
  const year = date.getUTCFullYear() - (!start.isCertain("year") && day > today ? 1 : 0);
  if (start.isCertain("month") && !start.isCertain("day")) {
    // "in October", "last month": the whole month.
    const from = Date.UTC(year, month, 1);
    return [{ from, days: (Date.UTC(year, month + 1, 1) - from) / DAY_MS }];
  }
  return [one(Date.UTC(year, month, date.getUTCDate()))];
}

function one(from: number): Span {
  return { from, days: 1 };
}

/** Days from the latest `weekday` (0 is Sunday) before `today` to `today`: 1 to 7. */
function daysBack(today: number, weekday: number): number {
  return (new Date(today).getUTCDay() - weekday + 7) % 7 || 7;
}

/**
 * The instant `timeZone` shows `time` ("20:15") on the latest `weekday` (0 is Sunday) before
 * today, or that many `weeksBefore` it.
 */
export function pastWeekday(
  now: Date,
  timeZone: string,
  weekday: number,
  time: string,
  weeksBefore = 0,
): Date {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const today = startOfDay(wallClock(now, timeZone));
  const day = today - (daysBack(today, weekday) + 7 * weeksBefore) * DAY_MS;
  return fromWallClock(day + (hours * 60 + minutes) * 60_000, timeZone);
}

function toRange({ from, days }: Span, today: number, timeZone: string): DayRange {
  const end = Math.min(from + days * DAY_MS, today + DAY_MS); // not past today
  const first = formatWallDay(from);
  const last = formatWallDay(end - DAY_MS);
  return {
    label: first === last ? first : `${first} to ${last}`,
    from: fromWallClock(from, timeZone),
    to: fromWallClock(end, timeZone),
  };
}

/** "Tue, 3 Nov 2026" for an instant, in the given time zone. */
export function formatDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

function formatWallDay(wall: number): string {
  return formatDay(new Date(wall), "UTC");
}

function startOfDay(wall: number): number {
  return Math.floor(wall / DAY_MS) * DAY_MS;
}

/** The local time in `timeZone` at `instant`, written as if it were UTC. */
function wallClock(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
}

/** The instant at which `timeZone` shows wall-clock time `wall`. */
function fromWallClock(wall: number, timeZone: string): Date {
  // Correct by the zone's offset twice, in case a daylight-saving change lies in between.
  let instant = wall;
  for (let i = 0; i < 2; i++) instant = wall - (wallClock(new Date(instant), timeZone) - instant);
  return new Date(instant);
}
