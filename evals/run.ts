// npm run eval                     Free and offline (CI runs it). Every case goes through chat()
//                                  with a stand-in model, and the context the real model would
//                                  get is checked.
// npm run eval -- --live a1 c1 e1  Also runs the named cases with the real model and search,
//                                  checks the answers, and reports latency and cost. This spends
//                                  money, so it runs only the cases you name, at most --max-calls
//                                  model calls in all (default 8).
import "../scripts/load-env";
import { parseArgs } from "node:util";
import { openDb } from "@/adapters/db";
import { keyUsage, type Llm, openRouter } from "@/adapters/llm";
import { type Search, tavily } from "@/adapters/tavily";
import { loadConfig } from "@/config";
import { cachedSearch } from "@/core/agent/cache";
import { type ChatDeps, chat } from "@/core/chat";
import { seedDemo } from "@/core/memory/demo";
import { createMemoryStore } from "@/core/memory/memories";
import { createStore, type Store } from "@/core/memory/store";
import { openRouterAccount } from "@/server/services";
import type { ChatEvent } from "@/shared/events";
import { CASES, type EvalCase, GROUPS } from "./cases";

const USER = "eval";
const NOW = new Date("2026-11-11T20:00:00Z"); // Wed 11 Nov 2026, 15:00 in New York
const TIME_ZONE = "America/New_York";
// OpenRouter's usage counter lags the requests by a few seconds.
const USAGE_SETTLE_MS = 10_000;

type Run = { events: ChatEvent[]; prompt: string; searches: { fresh: boolean }[]; error?: string };

const args = parseArgs({
  allowPositionals: true,
  options: { live: { type: "boolean" }, "max-calls": { type: "string", default: "8" } },
});

await offline();
if (args.values.live) await live(args.positionals, Number(args.values["max-calls"]));

async function offline(): Promise<void> {
  console.log(`Context checks, offline: ${CASES.length} cases\n`);
  const results = [];
  for (const c of CASES) {
    // The stand-in model answers at once, so the timings are our own code: recall and storage.
    const stub: Llm = async function* () {
      yield { type: "delta", text: "(offline)" };
      return { text: "(offline)", toolCalls: [] };
    };
    const run = await runCase(c, stub, async () => []);
    const context = run.prompt.match(/<context>\n([\s\S]*)\n<\/context>/)?.[1] ?? "";
    results.push({ c, run, failures: run.error ? [run.error] : contextFailures(c, context) });
  }
  printGroups(results);
  const ms = results.map(({ run }) => doneEvent(run)?.timings.totalMs ?? 0);
  console.log(`\nTime in our code per turn: p50 ${pct(ms, 50)} ms, p90 ${pct(ms, 90)} ms`);
  printFailures(results);
}

async function live(ids: string[], maxCalls: number): Promise<void> {
  const cases = ids.map((id) => CASES.find((c) => c.id === id) ?? fail(`No case "${id}".`));
  if (cases.length === 0) fail("Name the cases to run live, e.g. --live a1 c1 e1.");
  const config = loadConfig();
  const model = openRouter({ ...openRouterAccount(config), model: config.CHAT_MODEL });
  let calls = 0;
  const llm: Llm = (request) => {
    if (++calls > maxCalls) throw new Error(`Stopped: over ${maxCalls} model calls (--max-calls)`);
    return model(request);
  };
  const search = cachedSearch(tavily(config.TAVILY_API_KEY), new Map());
  const usageBefore = await keyUsage(config.OPENROUTER_API_KEY);

  console.log(`\nAnswer checks, live: ${cases.length} cases on ${config.CHAT_MODEL}\n`);
  const results = [];
  for (const c of cases) {
    const callsBefore = calls;
    const run = await runCase(c, llm, search);
    const failures = run.error ? [run.error] : answerFailures(c, run);
    const timings = doneEvent(run)?.timings;
    const searched = run.searches.length === 0 ? "no search" : `${run.searches.length} queries`;
    console.log(
      `${c.id}  ${failures.length ? "FAIL" : "pass"}  ${searched}, first token ` +
        `${seconds(timings?.firstTokenMs)}, total ${seconds(timings?.totalMs)}, ` +
        `${calls - callsBefore} model calls\n    Q: ${c.message}\n    A: ${indent(answerOf(run))}`,
    );
    for (const failure of failures) console.log(`    ✗ ${failure}`);
    results.push({ c, run, failures });
  }

  const passed = results.filter((r) => r.failures.length === 0).length;
  const firstToken = results.flatMap(({ run }) => doneEvent(run)?.timings.firstTokenMs ?? []);
  const total = results.flatMap(({ run }) => doneEvent(run)?.timings.totalMs ?? []);
  const queries = results.reduce((sum, { run }) => sum + run.searches.length, 0);
  console.log(
    `\nPassed ${passed}/${results.length}. First token p50 ${seconds(pct(firstToken, 50))}, ` +
      `p90 ${seconds(pct(firstToken, 90))}; total p50 ${seconds(pct(total, 50))}, ` +
      `p90 ${seconds(pct(total, 90))}. Model calls: ${calls}. Search queries: ${queries}.`,
  );
  await new Promise((resolve) => setTimeout(resolve, USAGE_SETTLE_MS));
  const usageAfter = await keyUsage(config.OPENROUTER_API_KEY);
  if (usageBefore !== undefined && usageAfter !== undefined) {
    const cost = usageAfter - usageBefore;
    console.log(`Cost: $${cost.toFixed(5)}, $${(cost / results.length).toFixed(5)} per turn.`);
  }
  if (passed < results.length) process.exitCode = 1;
}

/** Runs one case on a fresh in-memory database, through the same chat() the app uses. */
async function runCase(c: EvalCase, llm: Llm, search: Search): Promise<Run> {
  const db = openDb(":memory:");
  const store = createStore(db);
  const run: Run = { events: [], prompt: "", searches: [] };
  const deps: ChatDeps = {
    store,
    memories: createMemoryStore(db),
    now: () => NOW,
    // Records the prompt of the first call: the one that carries the context.
    llm: (request) => {
      run.prompt ||= String(request.messages.at(-1)?.content ?? "");
      return llm(request);
    },
    search: (query, options) => {
      run.searches.push({ fresh: options.fresh === true });
      return search(query, options);
    },
  };
  if (c.history === "demo") seedDemo(deps, USER, NOW, TIME_ZONE);
  const sessionId = c.earlier && earlierChat(store, c.earlier);
  try {
    const input = { userId: USER, sessionId, message: c.message, timezone: TIME_ZONE };
    for await (const event of chat(deps, input)) run.events.push(event);
  } catch (error) {
    run.error = `error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    db.close();
  }
  return run;
}

/** A chat with the case's earlier turns, a few minutes before now. */
function earlierChat(store: Store, turns: NonNullable<EvalCase["earlier"]>): string {
  const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();
  const sessionId = store.createSession(USER, "Eval chat", minutesAgo(10));
  for (const [i, turn] of turns.entries()) {
    const message = { sessionId, userId: USER, createdAt: minutesAgo(10 - i) };
    store.addMessage({ ...message, role: "user", content: turn.question });
    store.addMessage({ ...message, role: "assistant", content: turn.answer });
  }
  return sessionId;
}

function contextFailures(c: EvalCase, context: string): string[] {
  const { has = [], lacks = [] } = c.context;
  return [
    ...has.filter((text) => !context.includes(text)).map((text) => `context lacks: ${text}`),
    ...lacks.filter((text) => context.includes(text)).map((text) => `context has: ${text}`),
  ];
}

function answerFailures(c: EvalCase, run: Run): string[] {
  const { search, fresh, has = [] } = c.answer;
  const answer = answerOf(run);
  const searched = run.searches.length > 0;
  return [
    search === true && !searched && "didn't search",
    search === false && searched && "searched when it needn't",
    fresh && !run.searches.some((s) => s.fresh) && "didn't ask for fresh pages",
    searched && !/\[\d+\]/.test(answer) && "searched but cites nothing",
    ...has.filter((pattern) => !pattern.test(answer)).map((pattern) => `answer lacks ${pattern}`),
  ].filter((failure) => typeof failure === "string");
}

type Result = { c: EvalCase; failures: string[] };

function printGroups(results: Result[]): void {
  for (const [letter, name] of Object.entries(GROUPS)) {
    const group = results.filter(({ c }) => c.id.startsWith(letter));
    const passed = group.filter((r) => r.failures.length === 0).length;
    console.log(`  ${letter}  ${name.padEnd(30)} ${passed}/${group.length}`);
  }
  const passed = results.filter((r) => r.failures.length === 0).length;
  console.log(`     ${"All".padEnd(30)} ${passed}/${results.length}`);
}

function printFailures(results: Result[]): void {
  const failed = results.filter((r) => r.failures.length > 0);
  for (const { c, failures } of failed) {
    console.log(`\n${c.id} "${c.message}"`);
    for (const failure of failures) console.log(`    ✗ ${failure}`);
  }
  if (failed.length > 0) process.exitCode = 1;
}

function doneEvent(run: Run) {
  return run.events.find((event) => event.type === "done");
}

function answerOf(run: Run): string {
  return run.events.map((event) => (event.type === "delta" ? event.text : "")).join("");
}

/** Nearest-rank percentile. */
function pct(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

function seconds(ms: number | null | undefined): string {
  return ms == null ? "-" : `${(ms / 1000).toFixed(1)} s`;
}

function indent(text: string): string {
  return text.trim().replace(/\n+/g, "\n       ");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
