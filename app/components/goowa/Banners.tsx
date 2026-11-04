import { IconAlertOctagon, IconLock, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Activity } from "@/lib/goowa";

type GateData = {
  gate?: { blockers?: { message: string }[]; warnings?: unknown[] };
};

/** Shown when the agent tried to publish in the last 30 minutes. */
export function AgentAttemptBanner({
  activity,
  onReview,
}: {
  activity: Activity[];
  onReview: () => void;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const latest = activity.find(
    (a) => a.kind === "publish_blocked" && a.actor === "agent",
  );
  if (!latest || latest.id === dismissed) return null;
  if (Date.now() - new Date(latest.createdAt).getTime() > 30 * 60_000)
    return null;
  const blockers = (latest.data as GateData).gate?.blockers ?? [];
  return (
    <div
      role="alert"
      data-status="unsupported"
      className="mx-auto mb-6 max-w-[68ch] rounded-lg border border-[hsl(var(--tone)/0.35)] bg-[hsl(var(--tone-bg))] p-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <IconAlertOctagon
          className="mt-0.5 size-4 shrink-0 text-[hsl(var(--tone))]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[hsl(var(--tone))]">
            Agent requested publish → blocked: human approval required
          </p>
          {blockers.length > 0 ? (
            <>
              <p className="mt-1 text-foreground/80">
                The gate also found {blockers.length} blocker
                {blockers.length === 1 ? "" : "s"}:
              </p>
              <ul className="mt-1 list-disc pl-5 text-foreground/80">
                {blockers.slice(0, 3).map((b, i) => (
                  <li key={i}>{b.message}</li>
                ))}
                {blockers.length > 3 && <li>and {blockers.length - 3} more</li>}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-foreground/80">
              The gate is clear; only you can publish.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 bg-background px-2 text-xs"
              onClick={onReview}
            >
              Review in Publish
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(latest.id)}
          className="rounded p-0.5 text-muted-foreground hover:bg-background/70"
        >
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Published documents are read-only until a human reopens them. */
export function PublishedBanner({
  revision,
  publishedAt,
}: {
  revision: number;
  publishedAt: string | null;
}) {
  return (
    <div
      data-status="supported"
      className="mx-auto mb-6 flex max-w-[68ch] items-center gap-2 rounded-lg bg-[hsl(var(--tone-bg))] px-3 py-2 text-sm text-[hsl(var(--tone))]"
    >
      <IconLock className="size-4 shrink-0" aria-hidden />
      Published revision {revision}
      {publishedAt ? ` on ${new Date(publishedAt).toLocaleString()}` : ""}.
      Read-only until a human reopens it.
    </div>
  );
}
