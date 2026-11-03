import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";

export function meta() {
  return [{ title: "Goowa - Debug" }];
}

// Phase 1 debug view. Phase 2 replaces it with the real editor.
export default function DebugDocumentRoute() {
  const { documentId = "" } = useParams();
  const state = useActionQuery(
    "get-document-state",
    { documentId },
    { enabled: Boolean(documentId) },
  );
  const decide = useActionMutation("decide-edit");

  if (state.isLoading) return <main className="p-6">Loading…</main>;
  if (state.error)
    return <main className="p-6 text-destructive">{state.error.message}</main>;
  if (!state.data) return null;

  const { document, sources, claims, pendingEdits } = state.data;
  const label = (id: string) => {
    const i = claims.findIndex((c) => c.id === id);
    return i >= 0 ? `#${i + 1}` : id.slice(0, 8);
  };

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-8 p-6 text-sm">
      <header>
        <h1 className="text-2xl font-semibold">{document.title}</h1>
        <p className="text-muted-foreground">
          {document.topic} · status: {document.status} · id: {document.id}
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-semibold">
          Pending edits ({pendingEdits.length})
        </h2>
        {decide.error && (
          <p className="mb-2 text-destructive">{decide.error.message}</p>
        )}
        <ul className="grid gap-3">
          {pendingEdits.map((edit) => (
            <li key={edit.id} className="rounded border p-3">
              <p>
                {edit.targetType}{" "}
                {edit.targetType === "claim" && label(edit.targetId)} ·
                proposedBy: <b>{edit.proposedBy}</b>
              </p>
              <p className="mt-1">
                <del className="text-destructive">{edit.before}</del>
                <br />
                <ins className="text-green-700">{edit.after}</ins>
              </p>
              <p className="mt-1 text-muted-foreground">{edit.reason}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ editId: edit.id, decision: "accept" })
                  }
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ editId: edit.id, decision: "reject" })
                  }
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Claims ({claims.length})</h2>
        <ol className="grid gap-2">
          {claims.map((claim, i) => {
            const spanOk =
              document.body.slice(claim.spanStart, claim.spanEnd) ===
              claim.text;
            return (
              <li key={claim.id} className="rounded border p-3">
                <p>
                  <b>#{i + 1}</b> [{claim.status}, conf {claim.confidence}] “
                  {claim.text}”
                </p>
                <p className="text-muted-foreground">
                  span {claim.spanStart}–{claim.spanEnd}{" "}
                  {spanOk ? "✓" : "✗ mismatch"} · dependsOn:{" "}
                  {claim.dependsOn.map(label).join(", ") || "—"} · sources:{" "}
                  {claim.sourceIds.length} · createdBy: {claim.createdBy} ·
                  updatedBy: {claim.updatedBy}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Sources ({sources.length})</h2>
        <ul className="grid gap-1">
          {sources.map((s) => (
            <li key={s.id}>
              {s.title || s.url} — {s.url}{" "}
              {s.flags.length > 0 && <b>[{s.flags.join(", ")}]</b>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Body</h2>
        <pre className="whitespace-pre-wrap rounded border p-3">
          {document.body}
        </pre>
      </section>
    </main>
  );
}
