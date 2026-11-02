import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

type CalledBy = "ui" | "agent" | "unknown";

// ctx.caller is "frontend" for useActionMutation/useActionQuery/callAction and
// "tool" for the in-app agent loop. Every other surface (http, cli, mcp, a2a,
// automation) is reported as "unknown" for now.
function toCalledBy(caller: string | undefined): CalledBy {
  if (caller === "frontend") return "ui";
  if (caller === "tool") return "agent";
  return "unknown";
}

export default defineAction({
  description:
    'Echo text back with a timestamp and who called it. Use when the user says "ping <text>".',
  mcpTool: true,
  schema: z.object({
    text: z.string().describe("Text to echo back"),
  }),
  run: async ({ text }, ctx) => {
    return {
      echo: text,
      at: new Date().toISOString(),
      calledBy: toCalledBy(ctx?.caller),
    };
  },
});
