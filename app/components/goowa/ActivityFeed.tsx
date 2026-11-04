import {
  IconAlertOctagon,
  IconChecks,
  IconGitBranch,
  IconLockOpen,
  IconPencil,
  IconSend,
  IconShieldCheck,
  type Icon,
} from "@tabler/icons-react";

import type { Activity } from "@/lib/goowa";
import { cn } from "@/lib/utils";

import { ActorBadge } from "./ActorBadge";
import { timeAgo } from "./VerdictPanel";

const ICON: Record<string, Icon> = {
  edit_proposed: IconPencil,
  edit_decided: IconChecks,
  claim_updated: IconPencil,
  verified: IconShieldCheck,
  propagated: IconGitBranch,
  publish_requested: IconSend,
  publish_blocked: IconAlertOctagon,
  published: IconSend,
  override: IconShieldCheck,
  reopened: IconLockOpen,
  review_cleared: IconChecks,
};

/** Everything that happened to a document, newest first. */
export function ActivityFeed({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activity yet. Edits, verifications, propagations, and publish
        attempts appear here.
      </p>
    );
  }
  return (
    <ol className="grid gap-1" aria-label="Activity">
      {activity.map((a) => {
        const Icon = ICON[a.kind] ?? IconPencil;
        const blocked = a.kind === "publish_blocked";
        return (
          <li
            key={a.id}
            data-status={blocked ? "unsupported" : undefined}
            className={cn(
              "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm",
              blocked && "bg-[hsl(var(--tone-bg))]",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0 text-muted-foreground",
                blocked && "text-[hsl(var(--tone))]",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "min-w-0 flex-1",
                blocked && "font-medium text-[hsl(var(--tone))]",
              )}
            >
              {a.summary}
            </span>
            <ActorBadge
              actor={a.actor}
              verb={a.actor === "agent" ? "Agent" : "You"}
              className="shrink-0"
            />
            <time
              className="shrink-0 text-xs tabular-nums text-muted-foreground"
              dateTime={a.createdAt}
            >
              {timeAgo(a.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
