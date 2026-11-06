import { createHash } from "node:crypto";

import { getSetting, putSetting } from "@agent-native/core/settings";

import {
  fetchSource,
  type FetchedPage,
  type FetchSourceOk,
  type FetchSourceResult,
} from "./fetch-source.js";

/** How long an ingested page is reused before it is fetched again. */
const TTL_MS = 6 * 60 * 60 * 1000;

type Cached = {
  at: number;
  result: FetchSourceOk;
  page: FetchedPage;
};

/**
 * Ingest-time fetch with a short-lived cache keyed by URL, so re-seeding the
 * demo or re-adding a source does not refetch large pages. Staleness checks
 * and live receipt re-checks call fetchSource directly and always go live.
 */
export async function cachedFetchSource(
  url: string,
  page: FetchedPage,
): Promise<FetchSourceResult> {
  // The live-source fixture changes on purpose; always fetch it.
  if (url.includes("/fixtures/live-source")) return fetchSource(url, page);
  const key = `goowa-fetch:${createHash("sha256").update(url).digest("hex")}`;
  const hit = (await getSetting(key).catch(() => null)) as Cached | null;
  if (hit?.result?.ok && Date.now() - hit.at < TTL_MS) {
    page.html = hit.page.html;
    page.fullText = hit.page.fullText;
    return hit.result;
  }
  const result = await fetchSource(url, page);
  if (result.ok) {
    const value: Cached = {
      at: Date.now(),
      result,
      page: { html: page.html, fullText: page.fullText },
    };
    await putSetting(key, value).catch(() => undefined);
  }
  return result;
}
