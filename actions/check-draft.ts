import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { actorOf, goowaErrors } from "../server/lib/actor.js";
import { getDocumentState } from "../server/lib/documents.js";
import { gateFor } from "../server/lib/gate.js";
import { runVerifyDocument } from "../server/lib/verify-document.js";
import { ruleClaims } from "../shared/extract-rules.js";
import { effectiveStatus } from "../shared/status.js";
import createDocument from "./create-document.js";
import draftDocument from "./draft-document.js";
import extractClaims from "./extract-claims.js";
import ingestSources from "./ingest-sources.js";

/** Deploy-level public origin: APP_URL, else Vercel's production URL. */
function absoluteUrl(path: string) {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = process.env.APP_URL ?? (vercel ? `https://${vercel}` : "");
  return origin ? `${origin.replace(/\/+$/, "")}${path}` : path;
}

// For external agents (MCP): check a draft written elsewhere. It runs the same
// actions the editor uses, as the calling agent, and hands back a link for a
// human. It never accepts, sets statuses, or publishes.
export default defineAction({
  description:
    "Check a draft written outside Goowa: creates a document from the text, ingests the source URLs (prompt-injected pages are quarantined), extracts the factual claims, verifies each against its sources, and returns counts by verdict, the publish blockers, and an editor URL where a human reviews and decides. Pass claims (exact quotes from the text) to control extraction; otherwise every sentence with a figure, date, or name is checked.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    text: z
      .string()
      .min(40)
      .max(20_000)
      .describe("The draft text (plain text or markdown)"),
    sourceUrls: z
      .array(z.string())
      .min(1)
      .max(10)
      .describe("URLs the draft relies on, 1 to 10"),
    title: z
      .string()
      .optional()
      .describe("Document title; defaults to the first line"),
    claims: z
      .array(z.string())
      .max(60)
      .optional()
      .describe("Optional: factual claims as exact quotes from the text"),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "document",
      to: `/docs/${encodeURIComponent(result.documentId)}`,
    }),
    label: "Review in Goowa",
  }),
  run: async ({ text, sourceUrls, title, claims }, ctx) => {
    const owner =
      ctx?.userEmail ??
      goowaErrors.noWrite(
        "Connect Goowa with your account to check drafts.",
        "forbidden",
        { statusCode: 401 },
      );
    const firstLine = text
      .trim()
      .split("\n")[0]!
      .replace(/^#+\s*/, "")
      .slice(0, 80);
    const doc = await createDocument.run(
      {
        title: title ?? firstLine,
        topic: "Draft checked from an external agent.",
      },
      ctx,
    );
    const ingested = await ingestSources.run(
      { documentId: doc.id, urls: sourceUrls },
      ctx,
    );
    const usable = ingested.sources
      .filter((s) => !s.flags.includes("fetch_failed"))
      .map((s) => s.id);
    if (usable.length === 0) {
      return goowaErrors.fail(
        "None of the source URLs could be fetched.",
        "conflict",
      );
    }
    // draft-document needs 200+ characters; pad short drafts with a note
    // that holds no figures or names, so it never becomes a claim.
    const NOTE =
      "This text was submitted by an external agent for claim checking. Each factual sentence above is verified against the listed sources.";
    const body =
      text.length >= 200 ? text : `${text}\n\n${NOTE}`.padEnd(200, " ");
    await draftDocument.run({ documentId: doc.id, body }, ctx);

    const quotes = (claims?.length ? claims : ruleClaims(body)).filter((q) =>
      body.includes(q),
    );
    if (quotes.length > 0) {
      await extractClaims.run(
        {
          documentId: doc.id,
          // Each claim cites every usable source; verification finds which
          // one (if any) supports it.
          claims: quotes.map((quote) => ({
            quote,
            sourceIds: usable,
            dependsOn: [],
          })),
        },
        ctx,
      );
    }
    const verification = await runVerifyDocument({
      documentId: doc.id,
      actor: actorOf(ctx),
      owner,
      force: false,
    });
    const gate = await gateFor(doc.id);
    const state = await getDocumentState(doc.id);
    const counts: Record<string, number> = {};
    for (const c of state.claims) {
      const s = effectiveStatus(c, state.sources);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return {
      documentId: doc.id,
      editorUrl: absoluteUrl(`/docs/${doc.id}`),
      claims: state.claims.length,
      counts,
      quarantinedSources: ingested.sources
        .filter((s) => s.flags.includes("quarantined"))
        .map((s) => s.url),
      failedSources: ingested.sources
        .filter((s) => s.flags.includes("fetch_failed"))
        .map((s) => s.url),
      blockers: gate.blockers.map((b) => b.message),
      warnings: gate.warnings.map((w) => w.message),
      verified: verification.verified,
      note: "A human reviews claims, accepts edits, and publishes in the editor. Agents cannot publish.",
    };
  },
});
