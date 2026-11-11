# Design

A chat agent with one tool, web search, that remembers what you asked and when.

## The idea

The brief's sample prompts all ask one thing: recall a past conversation by date, then check whether its facts still hold. So the rule is: **whatever code can do before the model runs, code does.** Code recalls, decides which value is current, and fetches the pages those values came from. The model compares and answers.

```
message ─► recall (code, 5–7 ms) ─► re-check sources if asked (code, one fetch) ─► model ─► answer
                                                          web_search, when needed ◄──┘
after the reply ─► one extraction call ─► memories ─► local embeddings   (the user never waits)
```

## How it works

- **Recall** (`src/core/memory/context.ts`, no model call). Date phrases become day ranges in the user's time zone, and those conversations are quoted. Memories are found by date, keyword (SQLite FTS5), meaning (a 23 MB embedding model in-process), entity, and one hop along entity links, then merged by reciprocal rank fusion. An empty section says "none", so the agent does not invent a past.
- **The log is searched too.** Advice (an agenda, a recipe) leaves no memory, so three past answers are quoted whole: the one the top memory came from, then the best keyword matches.
- **Who the user is.** Their decisions, facts and preferences ride along on every turn, one list each, newest first. A decision brings the prices of the options it was chosen from.
- **What is current.** Memories are append-only and carry a subject. When a newer one has the same subject, code marks the old one `[replaced on 6 Nov]` and the new one `[current]`.
- **Re-check** (`src/core/agent/recheck.ts`). Every claim keeps its source URL. When the message asks whether facts still hold and names a day or a product, code fetches those pages, so the turn takes one model call, not two.
- **No search for remembered values.** "At the prices you gave me" is matched in code and the tool is not offered; told only in the prompt, the model searched on 3 of 3.
- **Search.** One `web_search` call carries up to 10 parallel searches, each with its own `site` and `recency`. Two rounds at most. A query that names a recent date gets a time window in code: asked about "this week", the model searched all time on 4 of 4. Results are untrusted data, cited by number.
- **Writing memory.** After the answer, one structured call extracts preferences, facts, decisions and sourced claims. `npm run reindex` rebuilds memory from the log.
- **Stack.** Next.js, one SQLite file, OpenRouter, Tavily. Two API keys.

## Results

On a 47-chat, 191-turn sample history (the "Load demo history" button):

| Check                                                 | Result                                     |
| ----------------------------------------------------- | ------------------------------------------ |
| Right context reaches the prompt, offline, in CI      | 159 of 159                                 |
| Reworded questions, before and after embeddings       | 1 of 8 → 8 of 8                            |
| A detail deep in a long answer, 0 to 3 answers quoted | 0, 3, 7, 8 of 8                            |
| Questions needing 4 to 9 chats at once, before, after | 0 of 6 → 6 of 6 offline; 5 of 6 live       |
| 10 extreme questions, before and after four fixes     | 5 of 10 → 10 of 10                         |
| Live answers, 35 runs                                 | 34 passed; the miss was fixed and rerun    |
| First word, recall only                               | 1.4–3.2 s                                  |
| First word on "has it changed?", re-check off and on  | 8.1–10.0 s → 5.0–6.9 s on 3 of 4 questions |

Each live case ran once, on cases I wrote. A turn costs $0.0003 to $0.002.

## Considered and rejected

| Option                                     | Why not                                                          |
| ------------------------------------------ | ---------------------------------------------------------------- |
| A memory tool the model calls              | One more model round, about 2 s, on the brief's own questions    |
| A model call to rewrite or route the query | A serial call on every turn; recall in code passes 159 of 159    |
| Vector database, embedding API             | One user's vectors compare in 1 ms; the local model needs no key |
| Knowledge graph with multi-hop traversal   | Each level needs a model round; one hop passed every case        |
| Planner, researcher and writer agents      | More serial calls, more ways to fail                             |
| Overwriting a memory when a fact changes   | Loses "what was it on 3 November?"                               |
| Reading result pages in full               | On 3 answers that lacked a value, the full page held it in 0     |

## Limits

- Some answers end in "couldn't verify": a vendor's page can be served by region (Zoho's prices came back in rupees).
- "Has it changed?" turns still take 5 to 9 s to the first word.
- The prompt is about 3,000 tokens before the question, small talk included.
- The offline checks cover recall only: typing into the app found two bugs they missed. The no-search rule is a word pattern; other wordings fall back to the model.
- Subjects are named by the extraction model. Two names for one thing would hide a replacement.

## With another week

- Run LongMemEval for a number comparable with published systems.
- Re-check saved prices on a schedule and tell the user first.
- Run each live case several times, on real transcripts.

Every experiment is recorded in `MEMORY_ARCHITECTURE.md`.
