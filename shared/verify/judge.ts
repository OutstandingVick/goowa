// The verification pipeline, independent of storage and of the model. The
// model step is injected (`Judge`) and can only CHOOSE among sentences that
// retrieval took from the stored source text; every guard after it can only
// lower a verdict, never raise it.

import type { Verdict } from "../machines.js";
import { findExact, snippetInSource } from "./match.js";
import {
  extractNumbers,
  missingNumbers,
  type NumberMention,
} from "./numbers.js";
import {
  overlapScore,
  rankPassages,
  weightedTokens,
  type Sentence,
} from "./retrieval.js";

export type SourceInput = {
  id: string;
  title: string;
  text: string; // full readable text (suspicious spans already stripped)
  flags: string[];
};

export type Evidence = {
  sourceId: string;
  snippet: string;
  startOffset: number;
  endOffset: number;
  matchType: "exact" | "paraphrase" | "none";
};

export type Candidate = { id: string; sourceId: string; sentence: Sentence };

export type JudgeAnswer = {
  support: "supports" | "partially" | "does_not_support" | "contradicts";
  evidenceIds: string[]; // ids of chosen candidates
  confidence: number; // 0–1
};

/** Model step: given only the claim and candidate sentences, choose. */
export type Judge = (
  claim: string,
  candidates: Candidate[],
) => Promise<JudgeAnswer | null>;

export type VerifyResult = {
  verdict: Verdict;
  reason: string;
  confidence: number;
  evidence: Evidence[];
  closestPassage: Evidence | null;
  usedModel: boolean;
};

/** Below this overlap no passage is about the claim at all. */
export const LAUNDERED_BELOW = 0.3;
/** At or above this overlap a passage is about the claim's subject. */
export const NUMERIC_TOPIC_AT_LEAST = 0.6;
const MAX_CANDIDATES = 8;

const usable = (s: SourceInput) =>
  s.text.length > 0 &&
  !s.flags.includes("fetch_failed") &&
  !s.flags.includes("quarantined");

/** The source's figures of the same kind as the claim's missing ones. */
function describeNumbers(text: string, missing: NumberMention[] = []) {
  const kinds = new Set(missing.map((m) => m.kind));
  const nums = extractNumbers(text)
    .filter((n) => kinds.size === 0 || kinds.has(n.kind))
    .map((n) => n.raw.trim());
  return nums.length ? [...new Set(nums)].join(", ") : "no matching figure";
}

export async function verifyClaimText(
  claim: string,
  sources: SourceInput[],
  judge: Judge,
): Promise<VerifyResult> {
  const base = { evidence: [], closestPassage: null, usedModel: false };
  if (sources.length === 0) {
    return {
      ...base,
      verdict: "unsupported",
      confidence: 1,
      reason: "This claim cites no sources.",
    };
  }
  const readable = sources.filter(usable);
  if (readable.length === 0) {
    const allQuarantined = sources.every((s) =>
      s.flags.includes("quarantined"),
    );
    return {
      ...base,
      verdict: "unverifiable",
      confidence: 1,
      reason: allQuarantined
        ? "Every cited source is quarantined for suspected prompt injection, so this claim was not checked against it."
        : "No cited source could be read.",
    };
  }

  // 1. Exact match: deterministic, no model.
  for (const s of readable) {
    const hit = findExact(claim, s.text);
    if (hit) {
      const snippet = s.text.slice(hit.start, hit.end);
      const ev: Evidence = {
        sourceId: s.id,
        snippet,
        startOffset: hit.start,
        endOffset: hit.end,
        matchType: "exact",
      };
      const missing = missingNumbers(claim, snippet);
      if (missing.length === 0) {
        return {
          ...base,
          verdict: "supported",
          confidence: 1,
          evidence: [ev],
          reason: `Exact match in “${s.title}”.`,
        };
      }
    }
  }

  // 2. Retrieval: top 3 passages per source, best overall first.
  const ranked = readable
    .flatMap((s) => rankPassages(claim, s.text, 3).map((p) => ({ s, p })))
    .sort((a, b) => b.p.score - a.p.score);
  const best = ranked[0];
  const closest: Evidence | null = best
    ? {
        sourceId: best.s.id,
        snippet: best.p.text,
        startOffset: best.p.start,
        endOffset: best.p.end,
        matchType: "none",
      }
    : null;

  // 3. Nothing in the cited source is about the claim: laundered citation.
  if (!best || best.p.score < LAUNDERED_BELOW) {
    return {
      ...base,
      closestPassage: closest,
      verdict: "laundered",
      confidence: 1 - (best?.p.score ?? 0),
      reason: "Cited source does not contain or support this claim.",
    };
  }

  // 3b. Same topic, different figures: deterministic numeric mismatch. The
  // best passage is clearly about the claim but states other numbers.
  if (best.p.score >= NUMERIC_TOPIC_AT_LEAST) {
    // The sentence most about the claim that states a figure of the same kind.
    const missingKinds = new Set(
      missingNumbers(claim, best.p.text).map((m) => m.kind),
    );
    const claimTokens = weightedTokens(claim);
    const sentence =
      [...best.p.sentences]
        .filter((x) =>
          extractNumbers(x.text).some((n) => missingKinds.has(n.kind)),
        )
        .sort(
          (a, b) =>
            overlapScore(claimTokens, b.text) -
            overlapScore(claimTokens, a.text),
        )[0] ?? best.p.sentences[0]!;
    const missing = missingNumbers(claim, best.p.text);
    if (missing.length > 0 && extractNumbers(best.p.text).length > 0) {
      return {
        ...base,
        closestPassage: closest,
        verdict: "weak",
        confidence: best.p.score,
        evidence: [
          {
            sourceId: best.s.id,
            snippet: sentence.text,
            startOffset: sentence.start,
            endOffset: sentence.end,
            matchType: "paraphrase",
          },
        ],
        reason: `Claim says ${missing.map((m) => m.raw.trim()).join(", ")}; the source says ${describeNumbers(sentence.text, missing)}.`,
      };
    }
  }

  // 4. Judgment: the model chooses among real sentences.
  const candidates: Candidate[] = [];
  for (const { s, p } of ranked.slice(0, 3)) {
    for (const sentence of p.sentences) {
      if (
        candidates.some(
          (c) => c.sourceId === s.id && c.sentence.start === sentence.start,
        )
      )
        continue;
      candidates.push({
        id: `S${candidates.length + 1}`,
        sourceId: s.id,
        sentence,
      });
    }
  }
  const answer = await judge(claim, candidates.slice(0, MAX_CANDIDATES));
  if (!answer) {
    return {
      ...base,
      closestPassage: closest,
      verdict: "unverifiable",
      confidence: 0,
      reason:
        "The verification model was unavailable, so this claim could not be judged.",
    };
  }
  const chosen = answer.evidenceIds
    .map((id) => candidates.find((c) => c.id === id))
    .filter((c): c is Candidate => Boolean(c));
  const evidence: Evidence[] = chosen.map((c) => ({
    sourceId: c.sourceId,
    snippet: c.sentence.text,
    startOffset: c.sentence.start,
    endOffset: c.sentence.end,
    matchType: "paraphrase",
  }));
  const result = {
    ...base,
    usedModel: true,
    closestPassage: closest,
    evidence,
    confidence: answer.confidence,
  };

  if (answer.support === "does_not_support") {
    return {
      ...result,
      evidence: [],
      verdict: "laundered",
      reason: "Cited source does not contain or support this claim.",
    };
  }
  if (answer.support === "contradicts") {
    return {
      ...result,
      verdict: "unsupported",
      reason: "The cited source contradicts this claim.",
    };
  }

  // 5. Snippet check: every snippet must literally exist in its source.
  const textOf = new Map(readable.map((s) => [s.id, s.text]));
  if (
    evidence.length === 0 ||
    evidence.some(
      (e) =>
        !snippetInSource(
          e.snippet,
          textOf.get(e.sourceId) ?? "",
          e.startOffset,
          e.endOffset,
        ),
    )
  ) {
    return {
      ...result,
      verdict: "unverifiable",
      reason: "Model cited text not in source.",
    };
  }

  // 6. Numeric guard: claim figures must appear in the evidence.
  let verdict: Verdict = answer.support === "supports" ? "supported" : "weak";
  let reason =
    verdict === "supported"
      ? "The cited source states this in different words."
      : "The cited source supports only part of this claim.";
  const joined = evidence.map((e) => e.snippet).join(" ");
  const missing = missingNumbers(claim, joined);
  if (missing.length > 0) {
    verdict = "weak";
    reason = `Claim says ${missing.map((m) => m.raw.trim()).join(", ")}; the supporting passage says ${describeNumbers(joined, missing)}.`;
  }
  return { ...result, verdict, reason };
}
