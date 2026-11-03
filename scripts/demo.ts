// End-to-end Phase 1 demo: create → ingest → draft → extract, then check the
// exit criteria. Run with `pnpm demo` (uses the local database and the agent
// engine configured in .env / Settings › Model).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { demo } from "../fixtures/demo.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userEmail = process.env.AGENT_USER_EMAIL ?? "dev@local.test";
// The workspace whose Builder.io connection / provider key the agent uses
// (Settings › Model). Find it in the audit log or Settings › Organization.
const orgId = process.env.AGENT_ORG_ID ?? "";
if (!orgId) {
  console.error(
    "Set AGENT_ORG_ID to the workspace id that has a model provider.",
  );
  process.exit(1);
}
const base = {
  ...process.env,
  AGENT_USER_EMAIL: userEmail,
  AGENT_ORG_ID: orgId,
};
const env = {
  ...base,
  NODE_OPTIONS: `--require ${path.join(root, "scripts/json-stdout.cjs")}`,
};

function action<T>(name: string, args: object): T {
  const out = execFileSync(
    "npx",
    ["agent-native", "action", name, JSON.stringify(args)],
    { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const lines = out.trim().split("\n");
  const line = lines[lines.length - 1] ?? "";
  return JSON.parse(line) as T;
}

function agent(prompt: string) {
  execFileSync(
    "npx",
    [
      "agent-native",
      "agent",
      prompt,
      "--user-email",
      userEmail,
      "--org-id",
      orgId,
    ],
    // tsx lets the agent CLI load actions that import .ts files by .js paths.
    {
      cwd: root,
      env: { ...base, NODE_OPTIONS: "--import tsx" },
      stdio: "inherit",
    },
  );
}

type State = {
  document: { id: string; body: string };
  sources: { id: string; title: string; flags: string[] }[];
  claims: {
    id: string;
    text: string;
    spanStart: number;
    spanEnd: number;
    dependsOn: string[];
    createdBy: string;
  }[];
};

const doc = action<{ id: string }>("create-document", {
  title: demo.title,
  topic: demo.topic,
});
console.log(`Created document ${doc.id}`);

const ingested = action<{ sources: { url: string; flags: string[] }[] }>(
  "ingest-sources",
  { documentId: doc.id, urls: demo.sources },
);
for (const s of ingested.sources) {
  console.log(`  ${s.flags.length ? "FAILED" : "ok    "} ${s.url}`);
}

agent(
  `Document ${doc.id} has its sources ingested. Read it with get-document-state, write the draft with draft-document using only those sources, then extract its claims with extract-claims (at least 5, with real dependsOn links). Report the claim count when done.`,
);

const state = action<State>("get-document-state", { documentId: doc.id });
const badSpans = state.claims.filter(
  (c) => state.document.body.slice(c.spanStart, c.spanEnd) !== c.text,
);
const withDeps = state.claims.filter((c) => c.dependsOn.length > 0);
const checks = [
  [`≥5 claims (${state.claims.length})`, state.claims.length >= 5],
  [`all spans match the body (${badSpans.length} bad)`, badSpans.length === 0],
  [`≥1 dependsOn link (${withDeps.length})`, withDeps.length >= 1],
  [
    "every claim has createdBy agent",
    state.claims.every((c) => c.createdBy === "agent"),
  ],
] as const;
console.log(`\nDocument ${doc.id}: /debug/${doc.id}`);
for (const [label, ok] of checks)
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
