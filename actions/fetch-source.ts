import { createHash } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { z } from "zod";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const EXCERPT_CHARS = 2_000;

type FetchSourceError = {
  ok: false;
  url: string;
  error: {
    code:
      | "invalid_url"
      | "timeout"
      | "network"
      | "http_status"
      | "not_html"
      | "too_large"
      | "no_readable_text";
    message: string;
    status?: number;
  };
};

type FetchSourceOk = {
  ok: true;
  url: string;
  title: string;
  textExcerpt: string;
  contentHash: string;
  fetchedAt: string;
};

function fail(
  url: string,
  code: FetchSourceError["error"]["code"],
  message: string,
  status?: number,
): FetchSourceError {
  return { ok: false, url, error: { code, message, status } };
}

// Hostname-level guard only; DNS rebinding is out of scope for the spike.
function isPrivateHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    /^(127|10|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host)
  );
}

function extractReadable(html: string, url: string) {
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const title = (article?.title || document.title || "").trim();
  const raw = article?.textContent ?? document.body?.textContent ?? "";
  const text = raw.replace(/\s+/g, " ").trim();
  return { title: title || url, text };
}

export default defineAction({
  description:
    "Fetch a web page server-side and return its title, the first 2,000 characters of readable text, and a sha256 hash of that text. Returns { ok: false, error } instead of throwing on failure.",
  mcpTool: true,
  readOnly: true,
  schema: z.object({
    url: z.string().describe("Absolute http(s) URL of the source page"),
  }),
  http: { method: "GET" },
  run: async ({ url }): Promise<FetchSourceOk | FetchSourceError> => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return fail(url, "invalid_url", "Not a valid URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fail(url, "invalid_url", "Only http and https URLs are supported.");
    }

    if (isPrivateHost(parsed.hostname)) {
      return fail(url, "invalid_url", "Private and local addresses are not allowed.");
    }

    let res: Response;
    try {
      res = await fetch(parsed, {
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "GoowaBot/0.1 (+source verification)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        return fail(url, "timeout", `No response within ${TIMEOUT_MS} ms.`);
      }
      return fail(url, "network", (err as Error)?.message ?? "Fetch failed.");
    }

    if (!res.ok) {
      return fail(
        url,
        "http_status",
        `Server responded ${res.status} ${res.statusText}.`,
        res.status,
      );
    }

    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      return fail(url, "not_html", `Unsupported content type: ${type || "none"}.`);
    }

    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) {
      return fail(url, "too_large", `Page is larger than ${MAX_BYTES} bytes.`);
    }

    let html: string;
    try {
      html = await res.text();
    } catch (err) {
      return fail(url, "network", (err as Error)?.message ?? "Read failed.");
    }
    if (html.length > MAX_BYTES) {
      return fail(url, "too_large", `Page is larger than ${MAX_BYTES} bytes.`);
    }

    const { title, text } = extractReadable(html, res.url || url);
    if (!text) {
      return fail(url, "no_readable_text", "No readable text found on the page.");
    }

    return {
      ok: true,
      url: res.url || url,
      title,
      textExcerpt: text.slice(0, EXCERPT_CHARS),
      contentHash: createHash("sha256").update(text).digest("hex"),
      fetchedAt: new Date().toISOString(),
    };
  },
});
