// Run app actions from scripts through the agent-native CLI, as a human at a
// terminal (ctx.caller "cli"), and parse their JSON results.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export function requireOrg(): string {
  const orgId = process.env.AGENT_ORG_ID ?? "";
  if (!orgId) {
    console.error(
      "Set AGENT_ORG_ID to the workspace id that has a model provider.",
    );
    process.exit(1);
  }
  return orgId;
}

const env = () => ({
  ...process.env,
  AGENT_USER_EMAIL: process.env.AGENT_USER_EMAIL ?? "dev@local.test",
  AGENT_ORG_ID: requireOrg(),
  NODE_OPTIONS: `--require ${path.join(root, "scripts/json-stdout.cjs")}`,
});

/** Run an action; throws with the action's error message on failure. */
export function action<T>(name: string, args: object): T {
  try {
    const out = execFileSync(
      "npx",
      ["agent-native", "action", name, JSON.stringify(args)],
      {
        cwd: root,
        env: env(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const lines = out.trim().split("\n");
    return JSON.parse(lines[lines.length - 1] ?? "null") as T;
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? "");
    const message = stderr.match(/failed: (.*)/)?.[1] ?? (err as Error).message;
    throw new Error(message);
  }
}

/** Run an action expected to fail; returns its error message. */
export function actionError(name: string, args: object): string {
  try {
    action(name, args);
    return "no error";
  } catch (err) {
    return (err as Error).message;
  }
}
