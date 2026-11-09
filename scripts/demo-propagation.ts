// pnpm demo:propagation — seed the propagation fixture, fix the upstream
// figure as a human, and print the resulting change set with checks.
import {
  BODY,
  CLAIMS,
  EXPECTED,
  TITLE,
  TOPIC,
  UNRELATED,
  UPSTREAM_FIXED,
} from "../fixtures/propagation.js";
import { action, actionError } from "./lib/cli.js";

type Claim = {
  id: string;
  text: string;
  reviewState: string;
  reviewReason: string | null;
  verdict: string | null;
  verifiedFingerprint: string | null;
};
type Edit = {
  id: string;
  targetId: string;
  before: string;
  after: string;
  reason: string;
  proposedBy: string;
  changeSetId: string | null;
};
type State = {
  claims: Claim[];
  pendingEdits: Edit[];
  changeSets: { id: string; summary: string }[];
};

const doc = action<{ id: string }>("create-document", {
  title: TITLE,
  topic: TOPIC,
});
const [source] = action<{ sources: { id: string }[] }>("ingest-sources", {
  documentId: doc.id,
  urls: ["https://www.bis.org/publ/arpdf/ar2025e3.htm"],
}).sources;
action("draft-document", { documentId: doc.id, body: BODY });
action("extract-claims", {
  documentId: doc.id,
  claims: CLAIMS.map((c) => ({
    quote: c.quote,
    sourceIds: [source!.id],
    dependsOn: c.dependsOn,
  })),
});
const before = action<State>("get-document-state", { documentId: doc.id });
const id = (text: string) => before.claims.find((c) => c.text === text)!.id;
const [upId, growthId, ratioId, unrelatedId] = CLAIMS.map((c) => id(c.quote));

console.log(`Document ${doc.id}  (/docs/${doc.id})`);
console.log(
  `\nHuman fix on claim #1: "${CLAIMS[0]!.quote}"\n                   →  "${UPSTREAM_FIXED}"\n`,
);
const started = Date.now();
const result = action<{
  propagation: {
    changeSetId: string;
    summary: string;
    affected: {
      claimId: string;
      label: string;
      verdict: string | null;
      depth: number;
    }[];
    proposals: { claimId: string; after: string; reason: string }[];
    durationMs: number;
  };
}>("update-claim", { claimId: upId, text: UPSTREAM_FIXED });
const wall = Date.now() - started;
const p = result.propagation;
console.log(`Change set ${p.changeSetId}`);
console.log(`  ${p.summary}`);
for (const a of p.affected)
  console.log(
    `  needs_review ${a.label} (depth ${a.depth}) → re-verified: ${a.verdict}`,
  );
for (const x of p.proposals) {
  console.log(
    `  proposal for ${before.claims.findIndex((c) => c.id === x.claimId) + 1 ? `#${before.claims.findIndex((c) => c.id === x.claimId) + 1}` : x.claimId}:`,
  );
  console.log(`    → ${x.after}`);
  console.log(`    reason: ${x.reason}`);
}

// Re-verification runs after the response; wait for it to land.
let after = action<State>("get-document-state", { documentId: doc.id });
const pendingIds = p.affected.map((a) => a.claimId);
let reverified = false;
for (let i = 0; i < 20 && !reverified; i++) {
  after = action<State>("get-document-state", { documentId: doc.id });
  reverified = pendingIds.every(
    (cid) => after.claims.find((c) => c.id === cid)?.verifiedFingerprint,
  );
  if (!reverified) await new Promise((r) => setTimeout(r, 500));
}
const set = after.pendingEdits.filter((e) => e.changeSetId === p.changeSetId);
const claim = (cid: string) => after.claims.find((c) => c.id === cid)!;
const checks: [string, boolean][] = [
  [
    "exactly 2 claims marked needs_review",
    after.claims
      .filter((c) => c.reviewState === "needs_review")
      .map((c) => c.id)
      .sort()
      .join() === [growthId, ratioId].sort().join(),
  ],
  [
    "both dependents re-verified (in the background)",
    p.affected.length === 2 && reverified,
  ],
  [
    "exactly 2 proposals, all in one change set",
    set.length === 2 && after.pendingEdits.length === 2,
  ],
  [
    "growth recomputed in code: 25% → 56%",
    set.some((e) => e.targetId === growthId && e.after === EXPECTED.growth),
  ],
  [
    "ratio recomputed in code: 2.5 → 3.1 times",
    set.some((e) => e.targetId === ratioId && e.after === EXPECTED.ratio),
  ],
  [
    "proposals are the agent's, for a human to decide",
    set.every((e) => e.proposedBy === "agent"),
  ],
  [
    "unrelated claim untouched",
    claim(unrelatedId!).text === UNRELATED &&
      claim(unrelatedId!).reviewState === "ok" &&
      !after.pendingEdits.some((e) => e.targetId === unrelatedId),
  ],
  ["upstream claim not flagged", claim(upId!).reviewState === "ok"],
];

// A dependency that would loop (upstream depending on its own dependent).
const cycleError = actionError("update-claim", {
  claimId: upId,
  dependsOn: [growthId],
});
console.log(`\nCyclic dependsOn edit (#1 depends on #2): ${cycleError}`);
checks.push([
  "cyclic dependsOn edit rejected with a typed error",
  /would create a cycle: #1 → #2 → #1/.test(cycleError),
]);
// A second fix before anyone decides the first proposals: they are
// superseded and recomputed from the text the dependents still reflect.
const second = action<{ propagation: { proposals: { after: string }[] } }>(
  "update-claim",
  {
    claimId: upId,
    text: UPSTREAM_FIXED.replace("$200 billion", "$240 billion"),
  },
);
const pending = action<State>("get-document-state", {
  documentId: doc.id,
}).pendingEdits;
console.log("\nSecond fix ($200B → $240B) before deciding:");
for (const x of second.propagation.proposals) console.log(`  → ${x.after}`);
checks.push([
  "second fix supersedes the first proposals (still exactly 2 pending)",
  pending.length === 2,
]);
checks.push([
  "second fix recomputes from the original base: 25% → 88%, 2.5 → 3.8 times",
  pending.some((e) => e.after === EXPECTED.growth.replace("a 56%", "an 88%")) &&
    pending.some(
      (e) => e.after === EXPECTED.ratio.replace("3.1 times", "3.8 times"),
    ),
]);

console.log("");
for (const [label, ok] of checks)
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
console.log(
  `\nPropagation ${p.durationMs} ms inside the action; ${wall} ms end to end through the CLI.`,
);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? "ALL PASS" : `${failed} FAILURE(S)`);
process.exitCode = failed === 0 ? 0 : 1;
