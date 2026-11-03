import type { Actor } from "./actor.js";
import type { ClaimStatus } from "../../shared/machines.js";

export type ClaimPatch = {
  text?: string;
  sourceIds?: string[];
  status?: ClaimStatus;
  confidence?: number;
  dependsOn?: string[];
};

// Agents may change text (as a proposal) and sourceIds. Status, confidence,
// and dependencies are human judgements.
const AGENT_FIELDS = new Set<keyof ClaimPatch>(["text", "sourceIds"]);

/** Returns the fields the actor may not set, empty when the patch is allowed. */
export function forbiddenClaimFields(
  actor: Actor,
  patch: ClaimPatch,
): (keyof ClaimPatch)[] {
  if (actor === "human") return [];
  return (Object.keys(patch) as (keyof ClaimPatch)[]).filter(
    (key) => patch[key] !== undefined && !AGENT_FIELDS.has(key),
  );
}
