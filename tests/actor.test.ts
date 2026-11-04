import { describe, expect, it } from "vitest";

import { actorOf, requireHuman } from "../server/lib/actor";

describe("actorOf", () => {
  it.each([
    ["frontend", "human"],
    ["cli", "human"],
    ["tool", "agent"],
    ["mcp", "agent"],
    ["a2a", "agent"],
    ["automation", "agent"],
    ["http", "agent"],
    [undefined, "agent"],
  ])("maps caller %s to %s", (caller, expected) => {
    expect(actorOf(caller ? { caller } : undefined)).toBe(expected);
  });
});

describe("requireHuman", () => {
  it("throws a forbidden error for agent callers", () => {
    expect(() => requireHuman({ caller: "tool" }, "accept edits")).toThrow(
      /Only a human/,
    );
    try {
      requireHuman({ caller: "mcp" }, "accept edits");
    } catch (err) {
      expect((err as { errorCode?: string }).errorCode).toBe("forbidden");
    }
  });

  it("allows the UI", () => {
    expect(() =>
      requireHuman({ caller: "frontend" }, "accept edits"),
    ).not.toThrow();
  });
});

describe("requireEditable", () => {
  it("refuses any write to a published document with a typed error", async () => {
    const { requireEditable } = await import("../server/lib/actor");
    expect(() => requireEditable({ status: "draft" })).not.toThrow();
    try {
      requireEditable({ status: "published" });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as { errorCode?: string }).errorCode).toBe("published");
    }
  });
});
