# Goowa: submission

**Name:** Goowa

**One-liner:** AI drafts the research; Goowa checks every claim against its
source, and only a human can publish.

## Description (150 words)

AI writes fluent research with confident citations, and some of those
citations never said it. Goowa is a research editor where an agent drafts a
document and every factual sentence becomes a claim tied to the exact passage
that supports it. Claims are verified deterministically first (exact quotes,
paraphrases, numbers that disagree), with a model only choosing among real
sentences, so it cannot invent a quote. Laundered citations are flagged, pages
carrying prompt injections are quarantined, and fixing one figure ripples to
every claim derived from it, with recomputed proposals. The agent proposes;
only a human accepts edits or publishes, and agent attempts are blocked and
logged. Publishing produces a tamper-evident Claim Receipt: a public page that
verifies hashes in the browser, pinpoints a single edited character, and
re-checks sources live. External agents in Claude or Cursor can check drafts
over MCP under the same rules.

## How it uses Agent-Native

- Every operation is a `defineAction`; the same actions serve the UI, the
  in-app agent, external agents over MCP, and the CLI.
- Human-only rules (accept, publish, final status) are enforced in actions
  from `ctx.caller`; MCP callers are agents and are refused and logged.
- `decide()` is the only model call, constrained to choosing a verdict and a
  real candidate sentence.
- Live sync, progress runs, sharing and access control, `ssrfSafeFetch`,
  settings storage, the agent chat, MCP connect tokens, and public paths for
  receipts all come from the framework.

## Links

- Live app: https://goowa.vercel.app
- Demo: https://goowa.vercel.app/demo (sign in)
- Source: https://github.com/OutstandingVick/goowa
- Demo video: _add link_
- Receipt spec: [docs/receipt-spec.md](docs/receipt-spec.md)
