// pnpm verify:fixture — seed the verification fixture into a fresh document,
// run verify-document, and compare each claim's verdict with
// fixtures/expected.json. Also checks every evidence snippet exists in the
// stored source text and that the injected source was quarantined.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BODY,
  CLAIMS,
  SOURCES,
  TITLE,
  TOPIC,
  type SourceKey,
} from "../fixtures/verify-fixture.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = JSON.parse(
  readFileSync(path.join(root, "fixtures/expected.json"), "utf8"),
) as Record<string, { expect: string[] }>;
const orgId = process.env.AGENT_ORG_ID ?? "";
if (!orgId) {
  console.error(
    "Set AGENT_ORG_ID to the workspace id that has a model provider.",
  );
  process.exit(1);
}
const env = {
  ...process.env,
  AGENT_USER_EMAIL: process.env.AGENT_USER_EMAIL ?? "dev@local.test",
  AGENT_ORG_ID: orgId,
  NODE_OPTIONS: `--require ${path.join(root, "scripts/json-stdout.cjs")}`,
};

function action<T>(name: string, args: object): T {
  const out = execFileSync(
    "npx",
    ["agent-native", "action", name, JSON.stringify(args)],
    { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const lines = out.trim().split("\n");
  return JSON.parse(lines[lines.length - 1] ?? "null") as T;
}

type Source = { id: string; url: string; flags: string[] };
type Claim = {
  id: string;
  text: string;
  verdict: string | null;
  verdictReason: string | null;
  evidence: {
    sourceId: string;
    snippet: string;
    startOffset: number;
    endOffset: number;
  }[];
};

const doc = action<{ id: string }>("create-document", {
  title: TITLE,
  topic: TOPIC,
});
const keys = Object.keys(SOURCES) as SourceKey[];
const ingested = action<{ sources: Source[] }>("ingest-sources", {
  documentId: doc.id,
  urls: keys.map((k) => SOURCES[k]),
});
const sourceId = Object.fromEntries(
  keys.map((k, i) => [k, ingested.sources[i]!.id]),
) as Record<SourceKey, string>;
action("draft-document", { documentId: doc.id, body: BODY });
action("extract-claims", {
  documentId: doc.id,
  claims: CLAIMS.map((c) => ({
    quote: c.quote,
    sourceIds: c.sources.map((s) => sourceId[s]),
    dependsOn: c.dependsOn.map((d) => CLAIMS.findIndex((x) => x.key === d)),
  })),
});

const run = action<{
  total: number;
  verified: number;
  skipped: number;
  failed: number;
  averageMsPerClaim: number;
  wallMs: number;
}>("verify-document", { documentId: doc.id, force: true });
const state = action<{ claims: Claim[]; sources: Source[] }>(
  "get-document-state",
  { documentId: doc.id },
);

let failures = 0;
console.log(`\nDocument ${doc.id}  (/docs/${doc.id})`);
const injected = state.sources.find((s) => s.id === sourceId.injected)!;
const quarantined = injected.flags.includes("quarantined");
console.log(
  `${quarantined ? "PASS" : "FAIL"} injected source quarantined on ingest (flags: ${injected.flags.join(", ")})`,
);
if (!quarantined) failures++;

const texts = new Map<string, string>();
for (const c of CLAIMS) {
  const claim = state.claims.find((x) => x.text === c.quote);
  const verdict = claim?.verdict ?? "none";
  const ok = expected[c.key]!.expect.includes(verdict);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${c.key.padEnd(20)} ${verdict.padEnd(13)} expected ${expected[c.key]!.expect.join("|")}  — ${claim?.verdictReason ?? ""}`,
  );
  for (const ev of claim?.evidence ?? []) {
    if (!texts.has(ev.sourceId)) {
      texts.set(
        ev.sourceId,
        action<{ text: string }>("get-source-text", { sourceId: ev.sourceId })
          .text,
      );
    }
    const inSource =
      texts.get(ev.sourceId)!.slice(ev.startOffset, ev.endOffset) ===
      ev.snippet;
    if (!inSource) failures++;
    console.log(
      `     ${inSource ? "ok " : "BAD"} evidence snippet at ${ev.startOffset}-${ev.endOffset} exists in stored source text`,
    );
  }
}

// Idempotency: a second run without force skips every unchanged claim.
const again = action<{ verified: number; skipped: number }>("verify-document", {
  documentId: doc.id,
});
const idem = again.verified === 0 && again.skipped === CLAIMS.length;
if (!idem) failures++;
console.log(
  `${idem ? "PASS" : "FAIL"} idempotent re-run: verified ${again.verified}, skipped ${again.skipped}`,
);

console.log(
  `\nverified ${run.verified}/${run.total}, failed ${run.failed}; average ${run.averageMsPerClaim} ms per claim; wall ${run.wallMs} ms`,
);
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
process.exitCode = failures === 0 ? 0 : 1;
