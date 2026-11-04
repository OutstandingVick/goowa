import { describe, expect, it } from "vitest";

import { forbiddenClaimFields } from "../server/lib/claim-policy";

describe("forbiddenClaimFields", () => {
  it("lets humans set any field", () => {
    expect(
      forbiddenClaimFields("human", {
        status: "supported",
        confidence: 0.9,
        dependsOn: ["x"],
        text: "t",
      }),
    ).toEqual([]);
  });

  it("lets the agent change text and sourceIds", () => {
    expect(
      forbiddenClaimFields("agent", { text: "t", sourceIds: ["s"] }),
    ).toEqual([]);
  });

  it("blocks the agent from setting status supported", () => {
    expect(forbiddenClaimFields("agent", { status: "supported" })).toEqual([
      "status",
    ]);
  });

  it("blocks the agent from confidence and dependsOn", () => {
    expect(
      forbiddenClaimFields("agent", {
        confidence: 1,
        dependsOn: [],
        text: "t",
      }),
    ).toEqual(["confidence", "dependsOn"]);
  });
});

describe("human override note", () => {
  it("is human only", () => {
    expect(forbiddenClaimFields("agent", { note: "looks fine" })).toEqual([
      "note",
    ]);
    expect(
      forbiddenClaimFields("human", { note: "confirmed in the PDF" }),
    ).toEqual([]);
  });
});
