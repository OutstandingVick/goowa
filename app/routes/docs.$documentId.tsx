import { useActionQuery, useDbSync } from "@agent-native/core/client/hooks";
import { acquireCollabPollBoost } from "@agent-native/core/client/use-db-sync";
import { IconLoader2 } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router";

import { Editor } from "@/components/goowa/Editor";
import { errorText, recheckPending, type Claim } from "@/lib/goowa";

export function meta() {
  return [{ title: "Goowa" }];
}

export default function DocumentRoute() {
  const { documentId = "" } = useParams();
  const queryClient = useQueryClient();
  // Re-checks after a fix run in the background; poll briefly until the new
  // verdicts land (stops after 60 s so a failed re-check cannot poll forever).
  const pendingSince = useRef<number | null>(null);
  const state = useActionQuery(
    "get-document-state",
    { documentId },
    {
      enabled: Boolean(documentId),
      refetchInterval: (query) => {
        const claims = (query.state.data as { claims?: Claim[] } | undefined)
          ?.claims;
        if (!claims?.some(recheckPending)) {
          pendingSince.current = null;
          return false;
        }
        pendingSince.current ??= Date.now();
        return Date.now() - pendingSince.current < 60_000 ? 1500 : false;
      },
    },
  );

  // The in-app agent's tool calls already refresh this query. Agents over MCP
  // and other people edit the same document without this tab acting, so the
  // page opts into the framework's realtime sync and keeps its fast poll on.
  useDbSync({
    queryClient,
    realtime: {
      reason: "agents (in-app and over MCP) propose edits to this document",
    },
  });
  useEffect(() => acquireCollabPollBoost(), []);

  if (state.isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <IconLoader2 className="size-4 animate-spin" aria-hidden />
        Loading document…
      </div>
    );
  }
  if (state.error || !state.data) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-24 text-center">
        <h1 className="text-base font-semibold">Can't open this document</h1>
        <p className="text-sm text-muted-foreground">
          {(state.error ? errorText(state.error) : null) ??
            "It may have been deleted, or it isn't shared with you."}
        </p>
        <Link to="/docs" className="text-sm underline">
          Back to documents
        </Link>
      </div>
    );
  }
  return <Editor state={state.data} />;
}
