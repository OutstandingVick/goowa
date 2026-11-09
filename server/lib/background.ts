import { waitUntil } from "@vercel/functions";

/**
 * Run work after the response: on Vercel the function stays alive until it
 * settles (waitUntil); on a long-lived server it simply keeps running. The
 * UI picks up the results through live sync. Failures are logged, never
 * thrown into the request that started them.
 */
export function afterResponse(label: string, work: () => Promise<unknown>) {
  const promise = work().catch((err) => {
    console.error(`[goowa] background ${label} failed:`, err);
  });
  try {
    waitUntil(promise);
  } catch {
    // Not on Vercel: the process keeps the promise alive.
  }
  return promise;
}

/** Map with at most `limit` tasks in flight; each result settles on its own. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]!) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
