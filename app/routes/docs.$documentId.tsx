import { useActionQuery, useDbSync } from "@agent-native/core/client/hooks";
import { acquireCollabPollBoost } from "@agent-native/core/client/use-db-sync";
import { IconLoader2 } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useParams } from "react-router";

import { Editor } from "@/components/goowa/Editor";

export function meta() {
  return [{ title: "Goowa" }];
}

export default function DocumentRoute() {
  const { documentId = "" } = useParams();
  const queryClient = useQueryClient();
  const state = useActionQuery(
    "get-document-state",
    { documentId },
    { enabled: Boolean(documentId) },
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
          {state.error?.message ??
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
