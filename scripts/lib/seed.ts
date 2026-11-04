import {
  BODY,
  CLAIMS,
  SOURCES,
  TITLE,
  TOPIC,
  type SourceKey,
} from "../../fixtures/verify-fixture.js";
import { action } from "./cli.js";

/** Seed the Phase 3 verification fixture into a fresh document. */
export function seedVerifyFixture() {
  const doc = action<{ id: string }>("create-document", {
    title: TITLE,
    topic: TOPIC,
  });
  const keys = Object.keys(SOURCES) as SourceKey[];
  const ingested = action<{ sources: { id: string; flags: string[] }[] }>(
    "ingest-sources",
    {
      documentId: doc.id,
      urls: keys.map((k) => SOURCES[k]),
    },
  );
  const sourceId = Object.fromEntries(
    keys.map((k, i) => [k, ingested.sources[i]!.id]),
  ) as Record<SourceKey, string>;
  action("draft-document", { documentId: doc.id, body: BODY });
  action("extract-claims", {
    documentId: doc.id,
    claims: CLAIMS.map((c) => ({
      quote: c.quote,
      sourceIds: c.sources.map((s) => sourceId[s]),
      dependsOn: c.dependsOn.map((d) => CLAIMS.findIndex((x) => x.key === d)),
    })),
  });
  return { documentId: doc.id, sourceId, ingested: ingested.sources };
}
