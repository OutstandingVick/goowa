import { defineAction } from "@agent-native/core/action";
import { putSetting } from "@agent-native/core/settings";
import { z } from "zod";

import { LIVE_SETTING, LIVE_VERSIONS } from "../fixtures/live-source.js";
import { goowaErrors, requireHuman } from "../server/lib/actor.js";

// HUMAN ONLY, demo tooling: switch the hosted live-source fixture page.
export default defineAction({
  description:
    'Switch the hosted live-source test page (/fixtures/live-source) between versions "a" (original), "b" (unrelated sentence changed), and "c" (supply figure changed). Human only; for demonstrating live receipt re-checks.',
  errors: goowaErrors,
  agentTool: false,
  mcpTool: false,
  schema: z.object({
    version: z.enum(LIVE_VERSIONS).describe('"a", "b", or "c"'),
  }),
  run: async ({ version }, ctx) => {
    requireHuman(ctx, "change the live fixture page");
    await putSetting(LIVE_SETTING, { version });
    return { version };
  },
});
