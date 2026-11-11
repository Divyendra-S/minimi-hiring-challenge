import assert from "node:assert/strict";
import { test } from "node:test";
import { citedSources, linkCitations } from "@/client/citations";

const sources = [
  { n: 1, title: "Neon pricing", url: "https://neon.com/pricing" },
  { n: 2, title: "Supabase pricing", url: "https://supabase.com/pricing" },
];

test("citations become links; unknown numbers and real links are left alone", () => {
  assert.equal(
    linkCitations("Cheap [1][9], see [docs](https://x.dev).", sources),
    "Cheap [[1]](https://neon.com/pricing)[9], see [docs](https://x.dev).",
  );
});

test("only cited sources are listed", () => {
  assert.deepEqual(
    citedSources("Only Supabase [2].", sources).map((s) => s.n),
    [2],
  );
});
