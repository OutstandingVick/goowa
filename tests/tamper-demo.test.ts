import { describe, expect, it } from "vitest";

import { tamperedCopy } from "../app/components/receipt/VerifyPanel";
import type { Receipt } from "../shared/receipt";

describe("tamperedCopy (?tamper=1 demo)", () => {
  it("changes one digit of the first snippet and leaves the original untouched", () => {
    const original = {
      document: { body: "b" },
      claims: [
        { evidence: [{ snippet: "supply reached $160 billion" }] },
        { evidence: [{ snippet: "99%" }] },
      ],
    } as unknown as Receipt;
    const copy = tamperedCopy(original);
    expect(copy.claims[0]!.evidence[0]!.snippet).toBe(
      "supply reached $260 billion",
    );
    expect(copy.claims[1]!.evidence[0]!.snippet).toBe("99%");
    expect(original.claims[0]!.evidence[0]!.snippet).toBe(
      "supply reached $160 billion",
    );
  });
});
