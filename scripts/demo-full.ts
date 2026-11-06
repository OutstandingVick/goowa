// pnpm demo:full [baseUrl] [runs] — the whole demo, end to end, against a
// running app: reset → verify → select-to-correct → ripple → agent publish
// blocked → human publish → receipt verify + tamper. Human steps go through
// the app's action endpoint as its UI; agent steps go through MCP as an
// external agent. Prints per-step timings and checks every run produces the
// same verdicts.
import {
  GROWTH_FIXED,
  RATIO_FIXED,
  RESERVES,
  SUPPLY_FIXED,
  SUPPLY_WRONG,
  VOLUME,
  VOLUME_FIXED,
} from "../fixtures/demo-flow.js";

const base = (process.argv[2] ?? "http://localhost:8080").replace(/\/+$/, "");
const runs = Number(process.argv[3] ?? 3);
const owner = "dev@local.test";

const HEADERS = {
  "Content-Type": "application/json",
  "x-agent-native-frontend": "1",
};

async function human<T>(name: string, args: object): Promise<T> {
  const url = `${base}/_agent-native/actions/${name}`;
  let res = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(args),
  });
  if (res.status === 405) {
    // Read-only actions are GET; objects travel as JSON strings.
    const query = new URLSearchParams(
      Object.entries(args).map(([k, v]) => [
        k,
        typeof v === "string" ? v : JSON.stringify(v),
      ]),
    );
    res = await fetch(`${url}?${query}`, { headers: HEADERS });
  }
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${name}: ${body.error ?? res.status}`);
  return body;
}

let rpc = 0;
/** Call a tool over MCP as an external agent; returns text and error flag. */
async function agent(name: string, args: object) {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Agent-Native-Owner-Email": owner,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpc,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const raw = await res.text();
  const json = JSON.parse(
    raw.includes("data:") ? raw.slice(raw.indexOf("data:") + 5) : raw,
  ) as {
    result?: { content: { text: string }[]; isError?: boolean };
  };
  const text = json.result?.content?.[0]?.text ?? raw;
  return { isError: Boolean(json.result?.isError), text };
}

type Claim = { id: string; text: string; verdict: string | null };
type State = {
  sources: { id: string; url: string }[];
  claims: Claim[];
  pendingEdits: { id: string; targetId: string; after: string }[];
  activity?: { kind: string; actor: string; summary: string }[];
};

async function runOnce(n: number) {
  const times: [string, number][] = [];
  const checks: [string, boolean][] = [];
  const step = async <T>(label: string, fn: () => Promise<T>) => {
    const t = Date.now();
    const out = await fn();
    times.push([label, Date.now() - t]);
    return out;
  };
  const state = (id: string) =>
    human<State>("get-document-state", { documentId: id });

  const { documentId } = await step("reset", () =>
    human<{ documentId: string }>("reset-demo", { origin: base }),
  );
  await step("verify all", () =>
    human("verify-document", { documentId, force: false }),
  );
  const verified = await state(documentId);
  const byText = (s: State, text: string) =>
    s.claims.find((c) => c.text === text)!;

  // Select-to-correct: the human selects the laundered sentence, the agent
  // proposes a correction, the human accepts it.
  await step("select-to-correct", async () => {
    const volume = byText(verified, VOLUME);
    const proposed = await agent("propose-edit", {
      targetType: "claim",
      targetId: volume.id,
      after: VOLUME_FIXED,
      reason: "The cited page does not state this figure.",
    });
    if (proposed.isError) throw new Error(proposed.text);
    const s = await state(documentId);
    const edit = s.pendingEdits.find((e) => e.targetId === volume.id)!;
    await human("decide-edit", { editId: edit.id, decision: "accept" });
  });

  // Ripple: the human fixes the supply figure; two derived claims get
  // recomputed proposals, which the human accepts.
  const ripple = await step("ripple", async () => {
    const supply = byText(verified, SUPPLY_WRONG);
    const r = await human<{ propagation: { proposals: { after: string }[] } }>(
      "update-claim",
      { claimId: supply.id, text: SUPPLY_FIXED },
    );
    const s = await state(documentId);
    for (const e of s.pendingEdits)
      await human("decide-edit", { editId: e.id, decision: "accept" });
    return r.propagation.proposals.map((p) => p.after).sort();
  });
  checks.push([
    "ripple recomputed growth and ratio",
    ripple.join("|") === [GROWTH_FIXED, RATIO_FIXED].sort().join("|"),
  ]);
  // The reserves claim leans on a page with a prompt injection. The human
  // drops that source; the claim must then be backed (or overridden) honestly.
  await step("drop quarantined source", async () => {
    const s = await state(documentId);
    const reserves = byText(s, RESERVES);
    const esma = s.sources.find((x) => x.url.includes("esma.europa.eu"))!;
    await human("update-claim", { claimId: reserves.id, sourceIds: [esma.id] });
  });
  await step("re-verify", () =>
    human("verify-document", { documentId, force: false }),
  );

  const blocked = await step("agent publish (blocked)", () =>
    agent("publish", { documentId }),
  );
  checks.push([
    "agent publish refused",
    blocked.isError && /human|forbidden/i.test(blocked.text),
  ]);

  const receiptHash = await step("human publish", async () => {
    const gate = await human<{
      blockers: { kind: string; claimId?: string; sourceId?: string }[];
    }>("request-publish", { documentId });
    const published = await human<{ receiptHash: string }>("publish", {
      documentId,
      overrides: gate.blockers.map((b) => ({
        claimId: b.claimId,
        sourceId: b.sourceId,
        kind: b.kind,
        reason: "Reviewed for the demo; tracked for revision 2.",
      })),
    });
    return published.receiptHash;
  });

  const final = await state(documentId);
  const receipt = await step("receipt verify + tamper", async () => {
    const r = await human<Record<string, unknown> & { receiptHash: string }>(
      "get-receipt",
      { documentId },
    );
    const genuine = await human<{ ok: boolean }>("verify-receipt", {
      receiptJson: r,
    });
    const doc = r.document as { body: string };
    const tampered = await human<{ ok: boolean }>("verify-receipt", {
      receiptJson: {
        ...r,
        document: { ...doc, body: doc.body.replace("$160", "$180") },
      },
    });
    return { r, genuine: genuine.ok, tampered: tampered.ok };
  });
  checks.push([
    "receipt hash matches publish",
    receipt.r.receiptHash === receiptHash,
  ]);
  checks.push(["genuine receipt verifies", receipt.genuine]);
  checks.push(["tampered receipt fails", !receipt.tampered]);
  const activity = await human<{ items?: { summary: string }[] }>(
    "get-document-state",
    { documentId },
  ).catch(() => ({}));
  void activity;

  const verdicts = {
    afterVerify: verified.claims.map(
      (c) => `${c.text.slice(0, 40)}=${c.verdict}`,
    ),
    final: final.claims.map((c) => `${c.text.slice(0, 40)}=${c.verdict}`),
    receipt: (receipt.r.summary as { byStatus: unknown }).byStatus,
  };
  console.log(`\nRun ${n}: document ${documentId}`);
  for (const [label, ms] of times)
    console.log(`  ${label.padEnd(26)} ${String(ms).padStart(6)} ms`);
  for (const [label, ok] of checks)
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
  return { verdicts, ok: checks.every(([, ok]) => ok), times };
}

const results = [];
for (let i = 1; i <= runs; i++) results.push(await runOnce(i));
const signature = (r: (typeof results)[number]) => JSON.stringify(r.verdicts);
const identical = results.every((r) => signature(r) === signature(results[0]!));
console.log("\nVerdicts after verify:");
for (const v of results[0]!.verdicts.afterVerify) console.log(`  ${v}`);
console.log("Verdicts at publish:");
for (const v of results[0]!.verdicts.final) console.log(`  ${v}`);
console.log(`Receipt: ${JSON.stringify(results[0]!.verdicts.receipt)}`);
console.log(
  `\n${identical ? "PASS" : "FAIL"} verdicts identical across ${runs} runs`,
);
const allOk = identical && results.every((r) => r.ok);
console.log(allOk ? "ALL PASS" : "FAILURES");
process.exitCode = allOk ? 0 : 1;
