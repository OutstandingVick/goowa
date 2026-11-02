import { describe, expect, it } from "vitest";

import ping from "../actions/ping";

describe("ping", () => {
  it("echoes the text with an ISO timestamp", async () => {
    const result = await ping.run({ text: "hello" }, {
      caller: "frontend",
    } as never);
    expect(result.echo).toBe("hello");
    expect(new Date(result.at).toISOString()).toBe(result.at);
  });
});

describe("ping calledBy", () => {
  it.each([
    ["frontend", "ui"],
    ["tool", "agent"],
    ["cli", "unknown"],
    ["mcp", "unknown"],
    [undefined, "unknown"],
  ])("maps caller %s to %s", async (caller, expected) => {
    const ctx = caller ? ({ caller } as never) : undefined;
    const result = await ping.run({ text: "x" }, ctx);
    expect(result.calledBy).toBe(expected);
  });
});
