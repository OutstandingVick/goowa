import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fetchSource } from "../server/lib/fetch-source.js";

export default defineAction({
  description:
    "Fetch a web page server-side and return its title, the first 2,000 characters of readable text, and a sha256 hash of that text. Returns { ok: false, error } instead of throwing on failure.",
  mcpTool: true,
  readOnly: true,
  schema: z.object({
    url: z.string().describe("Absolute http(s) URL of the source page"),
  }),
  http: { method: "GET" },
  run: async ({ url }) => fetchSource(url),
});
