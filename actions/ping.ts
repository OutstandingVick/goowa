import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

export default defineAction({
  description:
    'Echo text back with a timestamp and who called it. Use when the user says "ping <text>".',
  mcpTool: true,
  schema: z.object({
    text: z.string().describe("Text to echo back"),
  }),
  run: async ({ text }) => {
    return { echo: text, at: new Date().toISOString() };
  },
});
