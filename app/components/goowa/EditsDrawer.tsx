import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconCheck,
  IconChevronDown,
  IconGitBranch,
  IconX,
} from "@tabler/icons-react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Activity, ChangeSet, Edit } from "@/lib/goowa";
import { scrollBehavior, errorText } from "@/lib/goowa";
import { cn } from "@/lib/utils";

import { ActivityFeed } from "./ActivityFeed";
import { ActorBadge } from "./ActorBadge";

type Props = {
  edits: Edit[];
  changeSets: ChangeSet[];
  activity: Activity[];
  placedIds: Set<string>; // edits that still match the body
  labelOf: (claimId: string) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusedEditId: string | null;
  onFocusEdit: (editId: string) => void;
};

export function EditsDrawer({
  edits,
  changeSets,
  activity,
  placedIds,
  labelOf,
  open,
  onOpenChange,
  focusedEditId,
  onFocusEdit,
}: Props) {
  const rows = useRef(new Map<string, HTMLElement>());
  const decide = useActionMutation("decide-edit");
  const [bulk, setBulk] = useState<string | null>(null);
  const [tab, setTab] = useState<"edits" | "activity">("edits");
  const agentBlocked = activity.some(
    (a) =>
      a.kind === "publish_blocked" &&
      Date.now() - new Date(a.createdAt).getTime() < 30 * 60_000,
  );

  // Proposals from one propagation are grouped under their change set.
  const groups = useMemo(() => {
    const out: { id: string | null; summary: string | null; edits: Edit[] }[] =
      [];
    for (const edit of edits) {
      const id = edit.changeSetId ?? null;
      let group = out.find((g) => g.id === id);
      if (!group) {
        group = {
          id,
          summary: id
            ? (changeSets.find((c) => c.id === id)?.summary ??
              "Related changes")
            : null,
          edits: [],
        };
        out.push(group);
      }
      group.edits.push(edit);
    }
    // Change sets first, newest proposals inside each.
    return out.sort((a, b) => Number(b.id !== null) - Number(a.id !== null));
  }, [edits, changeSets]);

  async function decideAll(
    list: Edit[],
    decision: "accept" | "reject",
    groupId: string | null,
  ) {
    setBulk(groupId ?? "loose");
    try {
      // One at a time: each accept re-maps spans before the next applies.
      for (const edit of list)
        await decide.mutateAsync({ editId: edit.id, decision });
    } finally {
      setBulk(null);
    }
  }

  useEffect(() => {
    if (focusedEditId && open) {
      rows.current
        .get(focusedEditId)
        ?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
    }
  }, [focusedEditId, open]);

  return (
    <section
      aria-label="Pending edits"
      className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="flex items-center gap-1 px-2 md:px-4" role="tablist">
        {(["edits", "activity"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={open && tab === t}
            data-drawer-tab={t}
            onClick={() => {
              if (open && tab === t) onOpenChange(false);
              else {
                setTab(t);
                onOpenChange(true);
              }
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              open && tab === t ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {t === "edits" ? "Pending edits" : "Activity"}
            {t === "edits" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  edits.length
                    ? "bg-[hsl(var(--g-insert-bg))] text-[hsl(var(--g-insert))]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {edits.length}
              </span>
            ) : (
              agentBlocked && (
                <span
                  data-status="unsupported"
                  className="size-2 rounded-full bg-[hsl(var(--tone))]"
                  aria-label="Agent attempt blocked"
                />
              )
            )}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
          data-drawer-toggle
          onClick={() => onOpenChange(!open)}
          className="ml-auto rounded-md p-2 hover:bg-accent/60"
        >
          <IconChevronDown
            aria-hidden
            className={cn(
              "size-4 transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      {open && tab === "activity" && (
        <div className="max-h-[38vh] overflow-y-auto px-4 pb-4 md:px-6">
          <ActivityFeed activity={activity} />
        </div>
      )}
      {open && tab === "edits" && (
        <div className="max-h-[38vh] overflow-y-auto px-4 pb-4 md:px-6">
          {edits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No pending edits. Select text in the document to flag it or ask
              the agent for a fix.
            </p>
          ) : (
            <div className="grid gap-4">
              {groups.map((group) => (
                <section
                  key={group.id ?? "loose"}
                  aria-label={group.summary ?? "Other edits"}
                >
                  {group.summary && (
                    <header className="mb-2 flex flex-wrap items-center gap-2">
                      <IconGitBranch
                        className="size-4 text-[hsl(var(--g-weak))]"
                        aria-hidden
                      />
                      <p className="text-sm font-medium">{group.summary}</p>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={bulk !== null}
                          onClick={() =>
                            decideAll(group.edits, "reject", group.id)
                          }
                        >
                          Reject all
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={
                            bulk !== null ||
                            group.edits.some((e) => !placedIds.has(e.id))
                          }
                          onClick={() =>
                            decideAll(group.edits, "accept", group.id)
                          }
                        >
                          {bulk === group.id
                            ? "Applying…"
                            : `Accept all ${group.edits.length}`}
                        </Button>
                      </div>
                    </header>
                  )}
                  <ul className="grid gap-2">
                    {group.edits.map((edit) => (
                      <EditRow
                        key={edit.id}
                        ref={(el) => {
                          if (el) rows.current.set(edit.id, el);
                          else rows.current.delete(edit.id);
                        }}
                        edit={edit}
                        stale={!placedIds.has(edit.id)}
                        target={
                          edit.targetType === "claim"
                            ? `Claim ${labelOf(edit.targetId)}`
                            : "Document text"
                        }
                        focused={edit.id === focusedEditId}
                        busy={
                          bulk !== null ||
                          (decide.isPending &&
                            decide.variables?.editId === edit.id)
                        }
                        onFocus={() => onFocusEdit(edit.id)}
                        onDecide={(decision) =>
                          decide.mutate({ editId: edit.id, decision })
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {decide.error && (
            <p className="mt-2 text-sm text-destructive">
              {errorText(decide.error)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const EditRow = forwardRef<
  HTMLLIElement,
  {
    edit: Edit;
    stale: boolean;
    target: string;
    focused: boolean;
    busy: boolean;
    onFocus: () => void;
    onDecide: (decision: "accept" | "reject") => void;
  }
>(function EditRow(
  { edit, stale, target, focused, busy, onFocus, onDecide },
  ref,
) {
  return (
    <li
      ref={ref}
      onClick={onFocus}
      className={cn(
        "rounded-lg border bg-card p-3 transition-shadow",
        focused && "shadow-[0_0_0_3px_hsl(var(--g-insert)/0.2)]",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{target}</span>
        <ActorBadge actor={edit.proposedBy} verb="Proposed" />
        {stale && (
          <span className="rounded bg-muted px-1.5 py-0.5">
            Text changed since proposed
          </span>
        )}
      </div>
      <p className="font-serif text-base leading-relaxed">
        <del className="g-del">{edit.before}</del>{" "}
        {edit.after ? (
          <ins className="g-ins">{edit.after}</ins>
        ) : (
          <span className="text-xs text-muted-foreground">(delete)</span>
        )}
      </p>
      {edit.reason && (
        <p className="mt-2 text-sm text-muted-foreground">{edit.reason}</p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onDecide("reject");
          }}
        >
          <IconX className="size-4" aria-hidden />
          Reject
        </Button>
        <Button
          size="sm"
          disabled={busy || stale}
          title={stale ? "Reject this and propose again" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onDecide("accept");
          }}
        >
          <IconCheck className="size-4" aria-hidden />
          Accept
        </Button>
      </div>
    </li>
  );
});
