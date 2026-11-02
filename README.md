# Goowa

A research editor where an AI agent drafts a document and every factual claim
becomes an editable claim card, verified against its source. Humans correct
claims, the agent proposes edits, and only a human can publish.

Built on [Agent-Native](https://www.agent-native.com/docs/) for the Builder.io
Agent-Native Hackathon.

**Status: Phase 0** — setup and spike only. See [NOTES.md](NOTES.md).

## What's here

- `actions/ping.ts` — echoes text; reports whether the UI or the agent called it.
- `actions/fetch-source.ts` — fetches a URL server-side, returns title, a
  2,000-char readable excerpt, a sha256 of the readable text, or a typed error.
- `/spike` — page that calls both actions from the UI.

The agent chat (`/chat`) calls the same two actions as tools.

## Run locally

Requires Node 22.22+ and pnpm.

```bash
pnpm install
cp .env.example .env   # add a provider key, e.g. ANTHROPIC_API_KEY
pnpm dev
```

Try it from the terminal:

```bash
pnpm action ping --text hello
pnpm action fetch-source --url https://en.wikipedia.org/wiki/Fact-checking
```

## Choosing the model

Set `AGENT_ENGINE` and `AGENT_MODEL` in `.env` (see `.env.example`). Supported
engines: `anthropic`, `ai-sdk:openai`, `ai-sdk:anthropic`, `ai-sdk:google`,
`ai-sdk:groq`, `ai-sdk:mistral`, `ai-sdk:cohere`, `ai-sdk:openrouter`,
`ai-sdk:ollama`, `builder`. A default set in Settings › Model takes precedence.

## Deploy

Netlify (config in `netlify.toml`). Needs `DATABASE_URL` (Postgres),
`BETTER_AUTH_SECRET`, and a provider key in the site's environment.
