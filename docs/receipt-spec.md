# Claim Receipt spec

A Claim Receipt is the tamper-evident record Goowa creates when a human publishes. Try one at `/r/<documentId>`.


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

## Canonicalisation (`shared/canonical.ts`)

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

## Checks

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

