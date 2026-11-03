import { defineAction } from "@agent-native/core/action";
import { accessFilter } from "@agent-native/core/sharing";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "List the Goowa documents the current user can see, newest first.",
  mcpTool: true,
  readOnly: true,
  http: { method: "GET" },
  schema: z.object({}),
  run: async () => {
    const { documents, documentShares } = schema;
    const rows = await getDb()
      .select({
        id: documents.id,
        title: documents.title,
        status: documents.status,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(accessFilter(documents, documentShares))
      .orderBy(desc(documents.updatedAt))
      .limit(100);
    return { documents: rows };
  },
});
