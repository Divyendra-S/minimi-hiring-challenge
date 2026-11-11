import * as chrono from "chrono-node";

/** Whole days in the user's time zone, as UTC instants: [from, to). */
export type DayRange = { label: string; from: Date; to: Date };
/** A date expression in a message, and the days it may mean: more than one when ambiguous. */
export type DateMention = { phrase: string; ranges: DayRange[] };

const DAY_MS = 86_400_000;

// Spans are computed in wall-clock time: midnight of a local day, written as if it were UTC.
type Span = { from: number; days: number };

/** Finds dates like "on Monday", "last Tuesday" or "3 November" that point at past days. */
export function mentionedDates(text: string, now: Date, timeZone: string): DateMention[] {
  const wallNow = wallClock(now, timeZone);
  const today = startOfDay(wallNow);
  return chrono.parse(text, { instant: new Date(wallNow), timezone: 0 }).flatMap((result) => {
    const ranges = spansFor(result, today)
      .filter((span) => span.from <= today)
      .map((span) => toRange(span, today, timeZone));
    return ranges.length ? [{ phrase: result.text, ranges }] : [];
  });
}

function spansFor(result: chrono.ParsedResult, today: number): Span[] {
  const phrase = result.text.toLowerCase();
  const { start } = result;
  const day = startOfDay(start.date().getTime());
  const weekday = start.get("weekday");
  if (phrase === "now" || phrase.startsWith("next")) return []; // not the past

  if (weekday !== null && start.isCertain("weekday") && !start.isCertain("day")) {
    // "Monday" means the latest one before today. "Last Tuesday" can also mean the week before.
    const back = (new Date(today).getUTCDay() - weekday + 7) % 7 || 7;
    const latest = today - back * DAY_MS;
    return phrase.startsWith("last") ? [one(latest), one(latest - 7 * DAY_MS)] : [one(latest)];
  }
  if (result.end) {
    const end = startOfDay(result.end.date().getTime());
    if (end > day) return [{ from: day, days: (end - day) / DAY_MS + 1 }];
  }
  if (phrase.includes("week")) {
    // "last week", "two weeks ago": the Sunday-to-Saturday week around that day.
    return [{ from: day - new Date(day).getUTCDay() * DAY_MS, days: 7 }];
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
