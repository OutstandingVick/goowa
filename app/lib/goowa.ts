// Result types come from the generated action registry.
type ActionResult<K extends keyof AgentNativeActionRegistry> =
  AgentNativeActionRegistry[K]["result"];

export type DocumentState = ActionResult<"get-document-state">;
export type Claim = DocumentState["claims"][number];
export type Source = DocumentState["sources"][number];
export type Edit = DocumentState["pendingEdits"][number];
export type ChangeSet = DocumentState["changeSets"][number];
export type Activity = DocumentState["activity"][number];

export {
  STATUS_LABEL,
  STATUS_ORDER,
  VERDICT_LABEL,
  asStatus,
  effectiveStatus,
  humanStatus,
  type ClaimStatus,
  type Verdict,
} from "../../shared/status";
import { STATUS_ORDER, type ClaimStatus } from "../../shared/status";

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function countByStatus(statuses: readonly ClaimStatus[]) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    ClaimStatus,
    number
  >;
  for (const s of statuses) counts[s] += 1;
  return counts;
}

/** Smooth scrolling unless the user asked for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/** User-facing text for an action error, without the "Action x failed:" prefix. */
export function errorText(
  error: { message?: string } | null | undefined,
): string {
  const message = error?.message ?? "Something went wrong. Try again.";
  return message.replace(/^Action [\w-]+ failed:\s*/i, "");
}
