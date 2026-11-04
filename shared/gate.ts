// The publish gate: a pure function of document state, shared by the
// request-publish/publish actions and the editor's gate panel.

import { effectiveStatus, STATUS_LABEL } from "./status.js";

export type BlockerKind =
  | "claim_unsupported"
  | "claim_laundered"
  | "claim_quarantined"
  | "needs_review"
  | "pending_proposal"
  | "injection_source"
  | "stale_source";

export type Blocker = {
  kind: BlockerKind;
  claimId?: string;
  sourceId?: string;
  editId?: string;
  message: string;
  overridable: boolean;
};

export type Warning = {
  kind: "weak" | "low_confidence";
  claimId: string;
  message: string;
};

export type GateResult = {
  canPublish: boolean;
  blockers: Blocker[];
  warnings: Warning[];
};

export type GateClaim = {
  id: string;
  text: string;
  status: string;
  verdict: string | null;
  verdictConfidence: number | null;
  sourceIds: string[];
  reviewState: string;
  reviewReason: string | null;
  verifiedAt: string | null;
  verifiedFingerprint: string | null;
};
export type GateSource = {
  id: string;
  title: string;
  url: string;
  flags: string[];
  fetchedAt: string;
};
export type GateEdit = {
  id: string;
  targetType: string;
  targetId: string;
  before: string;
};

/** Blockers a human may override with a reason. */
export const OVERRIDABLE: ReadonlySet<BlockerKind> = new Set([
  "claim_unsupported",
  "claim_laundered",
  "needs_review",
  "stale_source",
]);

export const LOW_CONFIDENCE = 0.6;

const quote = (text: string) =>
  text.length > 70 ? `“${text.slice(0, 67)}…”` : `“${text}”`;

export function evaluateGate(input: {
  claims: GateClaim[];
  sources: GateSource[];
  pendingEdits: GateEdit[];
}): GateResult {
  const { claims, sources, pendingEdits } = input;
  const blockers: Blocker[] = [];
  const warnings: Warning[] = [];
  const label = (id: string) => `#${claims.findIndex((c) => c.id === id) + 1}`;
  const add = (b: Omit<Blocker, "overridable">) =>
    blockers.push({ ...b, overridable: OVERRIDABLE.has(b.kind) });

  claims.forEach((c, i) => {
    const n = `Claim #${i + 1} ${quote(c.text)}`;
    const status = effectiveStatus(c, sources);
    if (status === "quarantined") {
      add({
        kind: "claim_quarantined",
        claimId: c.id,
        message: `${n} relies only on a quarantined source.`,
      });
    } else if (status === "laundered") {
      add({
        kind: "claim_laundered",
        claimId: c.id,
        message: `${n} cites a source that does not support it.`,
      });
    } else if (status === "unsupported") {
      add({
        kind: "claim_unsupported",
        claimId: c.id,
        message: `${n} is ${STATUS_LABEL[status].toLowerCase()}.`,
      });
    } else if (status === "weak") {
      warnings.push({
        kind: "weak",
        claimId: c.id,
        message: `${n} is only weakly supported.`,
      });
    }
    if (c.reviewState === "needs_review") {
      add({
        kind: "needs_review",
        claimId: c.id,
        message: `${n} needs review: ${c.reviewReason ?? "an upstream claim changed"}.`,
      });
    }
    if (
      status !== "quarantined" &&
      c.verdict &&
      c.verdictConfidence !== null &&
      c.verdictConfidence < LOW_CONFIDENCE &&
      status !== "weak"
    ) {
      warnings.push({
        kind: "low_confidence",
        claimId: c.id,
        message: `${n} was verified with low confidence (${Math.round(c.verdictConfidence * 100)}%).`,
      });
    }
  });

  for (const e of pendingEdits) {
    const target =
      e.targetType === "claim"
        ? `claim ${label(e.targetId)}`
        : `the text ${quote(e.before)}`;
    add({
      kind: "pending_proposal",
      editId: e.id,
      ...(e.targetType === "claim" ? { claimId: e.targetId } : {}),
      message: `A proposed edit to ${target} is still undecided.`,
    });
  }

  for (const s of sources) {
    const citing = claims.filter((c) => c.sourceIds.includes(s.id));
    if (citing.length === 0) continue;
    if (s.flags.includes("injection_suspected")) {
      add({
        kind: "injection_source",
        sourceId: s.id,
        message: `${s.title || s.url} is flagged for prompt injection and is still cited by ${citing.map((c) => label(c.id)).join(", ")}.`,
      });
    }
    if (s.flags.includes("stale")) {
      const unchecked = citing.filter(
        (c) =>
          !c.verifiedFingerprint || !c.verifiedAt || c.verifiedAt < s.fetchedAt,
      );
      if (unchecked.length > 0) {
        add({
          kind: "stale_source",
          sourceId: s.id,
          message: `${s.title || s.url} changed since it was cited; ${unchecked.map((c) => label(c.id)).join(", ")} not re-verified.`,
        });
      }
    }
  }

  return { canPublish: blockers.length === 0, blockers, warnings };
}

export type Override = {
  claimId?: string;
  sourceId?: string;
  kind?: BlockerKind;
  reason: string;
};

/** Key that ties an override to a blocker. */
export const blockerKey = (b: {
  kind?: string;
  claimId?: string;
  sourceId?: string;
  editId?: string;
}) =>
  `${b.kind ?? "*"}|${b.claimId ?? ""}|${b.sourceId ?? ""}|${b.editId ?? ""}`;

/**
 * Apply human overrides. An override matches a blocker on its claim (or
 * source) and, if given, its kind. Returns what still blocks and why.
 */
export function applyOverrides(
  gate: GateResult,
  overrides: Override[],
): {
  remaining: Blocker[];
  accepted: (Override & { kind: BlockerKind })[];
  problems: string[];
} {
  const problems: string[] = [];
  const accepted: (Override & { kind: BlockerKind })[] = [];
  const remaining: Blocker[] = [];
  for (const b of gate.blockers) {
    const o = overrides.find(
      (o) =>
        (o.kind === undefined || o.kind === b.kind) &&
        ((o.claimId !== undefined && o.claimId === b.claimId) ||
          (o.sourceId !== undefined && o.sourceId === b.sourceId)),
    );
    if (!o) {
      remaining.push(b);
      continue;
    }
    if (!b.overridable) {
      problems.push(`Cannot override: ${b.message}`);
      remaining.push(b);
    } else if (!o.reason.trim()) {
      problems.push(`An override needs a reason: ${b.message}`);
      remaining.push(b);
    } else {
      accepted.push({ ...o, kind: b.kind });
    }
  }
  return { remaining, accepted, problems };
}
