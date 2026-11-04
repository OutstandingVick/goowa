import { describe, expect, it, vi } from "vitest";

const activity: Record<string, unknown>[] = [];
vi.mock("../server/db/index", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ documentId: "d1" }] }),
      }),
    }),
  }),
  schema: { edits: { documentId: "document_id", id: "id" } },
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

const { default: decideEdit } = await import("../actions/decide-edit");

describe("decide-edit is human only", () => {
  it.each(["tool", "mcp", "a2a", "http", "automation"])(
    "refuses %s with forbidden and records the attempt",
    async (caller) => {
      activity.length = 0;
      let code = "no error";
      try {
        await decideEdit.run({ editId: "e1", decision: "accept" }, {
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
          summary: "Agent attempted to accept an edit · blocked",
        },
      ]);
    },
  );

  it("is hidden from the in-app agent but listed for MCP, where it is refused", () => {
    expect(decideEdit.agentTool).toBe(false);
    expect(decideEdit.mcpTool).toBe(true);
  });
});
