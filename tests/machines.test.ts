import { describe, expect, it } from "vitest";

import { documentStatus, editState } from "../shared/machines";

describe("document status machine", () => {
  it("goes draft → in_review → published and back to draft", () => {
    expect(documentStatus.transition("draft", "submit")).toBe("in_review");
    expect(documentStatus.transition("in_review", "publish")).toBe("published");
    expect(documentStatus.transition("published", "reopen")).toBe("draft");
  });

  it("cannot publish straight from draft", () => {
    expect(documentStatus.can("draft", "publish")).toBe(false);
  });
});

describe("edit state machine", () => {
  it("only decides proposed edits", () => {
    expect(editState.fromStates("accept")).toEqual(["proposed"]);
    expect(editState.can("accepted", "reject")).toBe(false);
    expect(editState.isTerminal("rejected")).toBe(true);
  });
});
