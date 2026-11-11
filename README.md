# Search Agent

A chat agent with one tool, web search, that remembers past conversations.

## Run it

Needs Node 22 or newer (`nvm use` picks the version in `.nvmrc`).

```bash
npm install
cp .env.example .env   # add your OpenRouter and Tavily keys
npm run dev            # http://localhost:3000
```

## Scripts

| Command             | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Start the app                   |
| `npm test`          | Unit tests (no API keys needed) |
| `npm run typecheck` | TypeScript check                |
| `npm run lint`      | Biome lint and format check     |
# minimi-hiring-challenge
