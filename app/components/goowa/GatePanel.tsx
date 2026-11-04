import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconLoader2,
  IconLock,
  IconSend,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { blockerKey, type Blocker } from "../../../shared/gate";

type Props = {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectClaim: (claimId: string) => void;
};

/**
 * The publish flow: runs request-publish (verify + gate), lists blockers and
 * warnings, collects a reason per overridable blocker, and publishes as the
 * human. The server re-checks everything; this panel only gathers input.
 */
export function GatePanel({
  documentId,
  open,
  onOpenChange,
  onSelectClaim,
}: Props) {
  const check = useActionMutation("request-publish");
  const publish = useActionMutation("publish");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setReasons({});
      publish.reset();
      check.mutate({ documentId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  const gate = check.data;
  const blockers = (gate?.blockers ?? []) as Blocker[];
  const hard = blockers.filter((b) => !b.overridable);
  const soft = blockers.filter((b) => b.overridable);
  const allReasoned = soft.every(
    (b) => (reasons[blockerKey(b)] ?? "").trim().length > 0,
  );
  const ready = Boolean(gate) && hard.length === 0 && allReasoned;

  function submit() {
    publish.mutate(
      {
        documentId,
        overrides: soft.map((b) => ({
          ...(b.claimId ? { claimId: b.claimId } : {}),
          ...(b.sourceId ? { sourceId: b.sourceId } : {}),
          kind: b.kind,
          reason: (reasons[blockerKey(b)] ?? "").trim(),
        })),
      },
      {},
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle>Publish</SheetTitle>
          <SheetDescription>
            Goowa checks every claim before a human publishes. The agent can
            prepare, but only you can publish.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {check.isPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              Verifying changed claims and checking the gate…
            </p>
          )}
          {check.error && (
            <p className="text-sm text-destructive">{check.error.message}</p>
          )}

          {gate && blockers.length === 0 && (
            <p
              data-status="supported"
              className="flex items-center gap-2 rounded-md bg-[hsl(var(--tone-bg))] p-3 text-sm font-medium text-[hsl(var(--tone))]"
            >
              <IconCircleCheck className="size-4" aria-hidden />
              No blockers. Ready to publish.
            </p>
          )}

          {hard.length > 0 && (
            <section className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Must be resolved ({hard.length})
              </h3>
              <ul className="grid gap-2">
                {hard.map((b) => (
                  <BlockerRow
                    key={blockerKey(b)}
                    blocker={b}
                    onSelectClaim={onSelectClaim}
                    onClose={() => onOpenChange(false)}
                  >
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <IconLock className="size-3" aria-hidden />
                      Can't be overridden.
                    </p>
                  </BlockerRow>
                ))}
              </ul>
            </section>
          )}

          {soft.length > 0 && (
            <section className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resolve or override with a reason ({soft.length})
              </h3>
              <ul className="grid gap-2">
                {soft.map((b) => (
                  <BlockerRow
                    key={blockerKey(b)}
                    blocker={b}
                    onSelectClaim={onSelectClaim}
                    onClose={() => onOpenChange(false)}
                  >
                    <input
                      value={reasons[blockerKey(b)] ?? ""}
                      onChange={(e) =>
                        setReasons((r) => ({
                          ...r,
                          [blockerKey(b)]: e.target.value,
                        }))
                      }
                      placeholder="Reason for overriding (required to publish)"
                      aria-label="Override reason"
                      maxLength={500}
                      className="mt-2 w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </BlockerRow>
                ))}
              </ul>
            </section>
          )}

          {gate && gate.warnings.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Warnings ({gate.warnings.length})
              </h3>
              <ul className="grid gap-1.5">
                {gate.warnings.map((w, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectClaim(w.claimId);
                        onOpenChange(false);
                      }}
                      data-status="weak"
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <IconAlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-[hsl(var(--tone))]"
                        aria-hidden
                      />
                      {w.message}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {publish.error && (
            <p className="mt-4 text-sm text-destructive">
              {publish.error.message}
            </p>
          )}
          {publish.isSuccess && (
            <p
              data-status="supported"
              className="mt-4 text-sm font-medium text-[hsl(var(--tone))]"
            >
              Published revision {publish.data.revision}.{" "}
              <a
                href={publish.data.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                View the Claim Receipt
              </a>
            </p>
          )}
        </div>

        <footer className="border-t p-4">
          <Button
            className={cn(
              "w-full",
              ready &&
                "bg-[hsl(var(--g-supported))] text-white hover:bg-[hsl(var(--g-supported)/0.9)]",
            )}
            disabled={!ready || publish.isPending || publish.isSuccess}
            onClick={submit}
          >
            {publish.isPending ? (
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <IconSend className="size-4" aria-hidden />
            )}
            {soft.length > 0 && hard.length === 0
              ? `Publish with ${soft.length} override${soft.length === 1 ? "" : "s"}`
              : "Publish"}
          </Button>
          {gate && hard.length > 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Resolve the locked blockers first.
            </p>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function BlockerRow({
  blocker,
  onSelectClaim,
  onClose,
  children,
}: {
  blocker: Blocker;
  onSelectClaim: (claimId: string) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <li data-status="unsupported" className="rounded-md border p-3">
      <button
        type="button"
        disabled={!blocker.claimId}
        onClick={() => {
          if (blocker.claimId) {
            onSelectClaim(blocker.claimId);
            onClose();
          }
        }}
        className="flex w-full items-start gap-2 text-left text-sm enabled:hover:underline"
      >
        <IconAlertTriangle
          className="mt-0.5 size-4 shrink-0 text-[hsl(var(--tone))]"
          aria-hidden
        />
        {blocker.message}
      </button>
      {children}
    </li>
  );
}
