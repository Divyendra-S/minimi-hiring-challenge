# Design

## The idea

The brief's sample prompts all ask one thing: recall a past conversation by date, then check whether its facts still hold. So the rule is: **whatever code can do before the model runs, code does.** Code recalls, decides which value is current, and fetches the pages those values came from. The model compares and answers.

```
message ─► recall (code, ~10 ms)  ─► re-check sources if asked (code, one fetch) ─► model ─► answer
                                                          web_search, when needed ◄──┘
after the reply ─► one extraction call ─► memories ─► local embeddings   (the user never waits)
```

`src/core` holds the logic and is handed its model, search and database; `src/adapters` wrap OpenRouter, Tavily, SQLite (one file) and the embedding model. Tests swap them for fakes.

## How it works

- **Recall** (`core/memory/context.ts`, no model call). Date phrases become day ranges in the user's time zone, and those conversations are quoted. Memories are found by date, keyword (SQLite FTS5), meaning (a 23 MB local embedding model), entity, and one hop along entity links, then merged by reciprocal rank fusion. An empty section says "none".
- **The log is searched too.** Advice leaves no memory, so three past answers are quoted whole.
- **Who the user is.** Their decisions, facts and preferences ride along on every turn, one complete list each, newest first.
- **What is current.** Memories are append-only and carry a subject. When a newer one has the same subject, code marks the old one `[replaced on 6 Nov]` and the new one `[current]`.
- **Re-check** (`core/agent/recheck.ts`). Every claim keeps its source URL. When the message asks whether facts still hold, code fetches those pages, so the turn takes one model call, not two.
- **Search.** One `web_search` call carries up to 10 parallel searches, two rounds at most. Code adds a time window to a query that names a recent date, and offers no search when the message asks only for remembered values. Results are untrusted data, cited by number.
- **Writing memory.** After the answer, one structured call extracts preferences, facts, decisions and sourced claims. It runs in the web process, not on a separate worker; until it finishes, the chat is still found through the log. Chats imported from a JSON file take the same path.

## Results

On a 47-chat, 191-turn sample history:

| Check                                                   | Result                              |
| ------------------------------------------------------- | ----------------------------------- |
| Right context reaches the prompt, offline, in CI        | 159 of 159                          |
| Reworded questions, before and after embeddings         | 1 of 8 → 8 of 8                     |
| 10 extreme questions, before and after four fixes       | 5 of 10 → 10 of 10                  |
| All 191 turns imported, memories extracted by the model | 193 memories in 11 min, for $0.05   |
| 26 hard questions on that history, live                 | 23 of 26 → 25 of 26 after two fixes |
| The brief's 3 questions on that history, live           | 3 of 3                              |
| First word: recall only; "has it changed?"              | 1.4–3.2 s; 5–10 s, once 13.6 s      |

Each live case ran once, on cases I wrote. A turn costs $0.0003 to $0.002.

## Considered and rejected

| Option                                     | Why not                                                          |
| ------------------------------------------ | ---------------------------------------------------------------- |
| A memory tool the model calls              | One more model round, about 2 s, on the brief's own questions    |
| A model call to rewrite or route the query | A serial call on every turn; recall in code passes 159 of 159    |
| Vector database, embedding API             | One user's vectors compare in 1 ms; the local model needs no key |
| Knowledge graph with multi-hop traversal   | Each level needs a model round; one hop passed every case        |
| Overwriting a memory when a fact changes   | Loses "what was it on 3 November?"                               |

## Limits

- Extraction runs in the web process, 3 to 4 s a turn. A restart delays unfinished turns until the user's next message; production would use a queue and a worker.
- "Has it changed?" turns take 5 to 10 s to the first word, and some end in "couldn't verify": a vendor's page can be served by region.
- The prompt is 4,000 to 9,000 tokens on the long history, small talk included.
- Several rules are word patterns (no search, what changed, how many); other wordings fall back to the model.
- Subjects are named by the extraction model. Two names for one thing would hide a replacement.

## With another week

- Run LongMemEval for a number comparable with published systems.
- Re-check saved prices on a schedule and tell the user first.

Every experiment is recorded in `MEMORY_ARCHITECTURE.md`.
