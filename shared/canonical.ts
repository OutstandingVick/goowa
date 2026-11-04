// Canonical JSON for receipt hashing. The same input always serialises to
// the same string, in the browser and on the server:
//   - object keys sorted by UTF-16 code unit order at every depth
//   - array order preserved
//   - no insignificant whitespace
//   - `undefined` object members dropped (as JSON.stringify does)
//   - numbers and strings serialised exactly as JSON.stringify does
// The hash is sha256 over the UTF-8 bytes of that string, as lowercase hex.

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("Receipts cannot contain NaN or Infinity.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? "null" : canonicalize(v))).join(",")}]`;
  }
  const entries = Object.keys(value)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`,
    );
  return `{${entries.join(",")}}`;
}

/** sha256 hex of a string, using Web Crypto (browser and Node 20+). */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Hash of a receipt: canonical JSON of everything except `receiptHash`. */
export async function receiptHashOf(
  receipt: Record<string, unknown>,
): Promise<string> {
  const { receiptHash: _ignored, ...rest } = receipt;
  return sha256Hex(canonicalize(rest));
}
