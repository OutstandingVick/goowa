import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { goowaErrors } from "../server/lib/actor.js";
import { now } from "../server/lib/documents.js";

export default defineAction({
  description:
    "Create an empty Goowa research document (status draft). Returns the new document.",
  errors: goowaErrors,
  schema: z.object({
    title: z.string().min(1).describe("Document title"),
    topic: z
      .string()
      .min(1)
      .describe("What the document should explain, in one sentence"),
  }),
  run: async ({ title, topic }, ctx) => {
    const ownerEmail =
      ctx?.userEmail ??
      goowaErrors.noWrite("Sign in to create documents.", "forbidden", {
        statusCode: 401,
      });
    const doc = {
      id: crypto.randomUUID(),
      title,
      topic,
      body: "",
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
      ownerEmail,
      orgId: ctx?.orgId ?? null,
    };
    await getDb().insert(schema.documents).values(doc);
    return doc;
  },
});
