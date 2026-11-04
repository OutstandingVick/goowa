// Numeric guard: every number, date, or percentage a claim states must also
// appear in its supporting snippet, allowing common formatting variants.

export type NumberMention = {
  raw: string;
  value: number;
  kind: "percent" | "plain" | "ratio";
};

const SCALE: Record<string, number> = {
  thousand: 1e3,
  k: 1e3,
  million: 1e6,
  mn: 1e6,
  m: 1e6,
  billion: 1e9,
  bn: 1e9,
  b: 1e9,
  trillion: 1e12,
  tn: 1e12,
  t: 1e12,
};

const NUMBER =
  /(\$|€|£|USD\s?)?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(%|percent|per cent|percentage points?)|\s*(thousand|million|billion|trillion|bn|mn|tn|[kmbt])\b)?(?::(\d+(?:\.\d+)?))?/gi;

export function extractNumbers(text: string): NumberMention[] {
  const out: NumberMention[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const [raw, , digits, pct, scale, ratioRight] = m;
    // Skip digits that are part of a word or identifier (e.g. "COVID-19", "H2").
    const before = text[m.index - 1] ?? "";
    if (/[A-Za-z-]/.test(before) && !/\$|€|£/.test(raw)) continue;
    const base = Number(digits!.replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    if (ratioRight !== undefined) {
      out.push({ raw, value: base / Number(ratioRight), kind: "ratio" });
    } else if (pct) {
      out.push({ raw, value: base, kind: "percent" });
    } else {
      const factor = scale ? (SCALE[scale.toLowerCase()] ?? 1) : 1;
      out.push({ raw, value: base * factor, kind: "plain" });
    }
  }
  return out;
}

function close(a: number, b: number) {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** True when `b` expresses the same quantity as `a` in some common form. */
export function sameQuantity(a: NumberMention, b: NumberMention): boolean {
  if (close(a.value, b.value) && (a.kind === b.kind || a.kind !== "ratio")) {
    return true;
  }
  // 40% ⇔ 0.4
  if (a.kind === "percent" && b.kind === "plain")
    return close(a.value / 100, b.value);
  if (a.kind === "plain" && b.kind === "percent")
    return close(a.value, b.value / 100);
  return false;
}

/** Claim numbers that the snippet does not contain, in claim order. */
export function missingNumbers(
  claim: string,
  snippet: string,
): NumberMention[] {
  const have = extractNumbers(snippet);
  return extractNumbers(claim).filter(
    (n) => !have.some((h) => sameQuantity(n, h)),
  );
}
