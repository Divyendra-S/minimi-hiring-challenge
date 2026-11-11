# Design

A chat agent with one tool, web search, that remembers what you asked and when.

## What the brief tests, and the idea that answers it

All three sample prompts ask the same thing: recall a past conversation by date, then check whether its facts still hold. So the hard part is memory over time, and it has to be fast.

**The idea: memory is built by code, not by the model.** Before each reply, code finds what is relevant and puts it in the prompt. The model then makes one decision: search or answer. There is no memory tool, no router and no planner, so a recall question costs one model call and a "has it changed?" question costs two.

```
message ─► recall in code (4–6 ms) ─► model ─► answer                     1.2–2.1 s to first word
                                         └─► web_search ─► model ─► answer  3.4–5 s
after the reply ─► one extraction call ─► memories ─► local embeddings   (the user never waits for it)
```

## How it works

**Reading memory** (`src/core/memory/context.ts`, no model call):

1. **Dates.** "last Tuesday", "3 November" or "two Mondays ago" become day ranges in the user's time zone, and those days' conversations are quoted. If a phrase could mean two days, both are shown and the better match is named.
2. **Memories**, found five ways: by that date, by keyword (SQLite FTS5, BM25), by meaning (a 23 MB embedding model running in-process), by entity (each memory is linked to the products, companies and people it mentions), and one hop along those links (what else is known about the entities found, such as a newer price).
3. **Merge.** Reciprocal rank fusion, capped at 24 lines. Each line carries its date, conversation, kind and source URL.
4. **Honesty.** An empty section says "none", so "what did I ask on 3 November?" on a fresh install gets "I have no record", not an invention.

**Writing memory** (`extract.ts`): after the answer is sent, one structured call extracts preferences, facts, decisions and claims (web facts with their source). Memories are append-only: a changed price is a new row, so the agent can say "$19 on 3 Nov → $5 on 6 Nov → today's". The message log is the source of truth; `npm run reindex` rebuilds every memory from it.

**Searching** (`src/core/agent`): one `web_search` call carries up to 10 searches that run in parallel, each with its own `site` and `recency`. Naming a site fetches the vendor's page live, because a stored copy may predate a price change. Rounds are capped at two. Results are treated as untrusted data and cited by number.

**Stack:** Next.js (UI and API in one process), one SQLite file, OpenRouter (`gpt-6-luna`), Tavily. Two API keys. Runs on Node 20 to 26.

## Results

Run on a 31-chat, eight-week sample history (the "Load demo history" button), with look-alike chats, a price that changes and a decision that is reversed.

| Check                                                                                 | Result                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Right memories reach the prompt: 113 cases, offline, free, in CI                      | 63 → 69 → 77 of the first 77 as recall was built; now 113 of 113            |
| Reworded questions ("earphones for plane trips"), before and after embeddings         | 1 of 8 → 8 of 8                                                             |
| Live answers: 20 vague ("wat crm did u say was cheapest"), 16 hard, the brief's three | 39 of 39, after the fixes they led to                                       |
| Time to first word                                                                    | 1.2–2.1 s without search, 3.4–5 s with, 5.5–6.4 s for the five-CRM question |
| Cost per turn                                                                         | $0.0004 to $0.002                                                           |

Each live case ran once, on cases I wrote; a pass is one good answer, not a guarantee. LongMemEval and BEAM were not run.

## Decisions, with the evidence

| Considered                                                          | Decision               | Why                                                                                                                        |
| ------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A memory tool the model calls                                       | Rejected               | One more model round (about 2 s) on the questions the brief asks most                                                      |
| A model that rewrites the query for recall                          | Rejected               | A serial call on every turn; recall in code already passes 113 of 113                                                      |
| Vector database                                                     | Rejected               | A user's vectors are compared in about 1 ms per thousand in plain code                                                     |
| Embedding API                                                       | Rejected               | A third key and a network call per turn; the local model takes 2 ms                                                        |
| Planner, researcher and writer agents                               | Rejected               | More serial calls and more ways to fail                                                                                    |
| Knowledge graph: typed relations, multi-hop traversal               | Partly                 | Entities and one hop are built. Walking deeper needs a memory tool and a model round per level, and no test case needed it |
| Faster model settings: no reasoning, priority tier, latency routing | Rejected               | Measured: all within run-to-run noise                                                                                      |
| `better-sqlite3`                                                    | Replaced by `libsql`   | Its current release crashes on Node 20; tested from a clean copy                                                           |
| Rules in the system prompt only                                     | Moved next to the data | The model ignored them; a note at the end of the context and of the search results fixed it                                |

## Limits

- A search turn is two model calls, so 3.4–5 s is the floor on this model; the live page fetch is about 1 s of it.
- When two memories disagree, the model decides from their dates; code does not mark one as replaced.
- Users are told apart by a cookie, and every vector is compared on each turn: right for one person's history, not for millions of memories.

## With another week

- Run LongMemEval and BEAM for a number comparable with published systems.
- Typed relations between entities, for questions that chain through several of them.
- Mark replaced memories in code, and re-check saved prices on a schedule ("Neon changed since you asked").
- Build evals from real transcripts, and run each case several times.

The full record of each experiment is in `MEMORY_ARCHITECTURE.md`.
