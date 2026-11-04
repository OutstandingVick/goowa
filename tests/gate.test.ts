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
