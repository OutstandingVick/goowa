import { describe, expect, it, vi } from "vitest";

vi.mock("../server/db/index", () => ({ getDb: () => ({}), schema: {} }));
vi.mock("@agent-native/core/decisions", () => ({ decide: vi.fn() }));
const { claimFingerprint } = await import("../server/lib/verify");

const src = (contentHash: string, flags: string[] = []) =>
  ({ id: "s1", contentHash, flags }) as never;

describe("claimFingerprint", () => {
  const claim = { text: "USDC is a digital dollar.", sourceIds: ["s1"] };
  it("is stable for the same claim and sources", () => {
    expect(claimFingerprint(claim, [src("a")])).toBe(
      claimFingerprint(claim, [src("a")]),
    );
  });
  it("changes when the text, the source content, or quarantine changes", () => {
    const base = claimFingerprint(claim, [src("a")]);
    expect(
      claimFingerprint({ ...claim, text: "USDC is a token." }, [src("a")]),
    ).not.toBe(base);
    expect(claimFingerprint(claim, [src("b")])).not.toBe(base);
    expect(claimFingerprint(claim, [src("a", ["quarantined"])])).not.toBe(base);
  });
  it("does not reorder the source's flags", () => {
    const flags = ["stale", "injection_suspected"];
    claimFingerprint(claim, [src("a", flags)]);
    expect(flags).toEqual(["stale", "injection_suspected"]);
  });
});
