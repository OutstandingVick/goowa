import { describe, expect, it } from "vitest";

import { applyOverrides, evaluateGate, type GateClaim } from "../shared/gate";

const ok = {
  id: "s-ok",
  title: "Circle",
  url: "https://c",
  flags: [],
  fetchedAt: "2026-11-01T00:00:00Z",
};
const bad = {
  id: "s-bad",
  title: "Injected",
  url: "https://x",
  flags: ["injection_suspected", "quarantined"],
  fetchedAt: "2026-11-01T00:00:00Z",
};
const claim = (over: Partial<GateClaim>): GateClaim => ({
  id: "c",
  text: "A claim.",
  status: "unverified",
  verdict: "supported",
  verdictConfidence: 0.95,
  sourceIds: ["s-ok"],
  reviewState: "ok",
  reviewReason: null,
  verifiedAt: "2026-11-02T00:00:00Z",
  verifiedFingerprint: "f",
  ...over,
});

describe("evaluateGate", () => {
  it("lets a clean document publish", () => {
    expect(
      evaluateGate({ claims: [claim({})], sources: [ok], pendingEdits: [] }),
    ).toEqual({
      canPublish: true,
      blockers: [],
      warnings: [],
    });
  });

  it("blocks laundered, unsupported, and quarantined claims", () => {
    const g = evaluateGate({
      claims: [
        claim({ id: "a", verdict: "laundered" }),
        claim({ id: "b", verdict: "unsupported" }),
        claim({ id: "q", sourceIds: ["s-bad"] }),
      ],
      sources: [ok, bad],
      pendingEdits: [],
    });
    expect(g.canPublish).toBe(false);
    expect(g.blockers.map((b) => b.kind)).toEqual([
      "claim_laundered",
      "claim_unsupported",
      "claim_quarantined",
      "injection_source",
    ]);
    expect(
      g.blockers.find((b) => b.kind === "claim_quarantined")!.overridable,
    ).toBe(false);
  });
});

describe("evaluateGate review, proposals, and stale sources", () => {
  it("blocks claims needing review and undecided proposals", () => {
    const g = evaluateGate({
      claims: [
        claim({
          id: "r",
          reviewState: "needs_review",
          reviewReason: "Depends on claim #1, which changed",
        }),
      ],
      sources: [ok],
      pendingEdits: [
        { id: "e1", targetType: "claim", targetId: "r", before: "A claim." },
      ],
    });
    expect(g.blockers.map((b) => [b.kind, b.overridable])).toEqual([
      ["needs_review", true],
      ["pending_proposal", false],
    ]);
  });

  it("blocks a stale source until its claims are re-verified", () => {
    const stale = {
      ...ok,
      flags: ["stale"],
      fetchedAt: "2026-11-03T00:00:00Z",
    };
    expect(
      evaluateGate({ claims: [claim({})], sources: [stale], pendingEdits: [] })
        .blockers[0]!.kind,
    ).toBe("stale_source");
    const rechecked = claim({ verifiedAt: "2026-11-04T00:00:00Z" });
    expect(
      evaluateGate({ claims: [rechecked], sources: [stale], pendingEdits: [] })
        .canPublish,
    ).toBe(true);
  });
});

describe("evaluateGate warnings", () => {
  it("warns about weak and low-confidence claims without blocking", () => {
    const g = evaluateGate({
      claims: [
        claim({ id: "w", verdict: "weak" }),
        claim({ id: "l", verdictConfidence: 0.4 }),
      ],
      sources: [ok],
      pendingEdits: [],
    });
    expect(g.canPublish).toBe(true);
    expect(g.warnings.map((w) => w.kind)).toEqual(["weak", "low_confidence"]);
  });

  it("lets a human status clear a verdict blocker", () => {
    const g = evaluateGate({
      claims: [claim({ verdict: "laundered", status: "supported" })],
      sources: [ok],
      pendingEdits: [],
    });
    expect(g.canPublish).toBe(true);
  });
});

describe("applyOverrides", () => {
  const gate = evaluateGate({
    claims: [
      claim({ id: "a", verdict: "laundered" }),
      claim({ id: "q", sourceIds: ["s-bad"] }),
    ],
    sources: [ok, bad],
    pendingEdits: [
      { id: "e1", targetType: "document_body", targetId: "d", before: "x" },
    ],
  });

  it("accepts overrides with reasons for overridable blockers", () => {
    const r = applyOverrides(gate, [
      { claimId: "a", reason: "Checked the primary report by hand." },
    ]);
    expect(r.accepted.map((a) => a.kind)).toEqual(["claim_laundered"]);
    expect(r.remaining.map((b) => b.kind)).toEqual([
      "claim_quarantined",
      "pending_proposal",
      "injection_source",
    ]);
  });

  it("refuses overrides without a reason", () => {
    const r = applyOverrides(gate, [{ claimId: "a", reason: "  " }]);
    expect(r.problems[0]).toMatch(/needs a reason/);
    expect(r.accepted).toEqual([]);
  });

  it("refuses to override quarantined sources", () => {
    const r = applyOverrides(gate, [
      { claimId: "q", reason: "trust me" },
      { sourceId: "s-bad", reason: "trust me" },
    ]);
    expect(r.problems).toHaveLength(2);
    expect(r.problems.every((p) => p.startsWith("Cannot override"))).toBe(true);
  });
});
