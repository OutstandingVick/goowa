import { describe, expect, it, vi } from "vitest";

const writes: Record<string, unknown>[] = [];
vi.mock("../server/db/index", () => {
  const source = {
    id: "s1",
    documentId: "d1",
    title: "USDC overview",
    url: "https://developers.circle.com/x",
    fullText:
      "USDC is a digital dollar issued by Circle, running on many major blockchains.",
    textExcerpt: "",
    contentHash: "h1",
    flags: [],
  };
  const chain = {
    select: () => ({ from: () => ({ where: async () => [source] }) }),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        writes.push(payload);
        return { where: async () => undefined };
      },
    }),
  };
  return { getDb: () => chain, schema: { sources: {}, claims: {} } };
});
vi.mock("@agent-native/core/decisions", () => ({ decide: vi.fn() }));

const { verifyAndStore } = await import("../server/lib/verify");

describe("verifyAndStore", () => {
  it("writes the machine verdict and never the human status", async () => {
    const claim = {
      id: "c1",
      documentId: "d1",
      text: "USDC is a digital dollar issued by Circle, running on many major blockchains.",
      sourceIds: ["s1"],
      status: "unverified",
    } as never;
    const r = await verifyAndStore(claim, "agent", "dev@local.test");
    expect(r.verdict).toBe("supported");
    const payload = writes.at(-1)!;
    expect(payload).not.toHaveProperty("status");
    expect(payload).toMatchObject({
      verdict: "supported",
      verifiedBy: "agent",
    });
  });
});
