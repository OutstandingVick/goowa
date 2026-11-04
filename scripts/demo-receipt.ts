// pnpm demo:receipt — publish a small document and exercise its receipt:
// stable hash, verification (genuine and three kinds of tampering), overrides
// and quarantined sources on the receipt, and live re-checks against a source
// that changes. Needs the dev server running (it hosts the live fixture).
import { LIVE_CLAIM } from "../fixtures/live-source.js";
import type { Receipt } from "../shared/receipt.js";
import { action } from "./lib/cli.js";

const base = process.env.GOOWA_URL ?? "http://localhost:8080";
const LIVE = `${base}/fixtures/live-source`;
const BIS = "https://www.bis.org/publ/arpdf/ar2025e3.htm";
const ESMA =
  "https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica";
const INJECTED = "https://goowa.vercel.app/fixtures/injected-source.html";
const DOLLAR =
  "Over 99% of stablecoins are US dollar-denominated, with a growing cross-border presence.";
const VOLUME =
  "Stablecoins processed $27.6 trillion in transfers in 2024, more than Visa and Mastercard combined.";

type Check = { id: string; result: string; detail: string };
type Verify = { ok: boolean; checks: Check[] };
const checks: [string, boolean][] = [];
const failedIds = (v: Verify) =>
  v.checks
    .filter((c) => c.result === "tampered")
    .map((c) => c.id.replace(/-[0-9a-f-]{36}-\d+$/, ""));

action("set-live-fixture-version", { version: "a" });
const doc = action<{ id: string }>("create-document", {
  title: "Stablecoin supply (receipt demo)",
  topic: "Shows a Claim Receipt end to end.",
});
const ingested = action<{
  sources: { id: string; url: string; flags: string[] }[];
}>("ingest-sources", {
  documentId: doc.id,
  urls: [LIVE, BIS, ESMA, INJECTED],
});
const [live, bis, esma] = ingested.sources;
action("draft-document", {
  documentId: doc.id,
  body: `## Supply\n\n${LIVE_CLAIM} ${DOLLAR}\n\n## Volume\n\n${VOLUME} This explainer is a Goowa receipt demo.`,
});
action("extract-claims", {
  documentId: doc.id,
  claims: [
    { quote: LIVE_CLAIM, sourceIds: [live!.id], dependsOn: [] },
    { quote: DOLLAR, sourceIds: [bis!.id], dependsOn: [] },
    { quote: VOLUME, sourceIds: [esma!.id], dependsOn: [] },
  ],
});
const gate = action<{ blockers: { kind: string; claimId?: string }[] }>(
  "request-publish",
  { documentId: doc.id },
);
const published = action<{
  revision: number;
  receiptHash: string;
  receiptUrl: string;
}>("publish", {
  documentId: doc.id,
  overrides: gate.blockers.map((b) => ({
    claimId: b.claimId,
    kind: b.kind,
    reason: "Illustrative industry estimate; sourcing tracked for revision 2.",
  })),
});
console.log(
  `Document ${doc.id} published as revision ${published.revision}: ${base}${published.receiptUrl}`,
);

// 1. Stable hash across calls.
const r1 = action<Receipt>("get-receipt", { documentId: doc.id });
const r2 = action<Receipt>("get-receipt", { documentId: doc.id });
console.log(`receiptHash ${r1.receiptHash}`);
checks.push([
  "receiptHash stable across get-receipt calls",
  r1.receiptHash === r2.receiptHash && r1.receiptHash === published.receiptHash,
]);

// 2. Genuine and tampered receipts.
const genuine = action<Verify>("verify-receipt", { receiptJson: r1 });
console.log(
  `\nverify-receipt (genuine): ${genuine.checks.map((c) => `${c.id.split("-")[0]}=${c.result}`).join(", ")}`,
);
checks.push(["genuine receipt: every check intact", genuine.ok]);

const bodyEdit: Receipt = JSON.parse(JSON.stringify(r1));
bodyEdit.document.body = bodyEdit.document.body.replace(
  "$160 billion",
  "$180 billion",
);
const snippetEdit: Receipt = JSON.parse(JSON.stringify(r1));
snippetEdit.claims[0]!.evidence[0]!.snippet =
  snippetEdit.claims[0]!.evidence[0]!.snippet.replace("$160", "$180");
const hashEdit: Receipt = {
  ...JSON.parse(JSON.stringify(r1)),
  receiptHash: "0".repeat(64),
};
for (const [label, tampered, expected] of [
  ["body edit", bodyEdit, ["receipt", "body"]],
  ["snippet edit", snippetEdit, ["receipt", "evidence"]],
  ["hash edit", hashEdit, ["receipt"]],
] as const) {
  const v = action<Verify>("verify-receipt", { receiptJson: tampered });
  const got = failedIds(v).map((id) => id.split("-")[0]!);
  console.log(`verify-receipt (${label}): tampered = ${got.join(", ")}`);
  checks.push([
    `${label} flagged precisely (${expected.join(" + ")})`,
    !v.ok && got.join() === expected.join(),
  ]);
}

// 3. Overrides and quarantined sources on the receipt.
const laundered = r1.claims.find((c) => c.text === VOLUME)!;
console.log(
  `\nOverride on claim #${laundered.index}: ${laundered.overrides.map((o) => `${o.kind}: ${o.reason}`).join("; ")}`,
);
checks.push([
  "override and its reason are on the receipt",
  laundered.overrides.length > 0 &&
    laundered.overrides.every((o) => o.reason.length > 0),
]);
const quarantined = r1.sources.find((s) => s.url === INJECTED)!;
console.log(
  `Quarantined source: ${quarantined.title} (excluded: ${quarantined.excluded}, flags: ${quarantined.flags.join(", ")})`,
);
checks.push([
  "quarantined source listed but excluded from evidence",
  quarantined.excluded &&
    !r1.claims.some((c) =>
      c.evidence.some((e) => e.sourceId === quarantined.id),
    ),
]);

// 4. Live re-check: unchanged, then an unrelated edit, then the figure changes.
type Live = { results: { index: number; status: string; detail: string }[] };
const statusOf = (l: Live, index: number) =>
  l.results.find((r) => r.index === index)!.status;
const a = action<Live>("recheck-receipt-live", { documentId: doc.id });
action("set-live-fixture-version", { version: "b" });
const b = action<Live>("recheck-receipt-live", { documentId: doc.id });
action("set-live-fixture-version", { version: "c" });
const c = action<Live>("recheck-receipt-live", { documentId: doc.id });
action("set-live-fixture-version", { version: "a" });
console.log(`\nLive re-check of claim #1 ("${LIVE_CLAIM}")`);
console.log(`  page a (as published):        ${statusOf(a, 1)}`);
console.log(`  page b (other sentence edited): ${statusOf(b, 1)}`);
console.log(
  `  page c (figure now $150B):      ${statusOf(c, 1)} — ${c.results.find((r) => r.index === 1)!.detail}`,
);
checks.push([
  "live re-check: unchanged source reported unchanged",
  statusOf(a, 1) === "unchanged",
]);
checks.push([
  "live re-check: edited source still supports the claim",
  statusOf(b, 1) === "changed_still_supported",
]);
checks.push([
  "live re-check: changed figure no longer supported",
  statusOf(c, 1) === "changed_no_longer_supported",
]);
const after = action<Receipt>("get-receipt", { documentId: doc.id });
checks.push([
  "live re-checks never modify the receipt",
  after.receiptHash === r1.receiptHash,
]);

console.log("");
for (const [label, ok] of checks)
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? "ALL PASS" : `${failed} FAILURE(S)`);
process.exitCode = failed === 0 ? 0 : 1;
