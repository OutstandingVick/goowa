import { defineMachine } from "@agent-native/core/state-machine";

export const documentStatus = defineMachine({
  id: "document-status",
  states: ["draft", "in_review", "published"],
  initial: "draft",
  terminal: [],
  transitions: {
    submit: { from: ["draft"], to: "in_review" },
    publish: { from: ["in_review"], to: "published" },
    reopen: { from: ["in_review", "published"], to: "draft" },
  },
});

export const editState = defineMachine({
  id: "edit-state",
  states: ["proposed", "accepted", "rejected"],
  initial: "proposed",
  terminal: ["accepted", "rejected"],
  transitions: {
    accept: { from: ["proposed"], to: "accepted" },
    reject: { from: ["proposed"], to: "rejected" },
  },
});

export const CLAIM_STATUSES = [
  "unverified",
  "supported",
  "weak",
  "unsupported",
  "quarantined",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const SOURCE_FLAGS = [
  "injection_suspected",
  "quarantined",
  "stale",
  "fetch_failed",
] as const;

/** Machine verification result; separate from the human `status`. */
export const VERDICTS = [
  "supported",
  "weak",
  "unsupported",
  "laundered",
  "unverifiable",
] as const;
export type Verdict = (typeof VERDICTS)[number];
export type SourceFlag = (typeof SOURCE_FLAGS)[number];
