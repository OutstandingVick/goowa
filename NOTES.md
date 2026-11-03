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
  `netlify.toml`; removed. Netlify is only the template default — we deploy to
  Vercel (`NITRO_PRESET=vercel`); `netlify.toml` is unused.
- **Vercel Hobby crons run once a day**, so scheduled automations lag up to
  24h unless we upgrade or move hosts.
- **`ACCESS_TOKEN` only authenticates `/mcp`**, not `/_agent-native/actions/*`.
  Plain HTTP callers need a token minted with `connect`.
- **Production has its own database**, so the Builder.io connection and users
  must be set up again there.
- **Serverless realtime is polling**, not push: fine for one editor + agent,
  but expect seconds of lag for multi-user.
- **Production needs Postgres.** PGlite is local only; deploy needs
  `DATABASE_URL` and `pnpm migrate:production`.
- **fetch-source** uses the framework's `ssrfSafeFetch` (DNS-aware private
  address blocking, re-checked per redirect). It does not run JavaScript, so JS-rendered pages
  return little text. Paywalls/bot blocks surface as `http_status` errors.

# Phase 1 — data model and actions

## Schema (Postgres via Drizzle; `server/db/schema.ts`, migrations in `server/plugins/db.ts`)

- `documents`: id, title, topic, body (plain text/markdown), status
  (`draft | in_review | published`, a `defineMachine`), createdAt, updatedAt,
  owner_email, org_id, visibility (framework `ownableColumns`; private by default).
- `sources`: id, documentId, url, title, textExcerpt, contentHash, fetchedAt,
  flags (jsonb), error (jsonb, set when `fetch_failed`).
- `claims`: id, documentId, text, spanStart, spanEnd (UTF-16 offsets into
  body, half-open), sourceIds, status, confidence (0–1), dependsOn (claim ids),
  createdBy/updatedBy (`creator_kind`/`updater_kind` in SQL).
- `edits`: id, documentId, targetType (`document_body | claim`), targetId,
  spanStart, before, after, reason, proposedBy, state
  (`proposed | accepted | rejected`, a `defineMachine`), decidedBy (SQL CHECK:
  only `human`), decidedAt, createdAt.

## Where the framework forced a different design

- **No SQLite.** The framework is Postgres-only (PGlite locally, Neon in prod).
- **No LLM calls inside actions.** `draft-document` and `extract-claims` take
  the agent's output (body; claims as exact quotes) instead of calling a model.
  The agent loop is the LLM. The fixture script drives it with
  `agent-native agent "<prompt>"`.
- **"Retry once on invalid output"** is the agent's own retry: validation
  failures use `goowaErrors.noWrite(...)`, which tells the framework nothing was
  written. A plain failure on a write action makes the framework block a retry
  in the same turn, because the write might have applied.
- **Identity column names.** `created_by`/`updated_by` are reserved for member
  emails, so the SQL columns are `creator_kind`/`updater_kind`/`proposer_kind`/
  `decider_kind`.
- **Raw DB tools.** `sources`, `claims`, `edits` are on the doctor
  `dbToolScopingDenylist`, and the agent's framework DB tools are pinned to
  read-only, so the agent can't write `status = 'supported'` with SQL.
- **`needsApproval` not used** for decide-edit: it would let a human approve
  the agent accepting, which still makes the agent the decider.

## Permission model

`server/lib/actor.ts`: `frontend` and `cli` are human; `tool`, `mcp`, `a2a`,
`automation`, `http`, and unknown callers are the agent (fails closed).
`decide-edit` and `set-document-status` are `agentTool: false`,
`mcpTool: false`, and call `requireHuman` first. `add-claim`/`update-claim`
refuse status, confidence, and dependsOn from the agent; an agent's text change
becomes a proposed edit. Tests: `tests/permissions.test.ts`.

## Limits found

- Ingested sources keep only a 2,000-character excerpt, so drafts and claims
  can only use the start of each page.
- `pnpm action` resolves `.js` imports of `.ts` files; `agent-native agent`
  needs `NODE_OPTIONS=--import tsx` to load the same actions.
- Production access needs a signed-in user: the static `ACCESS_TOKEN` has no
  identity, so ownership-scoped actions refuse it.

# Phase 2 — editable surface

## Editor model

The body is shown as a read view, not a free-typing editor. `shared/segments.ts`
cuts each block at every claim and proposal boundary; every rendered text
element carries `data-start`/`data-end` body offsets, so a highlight is exactly
`body.slice(spanStart, spanEnd)` and `app/lib/selection.ts` maps a DOM
selection straight back to body offsets. All changes go through actions
(`propose-edit`, `update-claim`, `add-claim`, `decide-edit`) and the server's
`applyBodyEdit` re-maps spans; the page re-renders from the new offsets, so
highlights cannot drift.

- Routes: `/docs` (list + create), `/docs/:id` (editor). `/home` redirects to
  `/docs`; `/debug` still works but is out of the nav.
- Live updates: `useDbSync` already refreshes after the in-app agent's tool
  calls. The editor also opts into `realtime` with a reason and holds
  `acquireCollabPollBoost()` (2.5 s polling) so MCP agents and other people
  appear without a refresh.
- "Ask agent to fix" uses `sendToAgentChat({ message, context, submit })`. The
  context (hidden from the chat UI) holds documentId, the exact selection and
  offsets, overlapping claims, and the user's note; the system prompt says a
  selection is what "this" means and the answer is a `propose-edit` call.
- No action behaviour or permissions changed. Summary counts, source domains,
  and proposal placement are computed client-side from `get-document-state`.

## Alignment edge cases found

- **Overlapping claims** split into shared and single-claim segments; the
  innermost (shortest) claim decides the colour, and a thicker underline marks
  the overlap.
- **Claims crossing a heading** are clipped per block; the heading's `## `
  marker is never rendered but keeps its offsets.
- **Proposals inside a claim** render as `<del>` inside the claim highlight
  plus an `<ins>` after it. Selecting inside proposed text snaps to its
  anchor, because that text is not in the body yet.
- **Stale proposals** (their `before` text is gone) are not drawn inline; the
  drawer marks them "Text changed since proposed" and disables Accept.
- **Claims an accepted edit destroyed** end with an empty span; the card shows
  "Not in text" and the claim is reset to unverified.
- **Emoji and other astral characters** work because offsets are JS string
  indices on both client and server; a selection can never split a surrogate
  pair because it comes from the DOM.
- An accepted claim edit resizes the claim and resets it to unverified (its
  meaning changed), by design.

## What Phase 3 (verification) needs from the UI

- **Verification results** belong on the claim card, under the status row: the
  verdict, a confidence (the bar is already wired to `claim.confidence`), and
  which source passages support or contradict it. The highlight colour already
  follows `status`.
- **Snippet previews**: each cited source on the card should expand to the
  matching passage from the source (with the match highlighted), plus
  fetchedAt and whether the source's `contentHash` changed since ingest.
- **Quarantine / laundering warnings**: the `quarantined` status already has
  its own striped purple style and shield icon. A source with
  `injection_suspected` should show a warning chip on every card that cites
  it and in the top bar's summary; a claim whose only support is another
  claim (`dependsOn` chains with no independent source) should get a
  "circular support" warning on its card and in the drawer.
- A per-claim "Verify" button and a top-bar "Verify all" would call the Phase
  3 actions; results should stream in through the same live sync.
