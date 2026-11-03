import { describe, expect, it } from "vitest";

import addClaim from "../actions/add-claim";
import decideEdit from "../actions/decide-edit";
import setDocumentStatus from "../actions/set-document-status";
import updateClaim from "../actions/update-claim";

// Each call runs the real action with the context the framework gives the
// in-app agent ("tool") or an MCP client. The guard runs before any database
// access, so these need no database.
const AGENT_CALLERS = ["tool", "mcp", "a2a", "automation", "http"] as const;

async function errorCodeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return (err as { errorCode?: string }).errorCode;
  }
  return "no error";
}

describe("decide-edit is human only", () => {
  it.each(AGENT_CALLERS)("refuses caller %s with forbidden", async (caller) => {
    for (const decision of ["accept", "reject"] as const) {
      const code = await errorCodeOf(
        decideEdit.run({ editId: "e1", decision }, { caller } as never),
      );
      expect(code).toBe("forbidden");
    }
  });

  it("is hidden from the agent and MCP", () => {
    expect(decideEdit.agentTool).toBe(false);
    expect(decideEdit.mcpTool).toBe(false);
  });
});

describe("set-document-status is human only", () => {
  it.each(AGENT_CALLERS)("refuses caller %s publishing", async (caller) => {
    const code = await errorCodeOf(
      setDocumentStatus.run({ documentId: "d1", event: "publish" }, {
        caller,
      } as never),
    );
    expect(code).toBe("forbidden");
  });
});

describe("agents cannot mark claims supported", () => {
  it.each(AGENT_CALLERS)(
    "update-claim refuses status from %s",
    async (caller) => {
      const code = await errorCodeOf(
        updateClaim.run({ claimId: "c1", status: "supported" }, {
          caller,
        } as never),
      );
      expect(code).toBe("forbidden");
    },
  );

  it("add-claim refuses status and confidence from the agent", async () => {
    const code = await errorCodeOf(
      addClaim.run(
        {
          documentId: "d1",
          quote: "x",
          sourceIds: [],
          dependsOn: [],
          status: "supported",
        },
        { caller: "tool" } as never,
      ),
    );
    expect(code).toBe("forbidden");
    const code2 = await errorCodeOf(
      addClaim.run(
        {
          documentId: "d1",
          quote: "x",
          sourceIds: [],
          dependsOn: [],
          confidence: 1,
        },
        { caller: "tool" } as never,
      ),
    );
    expect(code2).toBe("forbidden");
  });
});
