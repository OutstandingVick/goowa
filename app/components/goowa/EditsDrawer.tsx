import { useActionMutation } from "@agent-native/core/client/hooks";
import { IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import { forwardRef, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { Edit } from "@/lib/goowa";
import { scrollBehavior } from "@/lib/goowa";
import { cn } from "@/lib/utils";

import { ActorBadge } from "./ActorBadge";

type Props = {
  edits: Edit[];
  placedIds: Set<string>; // edits that still match the body
  labelOf: (claimId: string) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusedEditId: string | null;
  onFocusEdit: (editId: string) => void;
};

export function EditsDrawer({
  edits,
  placedIds,
  labelOf,
  open,
  onOpenChange,
  focusedEditId,
  onFocusEdit,
}: Props) {
  const rows = useRef(new Map<string, HTMLElement>());
  const decide = useActionMutation("decide-edit");

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
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-6"
      >
        Pending edits
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
        <IconChevronDown
          aria-hidden
          className={cn(
            "ml-auto size-4 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="max-h-[38vh] overflow-y-auto px-4 pb-4 md:px-6">
          {edits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No pending edits. Select text in the document to flag it or ask
              the agent for a fix.
            </p>
          ) : (
            <ul className="grid gap-2">
              {edits.map((edit) => (
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
                    decide.isPending && decide.variables?.editId === edit.id
                  }
                  onFocus={() => onFocusEdit(edit.id)}
                  onDecide={(decision) =>
                    decide.mutate({ editId: edit.id, decision })
                  }
                />
              ))}
            </ul>
          )}
          {decide.error && (
            <p className="mt-2 text-sm text-destructive">
              {decide.error.message}
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
      <p className="font-serif text-[15px] leading-relaxed">
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
