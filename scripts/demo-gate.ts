// pnpm demo:gate — the publish gate on the Phase 3 fixture: blockers before,
// refused overrides, resolving them as a human, publishing, and the
// published document refusing edits.
import { CLAIMS } from "../fixtures/verify-fixture.js";
import { action, actionError } from "./lib/cli.js";
import { seedVerifyFixture } from "./lib/seed.js";

type Blocker = {
  kind: string;
  claimId?: string;
  sourceId?: string;
  message: string;
  overridable: boolean;
};
type Gate = {
  canPublish: boolean;
  blockers: Blocker[];
  warnings: { kind: string; message: string }[];
};
type State = {
  claims: { id: string; text: string }[];
  activity: { kind: string; actor: string; summary: string }[];
};

const checks: [string, boolean][] = [];
const print = (title: string, g: Gate) => {
  console.log(`\n${title}: canPublish = ${g.canPublish}`);
  for (const b of g.blockers)
    console.log(
      `  BLOCKER ${b.kind}${b.overridable ? "" : " (cannot override)"}: ${b.message}`,
    );
  for (const w of g.warnings) console.log(`  warning ${w.kind}: ${w.message}`);
};

const { documentId } = seedVerifyFixture();
console.log(`Document ${documentId}  (/docs/${documentId})`);
const state = action<State>("get-document-state", { documentId });
const claimId = (key: string) =>
  state.claims.find((c) => c.text === CLAIMS.find((x) => x.key === key)!.quote)!
    .id;
const laundered = claimId("volume-laundered");
const quarantined = claimId("supply-quarantined");

// 1. Before: request-publish verifies, then evaluates the gate.
const before = action<Gate>("request-publish", { documentId });
print("Gate before", before);
checks.push(["blocked before resolving", !before.canPublish]);
checks.push([
  "laundered claim blocks",
  before.blockers.some((b) => b.kind === "claim_laundered"),
]);
checks.push([
  "quarantined claim and injected source block, not overridable",
  before.blockers
    .filter(
      (b) => b.kind === "claim_quarantined" || b.kind === "injection_source",
    )
    .every((b) => !b.overridable) &&
    before.blockers.some((b) => b.kind === "injection_source"),
]);
checks.push([
  "weak claim is only a warning",
  before.warnings.some((w) => w.kind === "weak"),
]);

// 2. Overrides that must be refused.
const noReason = actionError("publish", {
  documentId,
  overrides: [{ claimId: laundered, reason: " " }],
});
console.log(`\nOverride without a reason → ${noReason}`);
checks.push([
  "override without a reason refused",
  /needs a reason/.test(noReason),
]);
const quarantineOverride = actionError("publish", {
  documentId,
  overrides: [
    { claimId: laundered, reason: "Checked by hand." },
    { claimId: quarantined, reason: "I trust it." },
  ],
});
console.log(`Override on the quarantined claim → ${quarantineOverride}`);
checks.push([
  "quarantined claim cannot be overridden",
  /Cannot override/.test(quarantineOverride),
]);

// 3. Resolve as a human: drop the quarantined citation; the claim is then
//    unsupported (no source), which a human may override with a reason.
action("update-claim", { claimId: quarantined, sourceIds: [] });
const middle = action<Gate>("request-publish", { documentId });
print("Gate after removing the quarantined citation", middle);
checks.push([
  "only overridable blockers remain",
  middle.blockers.length > 0 && middle.blockers.every((b) => b.overridable),
]);

// 4. Publish with a reason for each remaining blocker.
const published = action<{
  status: string;
  revision: number;
  overrides: number;
}>("publish", {
  documentId,
  overrides: middle.blockers.map((b) => ({
    claimId: b.claimId,
    sourceId: b.sourceId,
    kind: b.kind,
    reason:
      b.claimId === laundered
        ? "Kept as an illustrative figure; flagged for the editor to source before the next revision."
        : "Removed the quarantined citation; the figure is shown as unsourced context.",
  })),
});
console.log(
  `\nPublished: status ${published.status}, revision ${published.revision}, ${published.overrides} override(s) recorded`,
);
checks.push([
  "published with reasoned overrides",
  published.status === "published" &&
    published.overrides === middle.blockers.length,
]);

// 5. Published documents refuse edits.
const edit = actionError("propose-edit", {
  targetType: "claim",
  targetId: laundered,
  after: "Stablecoins processed large volumes in 2024.",
  reason: "soften",
});
console.log(`Edit after publishing → ${edit}`);
checks.push([
  "published document refuses edits",
  /published and read-only/.test(edit),
]);

const feed = action<State>("get-document-state", { documentId }).activity;
console.log("\nActivity feed (newest first):");
for (const a of feed.slice(0, 8)) console.log(`  [${a.actor}] ${a.summary}`);

console.log("");
for (const [label, ok] of checks)
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? "ALL PASS" : `${failed} FAILURE(S)`);
process.exitCode = failed === 0 ? 0 : 1;
