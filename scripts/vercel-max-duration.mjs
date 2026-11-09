// Post-build (Vercel): set maxDuration on every generated function. The
// framework's Nitro build has no option for it. Hobby with fluid compute
// allows up to 300 s.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const MAX_DURATION = 300;
const dir = ".vercel/output/functions";
if (!existsSync(dir)) {
  console.log("[max-duration] no Vercel output; skipped");
  process.exit(0);
}
for (const name of readdirSync(dir)) {
  const file = path.join(dir, name, ".vc-config.json");
  if (!existsSync(file)) continue;
  const config = JSON.parse(readFileSync(file, "utf8"));
  config.maxDuration = MAX_DURATION;
  writeFileSync(file, JSON.stringify(config, null, 2));
  console.log(`[max-duration] ${name}: ${MAX_DURATION}s`);
}
