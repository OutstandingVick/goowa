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

# Phase 3 — verification engine

## Pipeline (`shared/verify/*`, `server/lib/verify.ts`)

1. **Gate**: no sources → `unsupported`; every cited source quarantined or
   unreadable → `unverifiable`.
2. **Exact** (deterministic): the claim, or its core after an attribution
   lead-in like "Circle says", appears verbatim in a source (folding case,
   curly quotes, dashes, whitespace) → `supported`, matchType `exact`.
3. **Retrieval** (deterministic): sources split into 1–2 sentence passages,
   ranked by weighted word overlap (numbers, dates, %, names ×3); top 3 per
   source.
4. **Laundered** (deterministic): best overlap < 0.3 on a source that loaded
   → `laundered`, with the closest passage saved for the side-by-side view.
5. **Numeric mismatch** (deterministic): best overlap ≥ 0.6 but the claim's
   figures are not in the passage → `weak`, quoting the conflicting sentence.
6. **Judgment** (`decide()` from `@agent-native/core/decisions`, the
   framework's only sanctioned model call in actions): two choice questions,
   the support level and which candidate sentence is the evidence. The model
   can only pick ids of sentences taken from the stored text, so it cannot
   quote text that is not there. Confidence is the chosen answer's
   probability.
7. **Snippet check**: every snippet must equal the stored text at its offsets,
   else `unverifiable` ("Model cited text not in source").
8. **Numeric guard**: claim figures missing from the evidence (with variants
   such as 40% / 40 percent / 0.4, $1.2B / 1.2 billion) cap the verdict at
   `weak`.

Verdicts live in `claims.verdict*`, `evidence`, `closest_passage`,
`verified_at`, `verifier_kind`; the human `status` is never written by
verification (tested in `tests/verify-store.test.ts`). The UI shows a
quarantine lock first, then the human status, then the verdict.

## Injection and quarantine (`server/lib/injection.ts`, `quarantine.ts`)

Deterministic rules on raw HTML and text: instruction phrases aimed at AI,
hidden elements (display:none, visibility:hidden, zero font, zero opacity,
off-screen, white text, `hidden`), suspicious `<meta>` and comments,
zero-width characters. Hidden text only counts when it is instruction-like or
addressed to an AI (real sites hide menus; Circle's docs hide an `llms.txt`
notice with `aria-hidden`, which is not a signal). `decide()` can give a
second opinion. Any finding → `injection_suspected` + `quarantined`; hidden
spans and instruction sentences are stripped from stored text, and the
remaining excerpt reaches agents fenced as `⟦UNTRUSTED SOURCE DATA⟧`.
Proof the drafting agent ignores it: `docs/injection-proof.md`.

## verify:fixture results (3 runs, identical)

Every run: 8/8 claims PASS, injected source quarantined on ingest, all
evidence snippets found at their offsets in stored text, re-run without force
skips 8/8. Average verification time per claim: 131–207 ms (deterministic
paths are a few ms; the one model-judged claim takes about 1 s; wall time for
8 claims about 1–1.5 s at concurrency 3).

## Flakiness and how it was stabilised

- Only one fixture claim (the paraphrase) reaches the model; its expected
  verdicts are `supported|weak`. Exact, laundered, numeric mismatch, and
  quarantine are decided by rules, so they cannot flip.
- The 38%-vs-45% claim originally went to the model, which could answer "does
  not support" (mapped to `laundered`). It is now a deterministic numeric
  mismatch.
- `decide()` calls pass a `cacheKey` of claim + candidates.
- Two non-model sources of instability were fixed: a false-positive
  quarantine of Circle's docs (aria-hidden rule removed), and truncated CLI
  JSON over pipes in the script (partial writes now retried).

## What Phase 4 needs from this engine

- **Dependency propagation**: `claims.dependsOn` plus the verdict give the
  graph; a downstream claim's effective trust should be capped by its weakest
  upstream claim. `verifiedFingerprint` is the hook: clearing it on a claim
  (as `check-staleness` and quarantine already do) marks it for
  `verify-document`, so propagation can clear fingerprints downstream.
- **Publish gate**: block when any claim's effective status is `laundered`,
  `unsupported`, `quarantined`, or still `unverified`, or when any cited
  source is `stale`/`quarantined`, unless a human has set the status. Both
  verdict and human status are on the claim, so the gate is a pure function.
- **Receipt**: for each claim, verdict, reason, evidence offsets, the source
  `contentHash` and `fetchedAt` at verification time, `verifiedBy/At`, and the
  human override and note. `check-staleness` re-checks hashes at publish time.

# Phase 4 — propagation and the publish gate

## Propagation (`server/lib/propagate.ts`, `shared/graph.ts`, `shared/derive.ts`)

Runs inside the actions that change a claim: a human edit of text, sources,
or status (`update-claim`), an accepted edit (`decide-edit`), the agent's
source changes, or `propagate-change` by hand.

1. Breadth-first walk of dependents (depth ≤ 5). Each gets
   `review_state = needs_review`, a reason naming the upstream claim
   ("Depends on claim #1, which changed from $160 billion to $200 billion"),
   `last_propagated_from`, and a forced re-verify.
2. For direct dependents, `deriveRewrite` finds how each figure relates to the
   old upstream figure (restated, growth from a stated base, ratio to a stated
   quantity, share of a stated total) and recomputes it from the new one in
   code, keeping format and precision. Only those figures (and an adjacent
   a/an) change; every other word is untouched. No model does arithmetic.
3. Rewrites are proposed with `proposedBy: "agent"` and grouped in a change
   set (`change_sets`, `edits.change_set_id`). A human accepts or rejects.
4. Dependents with no computable relation stay `needs_review`; the agent may
   propose a minimal edit with the change set id.
5. A second fix before the first proposals are decided supersedes them and
   recomputes from the text the dependents still reflect
   (`change_sets.trigger_before_text`).

Cycles are rejected on every `dependsOn` write (`update-claim`,
`extract-claims`) with errorCode `cycle` and the path ("#1 → #2 → #1").

## Publish gate (`shared/gate.ts`)

`evaluateGate` is a pure function used by `request-publish`, `publish`, and
the gate panel. Blockers: effective status unsupported, laundered, or
quarantined; needs_review; any pending proposal; a cited
`injection_suspected` source; a `stale` source whose citing claims weren't
re-verified since. Warnings: weak, confidence < 0.6. Humans may override
unsupported, laundered, needs_review, and stale blockers with a reason; never
pending proposals, quarantined claims, or injection-flagged sources.

- `request-publish`: any caller; non-forced verify, then the gate. An agent
  call is logged "Agent requested publish → blocked: human approval
  required".
- `publish`: human only (hidden from agent and MCP, checked in `run`); other
  callers are refused with `forbidden` and logged "Agent attempted to publish
  · blocked". Overrides go to `publish_overrides`; the body is snapshotted in
  `document_revisions`.
- Published documents refuse every write (errorCode `published`) until a
  human reopens, which starts revision n+1.
- `activity` records edits, verifications, propagations, publish requests and
  attempts, overrides, reopen.

## Demo outputs and timings

- `pnpm demo:propagation`: 11/11 PASS. 2 needs_review, 2 re-verified, 2
  proposals in one change set (25% → 56%, 2.5 → 3.1 times), unrelated claim
  untouched, cycle rejected, second fix recomputed from the original base
  (88%, 3.8 times). Propagation 0.6–1.2 s inside the action (2 forced
  re-verifies), about 2 s end to end through the CLI. In the UI, the ripple
  starts as soon as the save returns and runs about 600 ms.
- `pnpm demo:gate`: 9/9 PASS (see the script for the steps).
- Production (2026-11-04, over MCP as the agent): `propagate-change` flagged
  both dependents in 1.8 s; `request-publish` returned the blockers and logged
  the agent's request as blocked; `publish` is not an MCP tool. A rewrite on
  production needs a human edit of the upstream claim (the agent's wording
  changes become proposals), which the local demo exercises.

## What Phase 5 needs

- **Receipt data**: per published revision, from `document_revisions` (body,
  publishedAt), `publish_overrides` (blocker kind, claim/source, reason), and
  per claim the verdict, reason, confidence, evidence offsets and snippets,
  `verifiedAt/By`, the human status and note, and each cited source's
  `contentHash`/`fetchedAt`/flags at that time.
- **Activity feed**: `activity` rows (kind, actor, summary, data, createdAt)
  are the receipt's timeline as-is; publish events carry the gate result.
- **Staleness at receipt time**: run `check-staleness` per cited source and
  compare hashes with those recorded at publish.

# Phase 5 — Claim Receipt and MCP

## Receipt (`shared/receipt.ts`, `server/lib/receipt.ts`)

Created inside `publish` after the publish event is logged, stored once per
(document, revision) in `receipts` (unique; no action updates or deletes it).
Source text the evidence points into is frozen in `source_snapshots`
(keyed by content hash), so evidence stays checkable after the live page
changes. Contents: document (id, title, revision, publishedAt,
publishedBy "human", body, bodyHash), claims (text, span, effective status,
verdict + reason + confidence, human status + note, evidence with source URL,
snippet, offsets, sourceContentHash, verifiedAt/By, overrides + reasons),
every document source (quarantined ones `excluded: true` and never used as
evidence), summary (counts by status, overrides, blocked agent publish
attempts), condensed history, and receiptHash.

### Canonicalisation (`shared/canonical.ts`)

`receiptHash = sha256(canonicalize(receipt without receiptHash))`, lowercase hex.

1. Objects: keys sorted by UTF-16 code unit order (JS default sort), at every depth.
2. Arrays: order preserved; `undefined` elements become `null`.
3. Members whose value is `undefined` are dropped.
4. Primitives are serialised exactly as `JSON.stringify` does (strings escaped
   per JSON, numbers in shortest round-trip form); NaN/Infinity are rejected.
5. No whitespace between tokens.
6. Hash input is the UTF-8 encoding of that string.

`bodyHash = sha256(body)` over the body exactly as stored. The same code runs
in the browser and on the server (Web Crypto).

### Checks

`verify-receipt` returns `intact | tampered` per check: receipt hash (self
consistent and equal to the hash stored at publish), body hash, and each
evidence snippet at its offsets in the frozen source. A body edit fails body +
receipt; a snippet edit fails that evidence + receipt; a swapped hash fails
the receipt check ("not the one recorded"). `recheck-receipt-live` re-fetches
sources, re-runs the pure verification in memory against changed text, and
reports unchanged / changed_still_supported / changed_no_longer_supported /
source_unreachable; signed-in checks are stored in `live_checks`. It never
writes to the receipt, the claims, or the sources.

Public access: `/r/:id`, the three receipt actions, and
`/fixtures/live-source` are in the auth plugin's `publicPaths`; the actions
are `requiresAuth: false`, `readOnly`, `publicAgent: { expose, readOnly }`
(the framework's rule for anonymous calls). They answer only for published
documents.

`pnpm demo:receipt [baseUrl]`: 11/11 PASS (stable hash; genuine all intact;
body, snippet, and hash tampering each flagged precisely; override on the
receipt; quarantined source excluded; live re-check unchanged →
changed_still_supported → changed_no_longer_supported via the three versions
of `/fixtures/live-source`; receipt unchanged afterwards).

## MCP permission model

- The framework's auto-mounted `/mcp` (no custom server). Auth is the
  framework's per-user connect token or OAuth grant (`/mcp/connect`), separate
  from the user's sign-in, revocable under "Existing connections", and bound
  to that user's account.
- Scope: only actions with `mcpTool: true`; cross-app tools
  (`builtinCrossAppTools: false`) and org administration
  (`frameworkTools.orgAdministration: false`) are off, and Phase 0 spikes are
  hidden.
- Every MCP call has `ctx.caller = "mcp"`, which `actorOf` maps to "agent":
  the same rules as the in-app agent.
- `publish` and `decide-edit` are **listed for MCP but refuse** with
  `forbidden` (chosen over hiding them so external attempts reach the check
  and are recorded: "Agent attempted to publish · blocked"). They stay hidden
  from the in-app agent.
- `check-draft` creates a document from external text, ingests sources
  (injection scan included), extracts claims (caller-supplied quotes or the
  rule-based fallback), verifies, and returns counts, blockers, and an
  absolute editor URL (APP_URL or Vercel's production URL).

## Rough edges for the polish phase

- The app header above the editor is an empty band (framework header with no
  title); the editor's own top bar sits below it.
- "Verified by you" appears when a human clicks Verify, which reads oddly next
  to agent verdicts; consider "Verified (requested by you)".
- Repeated fixes before accepting proposals leave earlier change sets in the
  activity feed with "0 rewrites proposed".
- The Settings › MCP server page still says "App" in places (framework copy).
- A first agent turn after deploy can take a few seconds (cold start).
- Rule-based claim extraction in `check-draft` is coarse; external agents
  should pass `claims`.

## Landing page audit (2026-11-05)

Ran the ui-skills.com Improve UI audit on the landing page; findings and
fixes are in `docs/ui-audit.md`. One brand gold (`#EDB158`) now, a single
GitHub link in the nav, and one nav CTA ("Open Goowa") for the app.

## MCP real-client test (2026-11-05)

Cursor connected with a personal token and checked a two-sentence draft
(`docs/screenshots/15-mcp-cursor.webp`). The first `check-draft` call failed:
drafts under 200 characters were padded too little for `draft-document`.
Fixed (short drafts are now padded with a claim-free note). Rough edge: the
made-up "$40 trillion" figure came back weak, not unsupported, because number
matching counted BIS footnote markers (39, 40, 41).
Re-run after the fix: one `check-draft` call from Cursor succeeded
(1 supported, 1 weak, editor link returned).
