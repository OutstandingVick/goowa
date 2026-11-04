import type { ClaimStatus } from "../../shared/machines.js";
import type { Actor } from "./actor.js";

export type ClaimPatch = {
  text?: string | undefined;
  sourceIds?: string[] | undefined;
  status?: ClaimStatus | undefined;
  confidence?: number | undefined;
  dependsOn?: string[] | undefined;
  note?: string | undefined;
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
