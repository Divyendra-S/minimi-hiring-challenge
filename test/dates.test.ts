import assert from "node:assert/strict";
import { test } from "node:test";
import { mentionedDates } from "@/core/memory/dates";

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
  assert.deepEqual(labels("last week"), [["last week", ["Sun, 1 Nov 2026 to Sat, 7 Nov 2026"]]]);
  assert.deepEqual(labels("this week"), [["this week", ["Sun, 8 Nov 2026 to Wed, 11 Nov 2026"]]]);
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
