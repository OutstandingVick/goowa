# Goowa — Phase 0 notes

Framework: `@agent-native/core` 0.222.2, scaffolded with
`npx @agent-native/core@latest create goowa --standalone --template chat`.

## How actions, UI, and agent are wired

- **One file per capability in `actions/`.** The filename is the action name
  (kebab-case), the default export is `defineAction({ description, schema, run })`.
  That is why the source spike lives in `actions/fetch-source.ts`, not
  `fetchSource.ts`: a camelCase file would register as `fetchSource` and break
  the convention every other action and the generated types follow.
- **The framework fans each action out** to: an agent tool (name + zod schema +
  description), HTTP at `/_agent-native/actions/<name>` (POST by default,
  `http: { method: "GET" }` for reads), typed React hooks, the CLI
  (`pnpm action <name> --arg value`), MCP (`/mcp`, when `mcpTool` allows), and A2A.
- **UI** calls actions with `useActionQuery` (reads) / `useActionMutation`
  (writes) / `callAction` from `@agent-native/core/client/hooks`. Types are
  inferred from `.generated/action-types.d.ts`. No custom `/api` routes.
- **Agent** sees every action as a tool. `server/plugins/agent-chat.ts` lists
  `initialToolNames` (loaded on turn 1; others are found via `tool-search`) and
  holds the system prompt.
- **Caller context:** `run(args, ctx)` receives `ctx.caller`:
  `"frontend" | "tool" | "http" | "cli" | "mcp" | "a2a" | "automation"`, plus
  `ctx.userEmail`, `ctx.orgId`, and run/thread ids for agent calls. `ping` maps
  `frontend → ui`, `tool → agent`, everything else → `unknown`.
- **Model selection:** `AGENT_ENGINE` + `AGENT_MODEL` env vars, below an
  org default set in Settings › Model (which wins). Engines: `anthropic`
  (default), `ai-sdk:anthropic`, `ai-sdk:openai` (+ `OPENAI_BASE_URL` for any
  OpenAI-compatible endpoint), `ai-sdk:google`, `ai-sdk:groq`, `ai-sdk:mistral`,
  `ai-sdk:cohere`, `ai-sdk:openrouter`, `ai-sdk:ollama`, and `builder` (Builder.io
  managed gateway). Keys can also be pasted per user/org in Settings › Model.

## What the framework gives us for Goowa

| Need | Status | How |
| --- | --- | --- |
| Shared state / data storage | **Available** | Postgres via Drizzle (`server/db`), PGlite locally, any Postgres in prod (`DATABASE_URL`). Plus `application_state` for UI/navigation state the agent can read. Claims, sources, and edges would be our own tables. |
| Approval before actions | **Available** | `needsApproval: true` (or a predicate) on `defineAction` pauses the agent loop until a human approves that exact call. For "agent may never accept/publish", the stronger tools are `agentTool: false` (the model never sees the action) and `authorize` / checking `ctx.caller === "frontend"` inside `run`. |
| Human vs agent attribution | **Available** | Built-in audit log (`agent_audit_log`): every mutating action records actor (agent/human/system + email), surface (`tool`, `frontend`, `mcp`…), thread/turn ids, outcome, redacted inputs. `ctx.caller` lets us also stamp attribution onto our own rows. |
| MCP exposure | **Available** | `/mcp` is auto-mounted (Streamable HTTP, OAuth 2.1 or bearer `ACCESS_TOKEN`). Per-action `mcpTool: true/false`. `ping` and `fetch-source` are exposed. |
| Auth | **Available** | Better Auth: magic link, email/password, social, orgs/roles. `AUTH_DISABLED=true` for local dev only. Prod needs a stable `BETTER_AUTH_SECRET`. |
| Real-time sync | **Available** | `useDbSync` refreshes queries after agent tool calls (default) and can opt into polling for other users. Collaborative docs: Yjs CRDT + TipTap with the agent as a peer (Real-Time Collaboration docs) — directly relevant to the editable doc. |

## Surprises and limits

- **Filenames are the API.** `fetchSource.ts` would have worked but been the
  only camelCase action; used `fetch-source.ts`.
- **Org setting beats env.** A model picked in Settings › Model overrides
  `AGENT_ENGINE`, so env is a default, not a lock.
- **Actions should stay deterministic.** The docs push LLM work into the
  agent loop rather than into actions. Claim extraction/verification should be
  the agent calling small actions (`fetch-source`, `create-claim`,
  `propose-edit`) rather than an opaque `verify-claims` action that calls a model.
- **CLI calls report `ctx.caller = "cli"`**, so `ping` says `unknown` there.
- **Template ships with Builder's analytics IDs and trusted origins** in
  `netlify.toml`; removed.
- **Serverless realtime is polling**, not push: fine for one editor + agent,
  but expect seconds of lag for multi-user.
- **Production needs Postgres.** PGlite is local only; deploy needs
  `DATABASE_URL` and `pnpm migrate:production`.
- **fetch-source** uses the framework's `ssrfSafeFetch` (DNS-aware private
  address blocking, re-checked per redirect). It does not run JavaScript, so JS-rendered pages
  return little text. Paywalls/bot blocks surface as `http_status` errors.
