import { useActionMutation } from "@agent-native/core/client/hooks";
import { IconChecks, IconLoader2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Run = { title: string; percent?: number | null; step?: string | null };

/**
 * Runs verify-document and shows its progress from the framework's progress
 * runs (the action updates a run titled "Verify document <id>").
 */
export function VerifyAllButton({ documentId }: { documentId: string }) {
  const verify = useActionMutation("verify-document");
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    if (!verify.isPending) {
      setRun(null);
      return;
    }
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch("/_agent-native/runs?active=true", {
          headers: { "X-Agent-Native-Frontend": "1" },
        });
        const body = (await res.json()) as { runs?: Run[] } | Run[];
        const runs = Array.isArray(body) ? body : (body.runs ?? []);
        const mine = runs.find(
          (r) => r.title === `Verify document ${documentId}`,
        );
        if (!stop && mine) setRun(mine);
      } catch {
        // Progress is best-effort; the button still shows it is working.
      }
    };
    void tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [verify.isPending, documentId]);

  const pct = Math.round(run?.percent ?? 0);
  const result = verify.data;
  return (
    <div className="flex items-center gap-2">
      {verify.isPending ? (
        <span
          className="hidden items-center gap-2 text-xs tabular-nums text-muted-foreground sm:flex"
          aria-live="polite"
        >
          <span
            className="relative h-1.5 w-20 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Verification progress"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/70 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </span>
          {run?.step ?? "Starting…"}
        </span>
      ) : result ? (
        <span
          className="hidden text-xs tabular-nums text-muted-foreground sm:inline"
          aria-live="polite"
        >
          {result.verified} verified · {result.skipped} unchanged
          {result.failed ? ` · ${result.failed} failed` : ""}
        </span>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={verify.isPending}
        onClick={() => verify.mutate({ documentId, force: false })}
        title="Verify claims that changed since their last check"
      >
        {verify.isPending ? (
          <IconLoader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <IconChecks className="size-4" aria-hidden />
        )}
        Verify all
      </Button>
    </div>
  );
}
