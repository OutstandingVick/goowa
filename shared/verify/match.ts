// Exact matching between a claim and a source, tolerant of case, curly
// quotes, dashes, and whitespace, with offsets mapped back to the original
// source so evidence always points at real stored text.

type Folded = { text: string; map: number[] }; // map[i] = original index

const FOLD: Record<string, string> = {
  "’": "'",
  "‘": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  " ": " ",
};

export function fold(text: string): Folded {
  let out = "";
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    let ch = FOLD[text[i]!] ?? text[i]!;
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      ch = " ";
      lastSpace = true;
    } else {
      lastSpace = false;
      ch = ch.toLowerCase();
    }
    out += ch;
    map.push(i);
  }
  return { text: out.trimEnd(), map };
}

const LEAD_IN =
  /^(?:according to [^,]{2,80},\s*|(?:the\s+)?[A-Z][\w.&'’ -]{1,80}?\s+(?:says|said|reports|reported|notes|noted|states|stated|describes|writes|wrote|explains|estimates|found)(?:\s+that)?\s+)/i;

/** The claim with any attribution lead-in ("Circle says ...") removed. */
export function claimCore(claim: string): string {
  return claim
    .replace(LEAD_IN, "")
    .replace(/[.\s]+$/, "")
    .trim();
}

/** Find the claim (or its core) verbatim in the source, modulo folding. */
export function findExact(
  claim: string,
  source: string,
): { start: number; end: number } | null {
  const src = fold(source);
  for (const candidate of [claim.replace(/[.\s]+$/, ""), claimCore(claim)]) {
    const needle = fold(candidate).text;
    if (needle.length < 12) continue;
    const at = src.text.indexOf(needle);
    if (at >= 0) {
      const start = src.map[at]!;
      const end = src.map[at + needle.length - 1]! + 1;
      return { start, end };
    }
  }
  return null;
}

/** The snippet must be literally present at its offsets (or somewhere). */
export function snippetInSource(
  snippet: string,
  source: string,
  start: number,
  end: number,
): boolean {
  if (!snippet) return false;
  return source.slice(start, end) === snippet || source.includes(snippet);
}
