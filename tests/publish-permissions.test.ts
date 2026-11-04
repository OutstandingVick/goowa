import { describe, expect, it, vi } from "vitest";

const activity: Record<string, unknown>[] = [];
vi.mock("../server/lib/documents", () => ({
  loadDocument: async () => ({
    id: "d1",
    status: "draft",
    revision: 1,
    body: "",
  }),
  now: () => "2026-11-04T00:00:00Z",
}));
vi.mock("../server/lib/activity", () => ({
  logActivity: async (...args: unknown[]) => {
    activity.push({
      documentId: args[0],
      kind: args[1],
      actor: args[2],
      summary: args[3],
    });
  },
}));
vi.mock("../server/db/index", () => ({ getDb: () => ({}), schema: {} }));
vi.mock("../server/lib/gate", () => ({
  gateFor: async () => ({ canPublish: true, blockers: [], warnings: [] }),
}));

const { default: publish } = await import("../actions/publish");

describe("publish is human only", () => {
  it.each(["tool", "mcp", "a2a", "http", "automation"])(
    "refuses %s with forbidden and records the attempt",
    async (caller) => {
      activity.length = 0;
      let code = "no error";
      try {
        await publish.run({ documentId: "d1", overrides: [] }, {
          caller,
        } as never);
      } catch (err) {
        code = (err as { errorCode?: string }).errorCode ?? "error";
      }
      expect(code).toBe("forbidden");
      expect(activity).toEqual([
        {
          documentId: "d1",
          kind: "publish_blocked",
          actor: "agent",
          summary: "Agent attempted to publish · blocked",
        },
      ]);
    },
  );

  it("is hidden from the agent and MCP", () => {
    expect(publish.agentTool).toBe(false);
    expect(publish.mcpTool).toBe(false);
  });
});
