import assert from "node:assert/strict";
import { test } from "node:test";
import { asksIfStillTrue, asksOnlyForRemembered } from "@/core/agent/recheck";

test("re-checks sources only when asked whether a web fact still holds", () => {
  const yes = [
    "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?",
    "What did I ask you on 3 November? Is your answer still correct today?",
    "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?",
    "did the laptop get cheaper",
    "any of those crm ppl raise prices?",
    "Is the MacBook you recommended still $999?",
  ];
  const no = [
    "What did I ask you on 3 November?",
    "Is Railway still what I'm using for the side project?", // only the user knows
    "am i still on railway or what",
    "What did you say PlanetScale costs?", // recall, not a check
    "How many people are on my sales team?",
    "Thanks!",
  ];
  for (const message of yes) assert.ok(asksIfStillTrue(message), message);
  for (const message of no) assert.ok(!asksIfStillTrue(message), message);
});

test("offers no search when the message asks only for remembered values", () => {
  const yes = [
    "If we pick Pipedrive over HubSpot for the whole team, how much more is that per year, at the latest prices you gave me?",
    "Add up what I pay per month for everything I've decided on, at the prices you gave me.",
    "List every price that changed between two of our conversations: old and new, with both dates.",
    "What did you say PlanetScale costs?",
  ];
  const no = [
    "Is the MacBook you recommended still $999?",
    "What did you say Neon costs, and what is it now?",
    "At the prices you gave me, is HubSpot still cheaper?",
    "You said Postgres 18 is out. What's new in it?",
    "What does Pipedrive cost?",
    "What did I ask you on 3 November? Is your answer still correct today?",
  ];
  for (const message of yes) assert.ok(asksOnlyForRemembered(message), message);
  for (const message of no) assert.ok(!asksOnlyForRemembered(message), message);
});
