# Search Agent

A chat agent with one tool, web search, that remembers past conversations.

How it works and why: [DESIGN.md](DESIGN.md).

## Run it

Needs Node 20.9 or newer (`nvm use` picks the version in `.nvmrc`).

```bash
npm install
cp .env.example .env   # add your OpenRouter and Tavily keys
npm run dev            # http://localhost:3000
```

To try recall without waiting a week, click **Load demo history** in the sidebar: it adds 47 past
chats, dated over the last eight weeks, with no API call.

## Scripts

| Command             | What it does                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`       | Start the app                                                                                 |
| `npm test`          | Unit tests (no API keys needed)                                                               |
| `npm run eval`      | Offline evals of memory recall (free); `-- --live <case ids>` also runs them on the real APIs |
| `npm run reindex`   | Rebuild every memory from the message log (uses the model)                                    |
| `npm run typecheck` | TypeScript check                                                                              |
| `npm run lint`      | Biome lint and format check                                                                   |
# minimi-hiring-challenge
