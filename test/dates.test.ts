import assert from "node:assert/strict";
import { test } from "node:test";
import { mentionedDates, pastWeekday } from "@/core/memory/dates";

// Wednesday 11 November 2026, 15:00 in India.
const wednesday = new Date("2026-11-11T09:30:00Z");

function labels(text: string, now = wednesday, timeZone = "Asia/Kolkata") {
  return mentionedDates(text, now, timeZone).map((m) => [m.phrase, m.ranges.map((r) => r.label)]);
}

test("the sample prompts resolve to the days they mean", () => {
  assert.deepEqual(labels("On Monday we shortlisted 5 CRM tools for a 20-person sales team."), [
    ["On Monday", ["Mon, 9 Nov 2026"]],
  ]);
  assert.deepEqual(
    labels("What did I ask you on 3 November? Is your answer still correct today?"),
    [
      ["on 3 November", ["Tue, 3 Nov 2026"]],
      ["today", ["Wed, 11 Nov 2026"]],
    ],
  );
  // Said on a Wednesday, "last Tuesday" may be yesterday or the week before, so both are checked.
  assert.deepEqual(labels("Last Tuesday I asked you about Postgres hosting."), [
    ["Last Tuesday", ["Tue, 10 Nov 2026", "Tue, 3 Nov 2026"]],
  ]);
});

test("'the Monday before last' is the one a week before the latest", () => {
  assert.deepEqual(labels("What did I ask the Monday before last?"), [
    ["Monday before last", ["Mon, 2 Nov 2026"]],
  ]);
  assert.deepEqual(labels("and the tuesday before?"), [["tuesday before", ["Tue, 3 Nov 2026"]]]);
});

test("phrasings the date library misses: a time of day, counted weekdays, the weekend, 'the 3rd'", () => {
  assert.deepEqual(labels("What did I ask on the morning of 3 November?"), [
    ["on 3 November", ["Tue, 3 Nov 2026"]],
  ]);
  assert.deepEqual(labels("Two Mondays ago I asked about a CRM."), [
    ["Two Mondays ago", ["Mon, 2 Nov 2026"]],
  ]);
  assert.deepEqual(labels("What did we plan over the weekend?"), [
    ["the weekend", ["Sat, 7 Nov 2026 to Sun, 8 Nov 2026"]],
  ]);
  assert.deepEqual(labels("What did I ask on the 3rd?"), [["on the 3rd", ["Tue, 3 Nov 2026"]]]);
  assert.deepEqual(labels("What did I ask on the 20th?"), [["on the 20th", ["Tue, 20 Oct 2026"]]]);
  assert.deepEqual(labels("Is the 2nd cheapest one any good?"), []);
});

test("a day runs from midnight to midnight in the user's time zone", () => {
  const [range] = mentionedDates("on 3 November", wednesday, "Asia/Kolkata")[0]?.ranges ?? [];
  assert.equal(range?.from.toISOString(), "2026-11-02T18:30:00.000Z");
  assert.equal(range?.to.toISOString(), "2026-11-03T18:30:00.000Z");
});

test("the time zone decides which day it is", () => {
  const lateEvening = new Date("2026-11-11T02:00:00Z"); // 18:00 on 10 Nov in Los Angeles
  assert.deepEqual(labels("yesterday", lateEvening, "America/Los_Angeles"), [
    ["yesterday", ["Mon, 9 Nov 2026"]],
  ]);
  assert.deepEqual(labels("yesterday", lateEvening, "Asia/Kolkata"), [
    ["yesterday", ["Tue, 10 Nov 2026"]],
  ]);
});

test("a day with a daylight-saving change is 25 hours long", () => {
  const [range] = mentionedDates("on 1 November", wednesday, "America/New_York")[0]?.ranges ?? [];
  assert.equal(range?.from.toISOString(), "2026-11-01T04:00:00.000Z"); // midnight EDT
  assert.equal(range?.to.toISOString(), "2026-11-02T05:00:00.000Z"); // midnight EST
});

test("weekdays and dates without a year point to the past", () => {
  assert.deepEqual(labels("this Monday"), [["this Monday", ["Mon, 9 Nov 2026"]]]);
  assert.deepEqual(labels("December 20"), [["December 20", ["Sat, 20 Dec 2025"]]]);
  // Said on a Tuesday, "on Tuesday" means a week ago.
  const tuesday = new Date("2026-11-10T09:30:00Z");
  assert.deepEqual(labels("on Tuesday", tuesday), [["on Tuesday", ["Tue, 3 Nov 2026"]]]);
});

test("weeks and months become ranges that stop at today", () => {
  assert.deepEqual(labels("last week"), [["last week", ["Mon, 2 Nov 2026 to Sun, 8 Nov 2026"]]]);
  assert.deepEqual(labels("this week"), [["this week", ["Mon, 9 Nov 2026 to Wed, 11 Nov 2026"]]]);
  assert.deepEqual(labels("in October"), [["October", ["Thu, 1 Oct 2026 to Sat, 31 Oct 2026"]]]);
});

test("the future, the present and numbers that aren't dates are ignored", () => {
  for (const text of [
    "next Monday",
    "what is it right now",
    "Postgres 16 vs 17",
    "a 20-person team",
  ]) {
    assert.deepEqual(labels(text), [], text);
  }
});

test("pastWeekday counts back in the user's time zone, across a daylight-saving change", () => {
  const now = new Date("2026-11-11T20:00:00Z"); // Wed 11 Nov, 15:00 in New York
  const at = (weekday: number, time: string, weeksBefore?: number) =>
    pastWeekday(now, "America/New_York", weekday, time, weeksBefore).toISOString();
  assert.equal(at(2, "20:15"), "2026-11-11T01:15:00.000Z"); // Tue 10 Nov, EST
  assert.equal(at(3, "09:00"), "2026-11-04T14:00:00.000Z"); // said on a Wednesday: last week's
  assert.equal(at(4, "16:40", 1), "2026-10-29T20:40:00.000Z"); // EDT, before the change on 1 Nov
});
