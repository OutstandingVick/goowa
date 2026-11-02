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
