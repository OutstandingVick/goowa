import { defineActionErrors } from "@agent-native/core/action";

export type Actor = "human" | "agent";

// Fail closed: only the browser UI and the local CLI (a developer at a
// terminal) count as human. The in-app agent ("tool"), MCP, A2A,
// automations, bare HTTP, and an unknown caller are all treated as the agent.
const HUMAN_CALLERS = new Set(["frontend", "cli"]);

export function actorOf(ctx: { caller?: string } | undefined): Actor {
  return ctx?.caller && HUMAN_CALLERS.has(ctx.caller) ? "human" : "agent";
}

export const goowaErrors = defineActionErrors(
  "forbidden",
  "not_found",
  "conflict",
  "invalid_span",
  "cycle",
  "published",
);

/** Published documents are frozen until a human reopens them. */
export function requireEditable(doc: { status: string }) {
  if (doc.status === "published") {
    goowaErrors.noWrite(
      "This document is published and read-only. A human must reopen it to make changes.",
      "published",
      { statusCode: 409 },
    );
  }
}

export function requireHuman(
  ctx: { caller?: string } | undefined,
  what: string,
): void {
  if (actorOf(ctx) !== "human") {
    goowaErrors.noWrite(`Only a human can ${what}.`, "forbidden", {
      statusCode: 403,
    });
  }
}
