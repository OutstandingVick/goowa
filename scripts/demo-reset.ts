// pnpm demo:reset [baseUrl] — restore the demo document to its pre-demo
// state (fresh draft, sources and claims, live-source page on version a).
// Talks to a running app as its signed-in UI; on a deployed app, open the
// hidden /demo route instead.
const base = (process.argv[2] ?? "http://localhost:8080").replace(/\/+$/, "");
const started = Date.now();
const res = await fetch(`${base}/_agent-native/actions/reset-demo`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-agent-native-frontend": "1",
  },
  body: JSON.stringify({ origin: base }),
});
const body = (await res.json()) as {
  documentId?: string;
  removed?: number;
  failedSources?: string[];
  error?: string;
};
if (!res.ok || !body.documentId) {
  console.error(
    `demo:reset failed (${res.status}): ${body.error ?? JSON.stringify(body)}`,
  );
  process.exit(1);
}
const ms = Date.now() - started;
console.log(`Demo reset in ${ms} ms (removed ${body.removed} old copy).`);
if (body.failedSources?.length)
  console.log(`Could not fetch: ${body.failedSources.join(", ")}`);
console.log(`Open ${base}/docs/${body.documentId}`);
process.exitCode = ms < 10_000 ? 0 : 1;
