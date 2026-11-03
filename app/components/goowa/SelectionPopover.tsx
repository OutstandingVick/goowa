import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useActionMutation } from "@agent-native/core/client/hooks";
import { IconFlag, IconSparkles, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Claim } from "@/lib/goowa";
import type { BodySelection } from "@/lib/selection";

type Props = {
  documentId: string;
  selection: BodySelection;
  claims: Claim[]; // claims the selection overlaps
  anchor: { top: number; left: number }; // relative to the positioned parent
  onClose: () => void;
};

/** Model-visible context for "Ask agent to fix"; stripped from the chat UI. */
export function fixContext(
  documentId: string,
  selection: BodySelection,
  claims: Claim[],
  note: string,
) {
  return [
    "The user selected text in the Goowa document and asked you to fix it.",
    "Respond by calling propose-edit (targetType document_body, targetId = documentId, before = selection.text exactly, spanStart = selection.start). Do not answer with rewritten text in chat. Do not call get-document-state unless you need the sources to write the fix.",
    JSON.stringify(
      {
        documentId,
        selection: {
          start: selection.start,
          end: selection.end,
          text: selection.text,
        },
        overlappingClaims: claims.map((c) => ({
          id: c.id,
          text: c.text,
          status: c.status,
          sourceIds: c.sourceIds,
        })),
        userNote: note || null,
      },
      null,
      2,
    ),
  ].join("\n\n");
}

export function SelectionPopover({
  documentId,
  selection,
  claims,
  anchor,
  onClose,
}: Props) {
  const [mode, setMode] = useState<"menu" | "flag" | "ask">("menu");
  const [note, setNote] = useState("");
  const [replacement, setReplacement] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const propose = useActionMutation("propose-edit");
  const update = useActionMutation("update-claim");
  const add = useActionMutation("add-claim");
  const pending = propose.isPending || update.isPending || add.isPending;
  const error = propose.error ?? update.error ?? add.error;

  useEffect(() => {
    if (mode !== "menu") inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function flag() {
    if (replacement.trim()) {
      await propose.mutateAsync({
        targetType: "document_body",
        targetId: documentId,
        before: selection.text,
        spanStart: selection.start,
        after: replacement,
        reason: note || "Flagged as wrong",
      });
    } else if (claims.length > 0) {
      for (const c of claims) {
        await update.mutateAsync({ claimId: c.id, status: "unsupported" });
      }
    } else {
      await add.mutateAsync({
        documentId,
        quote: selection.text,
        spanStart: selection.start,
        status: "unsupported",
        sourceIds: [],
        dependsOn: [],
      });
    }
    onClose();
  }

  function ask() {
    sendToAgentChat({
      message: note.trim()
        ? `Fix this: ${note.trim()}`
        : "Fix the selected text.",
      context: fixContext(documentId, selection, claims, note.trim()),
      submit: true,
      openSidebar: true,
    });
    onClose();
  }

  const preview =
    selection.text.length > 80
      ? `${selection.text.slice(0, 77)}…`
      : selection.text;

  return (
    <div
      role="dialog"
      aria-label="Correct selection"
      data-goowa-popover
      onMouseDown={(e) => e.stopPropagation()}
      style={{ top: anchor.top, left: anchor.left }}
      className="absolute z-30 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
    >
      {mode === "menu" ? (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 justify-start"
            onClick={() => setMode("flag")}
          >
            <IconFlag className="size-4" aria-hidden />
            Flag as wrong
          </Button>
          <Button
            size="sm"
            className="flex-1 justify-start"
            onClick={() => setMode("ask")}
          >
            <IconSparkles className="size-4" aria-hidden />
            Ask agent to fix
          </Button>
        </div>
      ) : (
        <form
          className="grid gap-2 p-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "flag") void flag();
            else ask();
          }}
        >
          <div className="flex items-start gap-2">
            <p className="line-clamp-2 flex-1 font-serif text-sm italic text-muted-foreground">
              “{preview}”
            </p>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent"
            >
              <IconX className="size-4" />
            </button>
          </div>
          <textarea
            ref={inputRef}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              mode === "flag"
                ? "What's wrong? (optional)"
                : "What should change? (optional)"
            }
            className="w-full resize-none rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {mode === "flag" && (
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Suggested replacement (optional)"
              className="w-full rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          <p className="text-xs text-muted-foreground">
            {mode === "ask"
              ? "The agent gets this exact passage and the claims it touches, and answers with a proposed edit for you to review."
              : replacement.trim()
                ? "Creates a proposed edit for review."
                : claims.length > 0
                  ? `Marks ${claims.length === 1 ? "this claim" : `${claims.length} claims`} unsupported.`
                  : "Adds this passage as an unsupported claim."}
          </p>
          {error && <p className="text-xs text-destructive">{error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setMode("menu")}
            >
              Back
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {mode === "ask" ? "Send to agent" : pending ? "Saving…" : "Flag"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
