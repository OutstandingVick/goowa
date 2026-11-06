import { useActionMutation } from "@agent-native/core/client/hooks";
import { AgentToggleButton } from "@agent-native/toolkit/app/chat";
import { IconLockOpen, IconSend } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  countByStatus,
  effectiveStatus,
  type Claim,
  type Source,
} from "@/lib/goowa";
import { cn } from "@/lib/utils";

import { StatusIcon } from "./StatusBadge";
import { VerifyAllButton } from "./VerifyAllButton";

const DOC_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  in_review: {
    label: "In review",
    className: "bg-[hsl(var(--g-weak-bg))] text-[hsl(var(--g-weak))]",
  },
  published: {
    label: "Published",
    className: "bg-[hsl(var(--g-supported-bg))] text-[hsl(var(--g-supported))]",
  },
};

type Props = {
  documentId: string;
  title: string;
  status: string;
  claims: Claim[];
  sources: Source[];
  pendingCount: number;
  onOpenEdits: () => void;
  onPublish: () => void;
};

export function TopBar({
  documentId,
  title,
  status,
  claims,
  sources,
  pendingCount,
  onOpenEdits,
  onPublish,
}: Props) {
  const reopen = useActionMutation("set-document-status");
  const counts = countByStatus(claims.map((c) => effectiveStatus(c, sources)));
  const pill = DOC_STATUS[status] ?? DOC_STATUS.draft!;
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-lg font-semibold tracking-tight">
          {title}
        </h1>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            pill.className,
          )}
        >
          {pill.label}
        </span>
      </div>
      <p
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
        aria-label="Claim summary"
      >
        <span className="tabular-nums text-foreground">
          {claims.length} {claims.length === 1 ? "claim" : "claims"}
        </span>
        {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <span key={s} className="inline-flex items-center gap-1 tabular-nums">
            <StatusIcon status={s} className="size-3.5" />
            {counts[s]} {STATUS_LABEL[s].toLowerCase()}
          </span>
        ))}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <VerifyAllButton documentId={documentId} />
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenEdits}
          className="tabular-nums"
        >
          Pending
          <span
            className={cn(
              "rounded-full px-1.5 text-xs",
              pendingCount
                ? "bg-[hsl(var(--g-insert-bg))] text-[hsl(var(--g-insert))]"
                : "bg-muted",
            )}
          >
            {pendingCount}
          </span>
        </Button>
        {status === "published" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={reopen.isPending}
            onClick={() => reopen.mutate({ documentId, event: "reopen" })}
            title="Start a new draft revision"
          >
            <IconLockOpen className="size-4" aria-hidden />
            Reopen
          </Button>
        ) : (
          <Button size="sm" onClick={onPublish}>
            <IconSend className="size-4" aria-hidden />
            Publish
          </Button>
        )}
        <AgentToggleButton />
      </div>
    </header>
  );
}
