# Memory architecture: where it is, where it goes

Working plan for the memory part of the agent. PLAN.md covers the whole app; DESIGN.md (one page,
for the graders) will be written from this once the numbers are in.

## 1. What is being judged

The form says the agent should "answer fast, get things right, and remember what you asked and
when". The three sample prompts all have the same shape:

1. find an earlier conversation, by date ("on Monday", "3 November", "last Tuesday") or by topic
2. recall exactly what was said then
3. search the web for the state today
4. compare, item by item

So memory has to be good at five things. These are the five abilities the LongMemEval benchmark
measures, plus the web comparison:

| Ability                    | Example                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| Recall a detail            | "Which CRM did you say was cheapest?"                                  |
| Combine several chats      | "Across everything we discussed, what would the stack cost per month?" |
| Notice a fact that changed | Team was 20 people, later 25. Which is current?                        |
| Reason about time          | "What did I ask on 3 November?", "the chat before the Postgres one"    |
| Say "I don't know"         | "Last month you recommended a vector database" (never happened)        |
| Compare with today         | "Has any of them changed pricing since?"                               |

## 2. What exists today

**Write path** (background, after each answer, one model call): every message is logged with its
time; an extraction call turns the turn into memories (preference, fact, decision, or a web claim
with its source), each linked to the products and companies it names. Memories are append-only.

**Read path** (before each answer, in code, 1–6 ms, no model call):

1. dates in the message -> that day's conversations and their memories
2. BM25 keyword search over memories (SQLite FTS5, stemmed)
3. names in the message or the last 4 messages -> newest memories for each
4. the 20 most recent conversations with dates

This is retrieval-augmented generation, with keyword, name and date retrieval. There are no
embeddings.

**Known weak points**

- A reworded question with no shared words and no shared name finds nothing.
- Results are merged in a fixed order with fixed limits. With 30 chats, the right memory can be
  pushed out by 24 others.
- Only memories are searchable by keyword. Anything the extraction call skipped can be found by
  date only.
- An old value and its replacement look the same in the prompt; the model has to work out which is
  current from the dates.
- Tested on 3 conversations. That proves very little.

## 3. What to take from Mem0 and others, and what to leave

| Idea                                                   | From                                                            | Decision                                             | Why                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Extract facts from each turn in the background         | Mem0                                                            | Have it                                              | Keeps the reply fast                                                         |
| Entities linked to memories                            | Mem0 graph                                                      | Have it, as two SQL tables                           | A graph database is overkill for one user                                    |
| Retrieval is automatic, no memory tool                 | Mem0                                                            | Have it                                              | The brief allows one tool: web search                                        |
| Update or delete old memories when a new one conflicts | Mem0                                                            | **Leave**                                            | It destroys the old price, which "has it changed since?" needs               |
| Keep both versions, mark the old one as replaced       | Zep                                                             | **Add**                                              | Gives a price timeline and a clear current value                             |
| Recall by date                                         | Zep                                                             | Have it                                              | Our strongest part; most memory systems lack it                              |
| Semantic search with embeddings                        | Mem0, most RAG                                                  | **Add if the evals show reworded questions failing** | See section 5 for cost                                                       |
| Merge rankings by reciprocal rank fusion               | Mem0, search engines                                            | **Add**                                              | Replaces the fixed order; free                                               |
| Keyword search over the raw messages                   | LongMemEval's finding that raw turns beat extracted facts alone | **Add**                                              | Free; catches what extraction missed                                         |
| One-line summary per conversation                      | MemGPT/Letta                                                    | **Add**                                              | Comes from the existing extraction call, no extra cost                       |
| Second model to rerank results                         | Production RAG                                                  | Leave                                                | Adds a call and 300+ ms per turn for a store this small                      |
| Model rewrites the query before retrieval              | Many RAG stacks                                                 | Leave                                                | Same cost; the date parser already does the hard part                        |
| Memory as a tool the model calls                       | Letta                                                           | Leave                                                | Not allowed by the brief, and adds a round trip                              |
| Vector database (Qdrant, pgvector)                     | Mem0 default                                                    | Leave                                                | A few thousand vectors fit in SQLite and compare in under 5 ms in plain code |

## 4. Target read path

Five retrievers run in code, each returns a ranked list:

1. **Date**: conversations on the named days, and their memories
2. **Memory keywords**: BM25 over memories
3. **Message keywords**: BM25 over the raw message log (new)
4. **Names**: newest memories per named product or company
5. **Meaning**: nearest memories by embedding (new, only if section 6 step 3 says so)

Then:

- **Fuse** with reciprocal rank fusion: a memory found by several retrievers ranks higher. Date
  hits keep a fixed boost, since a named date is the strongest signal. Newer wins ties.
- **Mark replaced values**: among memories about the same product and topic, the newest is shown
  as current and older ones as "earlier value". Nothing is deleted.
- **Budget**: keep the best N by fused score, not the first N by retriever.

Write path changes: the extraction call also returns a one-line summary of the conversation, and
(if embeddings are adopted) each new memory is embedded in the same background step.

## 5. What embeddings would cost

A turn costs about $0.0008 today (measured).

| Option                                                       | Cost per turn                       | Added delay before the reply starts | Install                                                                        | Risk                                                            |
| ------------------------------------------------------------ | ----------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| None (today)                                                 | $0                                  | 0                                   | none                                                                           | Reworded questions can miss                                     |
| Embedding API, small model at about $0.02 per million tokens | about $0.000003, under 1% of a turn | 100–300 ms (estimate)               | none; same key if OpenRouter's embeddings endpoint works for us, to be checked | One more network call that can fail; must fall back to keywords |
| Local model (all-MiniLM-L6-v2 through transformers.js)       | $0                                  | 10–30 ms (estimate)                 | large native package, plus a model download on first run                       | `npm install` or the first run failing on the grader's machine  |

Storage either way: a BLOB column in SQLite, compared in plain code. No vector database.

**Decided: the local model.** The measurements in section 8 showed reworded questions failing
(1 of 8), so embeddings were needed. The local model won on three counts: it adds 1–3 ms per turn
where an API adds a network round trip before every reply; it needs no key and costs nothing; and
it can be tested offline, in CI, for free. What it costs: `node_modules` grows by about 450 MB
(most of it the ONNX runtime), the 23 MB model is downloaded on first start, and loading takes
about 2.5 s. None of that blocks a reply: the model loads when the server starts, and until it is
ready, or if it fails, recall runs on dates, keywords and names as before.

## 6. Build order

Each step is checked offline, with no API calls, unless marked.

1. **Hard history.** About 30 conversations over 8 weeks, in one data file used by both the evals
   and the demo button. It includes three Postgres chats (one on a different Tuesday), two CRM
   shortlists for different teams, a Neon price that changes between two chats, a team that grows
   from 20 to 25, two chats on 3 November, look-alike chats, and questions reworded so they share
   no keywords with the original.
2. **About 60 eval cases**, grouped by the six abilities in section 1. Report recall per ability:
   is the needed memory in the prompt, and is the distractor absent or marked as older? This is
   the baseline number.
3. **Fix what fails, cheapest first**: message keyword search, fusion, replaced-value marking,
   conversation summaries. Re-measure after each. Add embeddings only if reworded cases still fail.
4. **No-history answer.** On a fresh install, say there is no record, then still search and answer
   what can be answered.
5. **Import.** `npm run seed -- <file.json>` loads conversations (date, question, answer) from a
   simple JSON file, in case the graders want to load their own history. Imported chats go through
   normal extraction on first use.
6. **Live check** (needs approval): the brief's three prompts, about 10 calls, about $0.003.
7. **DESIGN.md** with the before and after numbers.

## 7. About LongMemEval

LongMemEval (ICLR 2025) is the most thorough public benchmark for long-term chat memory: 500
questions over long multi-session histories, covering the five abilities above. LoCoMo, which Mem0
reports on, is older and easier.

Running it in full is out of reach here: each question needs a model call over a long history,
which is far beyond the $0.02 budget. Two things are possible:

- **Our own set in its shape** (steps 1 and 2). This is what the plan relies on. It also covers
  what LongMemEval lacks: comparing a remembered answer with a fresh web search.
- **Retrieval-only run on the real dataset** (optional). The dataset labels which sessions hold
  the evidence for each question, so recall@k of our keyword and date retrievers can be measured
  with no model calls. It needs a download of a few hundred MB, kept out of the repo. Worth doing
  only if time allows; it gives one honest public number for DESIGN.md.

## 8. Results so far

Offline evals, 77 cases: the 32 earlier ones on the three-chat history, and 45 new ones on a
31-chat, eight-week history (`src/core/memory/demo-chats.ts`), grouped by ability.

| Group (long history)       | Before | + fusion, entity hop, first-chat line, date fix | + local embeddings |
| -------------------------- | ------ | ----------------------------------------------- | ------------------ |
| The brief's three examples | 1/3    | 3/3                                             | 3/3                |
| Recall a detail            | 8/8    | 8/8                                             | 8/8                |
| Combine several chats      | 2/5    | 4/5                                             | 5/5                |
| A fact that changed        | 5/5    | 5/5                                             | 5/5                |
| Reasoning about time       | 9/11   | 11/11                                           | 11/11              |
| Reworded questions         | 1/8    | 1/8                                             | 8/8                |
| Things that never were     | 5/5    | 5/5                                             | 5/5                |
| **All 77 cases**           | **63** | **69**                                          | **77**             |

Time in our own code per turn: p50 3 ms, p90 5 ms, embeddings included.

What these numbers do and don't show: they check that the right memories reach the prompt, and
that named distractors don't. They don't check what the model then writes; that needs the live
run (step 6), which has not been done. The history and the cases were written by the same hand,
so a pass rate of 100% means "no known failure", not "no failure".

What was built, against section 6:

- Step 1 and 2: done. The demo button now loads the same 31 chats.
- Step 3: done, except two items dropped. Keyword search over raw messages and per-conversation
  summaries turned out not to be needed by any failing case, so they were not built. Replaced
  values are not marked in code either: every memory line now carries its date and conversation,
  and the prompt tells the model that the newer of two conflicting memories is current.
- New in step 3: the entity hop. Memories found by date or keyword bring in what else is known
  about the products they name. That is how "is your 3 November answer still correct?" also
  surfaces the Neon price seen three days later.
- Steps 4 to 7: not started.

## 9. Live baseline (11 Nov 2026)

Everything above checks what reaches the prompt. This section is the model's actual answers, on
`openai/gpt-6-luna`, run with `npm run eval -- --live <ids>`. Rerun it after any change to the
prompt, the tool or recall; the numbers here are the floor.

**Vague and sloppy questions** (group `v`, 20 cases on the 31-chat history: "wat crm did u say
was cheapest", "headphones??", "and the tuesday before?", a wrong week, a false premise, a thing
that never happened).

|             | Offline: right memories in the prompt | Live: answer passes its checks            |
| ----------- | ------------------------------------- | ----------------------------------------- |
| First run   | 17/20                                 | 15/20                                     |
| After fixes | 19/20                                 | 18/20 (the 5 failures re-run: 4 now pass) |

What the first run got wrong, and what was done:

- Missed one of five CRMs ("any of the four..."): recall found only part of the shortlist. Fixed:
  the conversations the best finds come from are now completed with their other memories.
- "and the tuesday before?" found nothing. Fixed in the date rules.
- Searched the web to answer "remind me...", "what did I pick": correct answers, but 3 to 4 s
  instead of 1.5 s. Mostly fixed by saying so in the tool's description; a rule in the system
  prompt alone was ignored.

Known misses at the time (all three are closed in section 10):

- "am i still on railway or what" answers correctly, then also searches for current prices.
- "that db thing i asked abt, is it still same price??" answers about Neon only. The question
  is ambiguous, and widening recall for it would add noise everywhere else.
- "What did I ask you on 3 November? Is your answer still correct today?" with two chats on that
  day: the answer covers the Postgres chat fully and never mentions the other one. Five wordings
  of the instruction, in the system prompt and next to the data, did not change this.

**Speed, time to first word** (20 vague cases): p50 1.7 s, p90 4.1 s. No search: 1.2 to 1.7 s.
One search: 3.5 to 4.5 s, of which the search itself is 0.5 s and the rest is two model calls.

**Search**: Tavily's "fast" depth replaced "basic" after measuring 0.6 s against 1.4 to 2.3 s.

## 10. Second round: speed of search turns, and a harder set (11 Nov 2026)

**Where the time goes.** A turn that searches is two model calls with a search between them:
about 2 s for the model to decide and write its searches, 0.5 to 1.9 s for the search, and 1.3 s
or more before the second call's first word. Measured on the same questions:

| Tried                                                                | Result                                                         | Kept |
| -------------------------------------------------------------------- | -------------------------------------------------------------- | ---- |
| Reasoning effort "none" instead of "low"                             | Within run-to-run noise (1.4 to 2.5 s per call)                | No   |
| OpenAI's priority tier, at twice the price                           | Within noise                                                   | No   |
| OpenRouter routing by latency                                        | Within noise                                                   | No   |
| One call carries every search: each has its own `site` and `recency` | The CRM question went from 3 model calls to 2                  | Yes  |
| At most 2 search rounds (was 3)                                      | Bounds the worst case                                          | Yes  |
| At most 4 pages per search                                           | The last call read 60 pages before; now at most 40, usually 12 | Yes  |
| A live fetch may take 2.5 s, then the stored copy is used            | Bounds the worst case                                          | Yes  |
| Ask the model to write a sentence before searching                   | It never did; reverted                                         | No   |

| Time to first word       | Before       | After        |
| ------------------------ | ------------ | ------------ |
| No search (recall)       | 1.2 to 1.7 s | 1.3 to 1.7 s |
| One search round         | 3.5 to 5.5 s | 3.7 to 5.8 s |
| The brief's CRM question | 9 to 15 s    | 6.4 s        |

Single-search turns did not get faster: their time is two model calls, and the provider's own
speed moved between 2 and 4 s per call during the day. The live fetch of a vendor's page costs
about 1 s over the stored copy; it is kept because "has the price changed?" is the question.

**The harder set** (group `x`, 16 cases: two dates at once, a time of day, a false premise with
a date, sums on remembered numbers, recall plus a fresh check, follow-ups).

- Offline it found four faults before any model call: "the morning of 3 November" and "two
  Mondays ago" were not understood, weeks ran Sunday to Saturday, and the words "per" and "re"
  (from "we're") pulled in a dozen unrelated prices. All fixed in `dates.ts` and `context.ts`;
  "on the 3rd" and "the weekend" were added too. Offline is now 113 of 113.
- Live, 12 of 16 passed. The other four answers were right and the checks were wrong (one
  wanted the word "Postgres" where the answer said "Neon, Supabase and Railway"; one forbade a
  search that was reasonable). The checks were corrected; all four pass on a rerun.

**Regression**, 21 cases across every group, the brief's three included: 21 of 21.

**The three old misses:**

- Two chats on 3 November, only one named. Fixed in two steps: a note at the end of the
  context names the day's conversations, and the search results end with one line asking for
  every part of the question. With the note alone it passed 4 runs in 6; with both, 3 in 3.
- "am i still on railway" searched for prices. Fixed by one clause: no web page knows what
  this user chose.
- "that db thing" answers about Neon only. Reclassified: five chats were about databases, and
  the one the user ended up on is a fair reading. The check no longer demands Supabase.

**Found on the way:**

- The model renumbered its citations and wrote its own source list, so [2] no longer pointed
  at source 2. Now forbidden in the prompt; the check that caught it is "cites a page of the
  vendor's domain".
- Asked "has pricing changed since last Tuesday?", it sometimes started from the newer memory
  (6 Nov) and never gave the price of the day asked about. The rule now asks for every step:
  "$19 on 3 Nov -> $5 on 6 Nov -> today's". 2 runs in 2 after the change.

**What is not shown.** Each case ran once, except the two above. The last two changes (the
line after the search results, and the every-step rule) came after the 21-case regression and
were rerun only on the brief's two questions they concern. Answers vary from run to run: a pass
is one good answer, not a guarantee.

## 11. Rerun after the move to libsql (11 Nov 2026)

The whole live set again, on the new database driver: the 20 vague cases and the brief's three
on Node 24, the 16 hard cases on Node 20.

|                       | Result                 | Time to first word                                 |
| --------------------- | ---------------------- | -------------------------------------------------- |
| Vague (20)            | 20 of 20               | no search 1.3 to 2.1 s; with search 3.9 to 4.9 s   |
| Hard (16), on Node 20 | 16 of 16 after one fix | no search 1.2 to 1.7 s; with search 3.4 to 4.2 s   |
| The brief's three     | 3 of 3                 | CRM 5.5 s, 3 November 3.8 to 4.4 s, Postgres 4.4 s |

- One real fault, fixed: asked "Have I ever asked you about Kubernetes?", the model said it
  could not tell because the list of conversations is not complete. The context now says that
  the memories were searched across every conversation. 4 runs in 4 after the change.
- Two failures were the checks': a correct answer said "side-project database" where the check
  wanted "Postgres", and "I don't have any earlier conversation" was not on the list of ways
  to say "no record". Both checks were widened.
- The driver changed nothing in the answers or the timings: our own code takes 4 to 6 ms a turn.

## 12. Third round: a longer history, replaced values, and re-checking in code

**Why.** The sample history was 31 chats and 41 turns: most chats were one question and one answer, which is too easy to recall from.

**The history now.** 47 chats and 191 turns, written by hand with no model call; the answers are full-length replies, about 980 characters on average. Most chats have three to five turns, and facts sit in the later turns. Two more values change over time (the side project's analytics and Pipedrive's price).

**What broke.** The 113 existing checks, run unchanged on the longer history: 106 passed.

| Failure                                           | Cause                                                           | Fix                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| "What did I ask in September?", "three weeks ago" | A range was quoted in full, up to 40 messages; a month has more | Up to 40 messages in full, up to 160 as questions only, then first questions |
| "List every tool I've decided to use", "my stack" | 24 memories were too few once there were 25 decisions           | Keyword matches 12 → 24, nearest 8 → 12, total 24 → 40                       |
| "last week ... what did I pick"                   | Only the newest 16 memories of a date range were considered     | 16 → 60, so a second signal can lift an older one                            |

After the fixes: 113 of 113, and 135 of 135 with 22 new checks on later turns, replaced values and re-checks.

**Replaced values.** A memory can carry a subject. Recall adds every memory with the same subject and marks them `[replaced on <day>]` or `[current]`. Extraction is shown the subjects already in use, so it reuses a name.

**Re-check in code.** When the message asks whether remembered web facts still hold (two regular expressions), code fetches the sources of the matching claims with Tavily Extract before the first model call. Pages are fetched only for claims found in two ways, or for all claims of a named day when no topic is given. One loose match is not enough: an earlier version fetched five pages by rank, and two to four of them were off topic.

**Live runs** (11 Nov 2026, each case once, `gpt-6-luna`).

- 20 cases on the longer history: 19 passed. No-search questions gave their first word in 1.5 to 3.2 s. The miss: "that db thing i asked abt, is it still same price??" was answered about the work database (AWS RDS), not Neon; there are now four database chats, and the answer named only one.
- First version of the re-check, which asked each page for passages about the user's question: the model searched again in 6 of 8 cases, because the passages often left the price out. Those turns took two model calls plus the fetch.
- Second version, which asks each page for passages about its own claim: the model searched again in 4 of 7, then in 1 of 4 on the rerun below.
- Back to back, same four questions, on an hour when the provider was about twice as slow as earlier (no-search first word 3.8 to 4.7 s):

| Question                                     | First word, re-check off | First word, re-check on | Model calls on |
| -------------------------------------------- | ------------------------ | ----------------------- | -------------- |
| The brief's Postgres question                | 10.0 s                   | 6.9 s                   | 1              |
| "Did Pipedrive's price change since Monday?" | 8.6 s                    | 5.0 s                   | 1              |
| "Is Slack Pro still $8.75 a user?"           | 8.1 s                    | 6.7 s                   | 1              |
| "Is the MacBook you recommended still $999?" | 10.8 s                   | 12.7 s                  | 2              |

- With the re-check off, one answer in four cited nothing after searching; with it on, all four cited the page.
- After this run: the fetch timeout went from 3 s to 2 s (two fetches had hit 3 s), and a product named in the message now narrows which pages are fetched (the Slack question had fetched four pages, three of them off topic). These two changes are tested offline only.

**What this does not show.** Four questions, one run each, on a slow hour. The five-CRM question still takes two or three model calls, because "shipped something big" needs a news search that no saved page answers.

## 13. Fourth round: full-length answers, and searching the log itself (11 Nov 2026)

**Why.** The sample answers were rewritten as full replies (about 980 characters; they were about 90). Two things showed up that short answers had hidden.

**1. A detail deep in an answer never reached the prompt.** Memories hold preferences, facts, decisions and sourced claims. Advice (how to get to Sintra, an offsite agenda, a recipe, restore steps) leaves no memory, so it could be found only by naming its day, and then the answer was quoted cut to 400 characters. Eight new checks ask for such details (group `z`): 0 of 8 passed.

Fix: the log is searched as well. An FTS5 index holds one row per answer (the question and the answer; it stores no text of its own, and a trigger keeps it current). Up to three past answers are quoted whole, 1,500 characters each: the answer the top-ranked memory was learned from, then the best keyword matches. When the message names days that have conversations, only those are searched.

| Past answers quoted | Group `z` | All checks |
| ------------------- | --------- | ---------- |
| 0 (before)          | 0 of 8    | 135 of 143 |
| 1                   | 3 of 8    | 138 of 143 |
| 2                   | 7 of 8    | 142 of 143 |
| 3                   | 8 of 8    | 143 of 143 |

- Keyword search alone passed 7 of 8 with three answers. The eighth ("what should I book first for the Portugal trip") shares no word with the chat; the memory found by meaning points to its answer.
- Cost: the median context went from about 4,900 to 8,200 characters (about 850 tokens). Recall takes 5 ms p50, 7 ms p90 (4 and 6 before). An existing database of 799 answers was indexed in 12 ms on first start.
- Tried and dropped: a score cut-off to keep off-topic answers out. BM25 scores did not separate them: "How do we get to Sintra again?" scores 5.8 on the right answer, "Thanks, that was really helpful!" scores 6.5 on an unrelated one. So small talk also gets up to three old answers quoted. The prompt says to ignore the ones about something else.

**2. The "that db thing" miss.** With no day and no product named, code still fetched pages for claims found in two loose ways. Here that was one page (AWS RDS) out of four database chats, and the answer covered only that one. Now code fetches only when the message names a day or a product; otherwise the model searches for itself, as it did before the re-check existed. Six of the other 23 "is it still so?" questions in the set lose the fetch this way, among them "did the laptop get cheaper", "Are the CRM prices you gave me still right?" and "Is the MacBook you recommended still $999?": they take two model calls again, not one. The brief's three questions name a day and keep it.

**Live run** (11 Nov 2026, four questions, each once, `gpt-6-luna`, 5 model calls in all). All four passed.

| Question                                    | Result                                                                                     | First word | Model calls |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------- | ----------- |
| "that db thing i asked abt, is it still..." | Answered for both readings: Neon (side project) and AWS RDS (work), each checked and cited | 6.0 s      | 2           |
| "How do we get to Sintra again?"            | Rossio train, 40 minutes, bus 434, timed Pena ticket: all from the quoted answer           | 1.5 s      | 1           |
| "what was the rough agenda ... offsite?"    | The full agenda with times, and the 18:00 finish                                           | 1.8 s      | 1           |
| "Thanks, that was really helpful!"          | "You're welcome": the quoted answers were ignored                                          | 1.5 s      | 1           |

One run each, so this shows the changes work, not how often. The six vague questions that lost the fetch were not rerun.

## 14. Fifth round: why some answers end in "couldn't verify" (11 Nov 2026)

**Second live run after section 13** (six questions, each once): all six passed their checks, including the brief's three. But three answers said "couldn't verify": the MacBook Air's price, Node's latest patch version, and Zoho's price in dollars. First word on the brief's three: 5.7, 9.1 and 9.4 s.

**Guess: the model sees only snippets, so read the page in full.** Tested on those three questions, with Tavily's `include_raw_content`:

| Tried                                               | Value found                      | Time per search |
| --------------------------------------------------- | -------------------------------- | --------------- |
| Full text of the pages the site search returned     | 0 of 3                           | 0.4 to 1.5 s    |
| The same query on the open web, no `site`           | 3 of 3, all on third-party pages | 0.7 to 1.1 s    |
| `search_depth: basic`, with and without a `country` | Better pages; a value on 1 of 3  | 2.3 to 4.6 s    |

- The cause is which pages the fast search returns for a `site`, not how much of them is shown: Apple's Hong Kong store in Chinese, Node's 2019 blog post in five languages, and Zoho's rupee page. `country` is refused at `fast` depth.
- Built and reverted: every `site` search also ran on the open web, and two of its four results came from there. Five live questions passed, but none of the three answers improved. The model did not use a third-party price (Best Buy's $975) in place of the vendor's, which is defensible. It cost one more Tavily request per search, so it was removed.
- Adopted: a `site` search already runs twice at once (live pages, and Tavily's copy as a fallback). The second one now runs at `basic` depth, and the two lists are taken in turn. Open-web and news searches stay at `fast`. Live at `basic` was not used: it took 3.4 to 4.6 s and returned no page for Neon.

Five live questions, before and after (each once):

| Question                           | Before                                  | After                                                     | First word   |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------------- | ------------ |
| "did the laptop get cheaper"       | "the page doesn't show a price"         | $1,199 → $999 for the same model, citing Apple's buy page | 5.7 → 5.7 s  |
| "latest LTS version of Node.js?"   | Node 26 in one run, Node 24 in the next | Node 26, after a second search round                      | 6.9 → 12.3 s |
| The brief's five-CRM question      | Zoho's dollar price not confirmed       | The same: the page is still shown in rupees               | 9.0 → 8.5 s  |
| "Is Slack Pro still $8.75 a user?" | Correct                                 | Correct                                                   | 5.1 → 5.0 s  |
| The brief's Postgres question      | Correct                                 | Correct                                                   | 6.6 → 6.5 s  |

So one of the three weak answers is fixed, one is unchanged, and the Node answer is right but took three model calls in this run. The slowest search took 1.6 to 2.8 s. Zoho stays a limit: its pricing page is served by region.

## 15. Two bugs found by using the app (11 Nov 2026)

Both were found in five prompts typed into the running app, after 143 offline checks had passed.

- **"Is your answer still correct today?" re-checked the wrong pages.** "today" was read as a day to recall, so today's chats were quoted and their sources (a cricket page) were fetched in place of the ones from 3 November. The test history had no chats dated today. Fix: next to an earlier day, today is when to compare, not a day to recall. Rerun in the app: the three pricing pages were fetched and cited.
- **Only the first turn after each start was memorized.** The extraction job waited for an embedding job queued behind itself, so the queue never moved again. 8 of 186 memories had no vector, and seven turns had no memories. The offline checks seed memories directly and never ran the queue. Fix: embedding runs inside the extraction job.

What this says about the evidence: the offline checks cover recall, not the write path under real use.

## 16. Sixth round: questions that need many chats at once (11 Nov 2026)

**Ten harder prompts, typed into the app through a browser:** 5 passed, 2 were partly right, 3 failed. Rebuilding the context for the five weak ones showed that every miss was recall: the facts were not in the prompt.

| Question                                                                          | What was missing                                | Cause                                                                                                                                                     | Fix                                                                                                                                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Add up what I pay per month for everything I've decided on for the side project" | The prices of two of the tools (Vercel, Resend) | Nine decisions and their prices did not fit in 40 lines; keyword noise ("month", "prices") took the places                                                | 40 → 60 memories                                                                                                                                                              |
| "What do you know about my family?"                                               | Daughter's age, partner, father                 | "family" is not close in meaning to "The user's father turns 60": similarity 0.1 to 0.15, the same as unrelated memories                                  | The user's facts, preferences and decisions are sent on every turn ("About the user"), newest first, up to 120, without the ones a newer one replaced                         |
| "Which restaurants did you suggest for the Portugal trip?"                        | The answer that names them                      | It has no memory, the chat never says "Portugal", and three long answers that say "trip" outranked the turn that asked "Any good vegetarian restaurants?" | The keyword search over answers looks first in the conversations the best memories come from, and a word found in the past question counts four times one found in the answer |
| "PandaDoc, Fathom and Sales Navigator for the people who'd use each"              | Who uses each: 12 account executives, 8 SDRs    | The sample history had no memory for "Only the 12 account executives send contracts", which extraction would save                                         | Three memories added to the sample history; "About the user" carries them                                                                                                     |
| "List every database decision"                                                    | Nothing after the fixes                         | The model lists only the two hosting decisions                                                                                                            | Not fixed: an instruction to be complete did not change it                                                                                                                    |

**Offline:** six new checks (group `w`): 0 of 6 before, 6 of 6 after; all checks 149 of 149. Recall takes 7 ms p50, 10 ms p90. The median context grew from about 8,200 to 12,300 characters.

**Live** (each once or twice, `gpt-6-luna`):

- First run of the six: 5 passed. "About me" said the project uses Redis, from the fact "would use Redis to cache": the decision not to add it was not in the profile. Decisions were added, and the rerun got it right.
- Still wrong after the rerun: "12 account executives and 13 SDRs". The history says 12 and 8, then five more reps; the model worked out 13.
- The cost question gave the right total ($71) in three runs of three, but searched the web in two of them, although it asks for "the prices you gave me". Two wordings of the rule did not stop it.
- Five earlier questions rerun as a regression check, the brief's "3 November" among them: all passed.

**What this does not show.** The six checks were written from the app's own failures, and three memories were added to the sample data for one of them. The fixes are general (a profile, a larger budget, a better turn search), but they have not been tried on questions I have not seen.
