import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconCircleCheck,
  IconLoader2,
  IconRefresh,
  IconAlertTriangle,
  IconCircleX,
  IconWorldOff,
  type Icon,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/goowa";

const LABEL: Record<string, { text: string; status: string; Icon: Icon }> = {
  unchanged: {
    text: "Source unchanged",
    status: "supported",
    Icon: IconCircleCheck,
  },
  changed_still_supported: {
    text: "Source changed, still supports the claim",
    status: "weak",
    Icon: IconAlertTriangle,
  },
  changed_no_longer_supported: {
    text: "Source changed, no longer supports the claim",
    status: "unsupported",
    Icon: IconCircleX,
  },
  source_unreachable: {
    text: "Source could not be fetched",
    status: "unverified",
    Icon: IconWorldOff,
  },
};

export function LivePanel({
  documentId,
  onSelect,
}: {
  documentId: string;
  onSelect: (claimId: string) => void;
}) {
  const recheck = useActionMutation("recheck-receipt-live");
  const data = recheck.data;
  return (
    <section
      aria-label="Re-check against live sources"
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Re-check against live sources</h2>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={recheck.isPending}
          onClick={() => recheck.mutate({ documentId })}
        >
          {recheck.isPending ? (
            <IconLoader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <IconRefresh className="size-4" aria-hidden />
          )}
          Re-check
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Fetches each source again and compares it with what was verified at
        publish. The receipt itself never changes.
      </p>
      {recheck.error && (
        <p className="mt-2 text-sm text-destructive">
          {errorText(recheck.error)}
        </p>
      )}
      {data && (
        <ul className="mt-3 grid gap-1.5">
          {data.results.map((r) => {
            const l = LABEL[r.status] ?? LABEL.source_unreachable!;
            return (
              <li key={r.claimId}>
                <button
                  type="button"
                  onClick={() => onSelect(r.claimId)}
                  data-status={l.status}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <l.Icon
                    className="mt-0.5 size-4 shrink-0 text-[hsl(var(--tone))]"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">
                      Claim #{r.index}: {l.text}
                    </span>
                    {r.status !== "unchanged" && (
                      <span className="block text-xs text-muted-foreground">
                        {r.detail}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          <li className="px-2 text-[11px] text-muted-foreground">
            Checked {new Date(data.checkedAt).toLocaleString()}
          </li>
        </ul>
      )}
    </section>
  );
}
