import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DocumentState } from "@/lib/goowa";
import { scrollBehavior } from "@/lib/goowa";
import { selectionOffsets, type BodySelection } from "@/lib/selection";

import { proposalRanges } from "../../../shared/proposals";
import { overlapping } from "../../../shared/segments";
import { ClaimPanel } from "./ClaimPanel";
import { DocumentView, type ProposalMark } from "./DocumentView";
import { EditsDrawer } from "./EditsDrawer";
import { NeedsClaims, NeedsDraft, NoSources } from "./EmptyStates";
import { SelectionPopover } from "./SelectionPopover";
import { TopBar } from "./TopBar";

type Popover = { selection: BodySelection; top: number; left: number };

export function Editor({ state }: { state: DocumentState }) {
  const { document: doc, claims, sources, pendingEdits } = state;
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);
  const [hotClaimIds, setHotClaimIds] = useState<string[]>([]);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(pendingEdits.length > 0);
  const [focusedEditId, setFocusedEditId] = useState<string | null>(null);
  const docPane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${doc.title} · Goowa`;
  }, [doc.title]);

  // A proposal that arrives live (e.g. from the agent) opens the drawer on it.
  const seenEdits = useRef(new Set(pendingEdits.map((e) => e.id)));
  useEffect(() => {
    const fresh = pendingEdits.filter((e) => !seenEdits.current.has(e.id));
    for (const e of pendingEdits) seenEdits.current.add(e.id);
    if (fresh.length > 0) {
      setDrawerOpen(true);
      setFocusedEditId(fresh[fresh.length - 1]!.id);
    }
  }, [pendingEdits]);

  // Escape clears the active claim (the popover handles its own Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveClaimId(null);
        setHotClaimIds([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const bodyRef = useRef<HTMLDivElement>(null);

  const proposals = useMemo<ProposalMark[]>(() => {
    const ranges = proposalRanges(doc.body, pendingEdits, claims);
    return ranges.map((r) => ({
      ...r,
      edit: pendingEdits.find((e) => e.id === r.id)!,
    }));
  }, [doc.body, pendingEdits, claims]);
  const placedIds = useMemo(
    () => new Set(proposals.map((p) => p.id)),
    [proposals],
  );
  const claimMarks = useMemo(
    () => claims.map((c) => ({ id: c.id, start: c.spanStart, end: c.spanEnd })),
    [claims],
  );
  const labelOf = useCallback(
    (id: string) => {
      const i = claims.findIndex((c) => c.id === id);
      return i < 0 ? "removed" : `#${i + 1}`;
    },
    [claims],
  );

  /** Card → span: scroll the claim's first segment into view and pulse it. */
  const pulseSpan = useCallback((claimId: string) => {
    const root = bodyRef.current;
    if (!root) return;
    const segs = Array.from(
      root.querySelectorAll<HTMLElement>(
        `[data-claim-ids~="${CSS.escape(claimId)}"]`,
      ),
    );
    segs[0]?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    for (const el of segs) {
      el.classList.remove("g-pulse");
      void el.offsetWidth; // restart the animation
      el.classList.add("g-pulse");
      el.addEventListener(
        "animationend",
        () => el.classList.remove("g-pulse"),
        {
          once: true,
        },
      );
    }
  }, []);

  const selectFromCard = useCallback(
    (claimId: string) => {
      setActiveClaimId(claimId);
      pulseSpan(claimId);
    },
    [pulseSpan],
  );

  const selectFromSpan = useCallback((claimId: string) => {
    // A click that ends a text selection should open the popover instead.
    if (window.getSelection()?.isCollapsed === false) return;
    setActiveClaimId(claimId);
  }, []);

  const focusEdit = useCallback((editId: string) => {
    setDrawerOpen(true);
    setFocusedEditId(editId);
  }, []);

  function onSelectionEnd() {
    const root = bodyRef.current;
    const pane = docPane.current;
    if (!root || !pane) return;
    const selection = selectionOffsets(root, doc.body);
    if (!selection) return;
    const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
    const box = pane.getBoundingClientRect();
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - box.left, 180),
      box.width - 180,
    );
    setPopover({
      selection,
      top: rect.bottom - box.top + pane.scrollTop + 8,
      left,
    });
  }

  const hasBody = doc.body.trim().length > 0;
  const overlappingClaims = popover
    ? overlapping(
        claimMarks,
        popover.selection.start,
        popover.selection.end,
      ).map((id) => claims.find((c) => c.id === id)!)
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[hsl(var(--g-paper))]">
      <TopBar
        title={doc.title}
        status={doc.status}
        claims={claims}
        sources={sources}
        pendingCount={pendingEdits.length}
        onOpenEdits={() => setDrawerOpen((open) => !open)}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:overflow-hidden">
        <div
          ref={docPane}
          className="relative min-w-0 md:overflow-y-auto"
          onMouseDown={(e) => {
            if (!(e.target as Element).closest("[data-goowa-popover]")) {
              setPopover(null);
            }
          }}
        >
          <div className="mx-auto max-w-[68ch] px-5 py-8 md:px-10 md:py-12">
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
              {doc.topic}
            </p>
            {sources.length === 0 ? (
              <NoSources documentId={doc.id} />
            ) : !hasBody ? (
              <NeedsDraft documentId={doc.id} sources={sources} />
            ) : (
              <div
                ref={bodyRef}
                onMouseUp={onSelectionEnd}
                onKeyUp={(e) => e.shiftKey && onSelectionEnd()}
              >
                <DocumentView
                  body={doc.body}
                  claims={claims}
                  sources={sources}
                  proposals={proposals}
                  activeClaimId={activeClaimId}
                  hotClaimIds={hotClaimIds}
                  onClaimClick={selectFromSpan}
                  onProposalClick={focusEdit}
                />
              </div>
            )}
          </div>
          {popover && (
            <SelectionPopover
              documentId={doc.id}
              selection={popover.selection}
              claims={overlappingClaims}
              anchor={{ top: popover.top, left: popover.left }}
              onClose={() => {
                setPopover(null);
                window.getSelection()?.removeAllRanges();
              }}
            />
          )}
        </div>
        <aside className="min-w-0 border-t bg-background/60 px-4 py-5 md:overflow-y-auto md:border-l md:border-t-0 md:px-5">
          {hasBody && claims.length === 0 ? (
            <NeedsClaims documentId={doc.id} />
          ) : (
            <ClaimPanel
              claims={claims}
              sources={sources}
              activeClaimId={activeClaimId}
              hotClaimIds={hotClaimIds}
              onSelect={selectFromCard}
              onHoverClaims={setHotClaimIds}
            />
          )}
        </aside>
      </div>
      <p className="sr-only" aria-live="polite">
        {pendingEdits.length === 1
          ? "1 pending edit"
          : `${pendingEdits.length} pending edits`}
      </p>
      <EditsDrawer
        edits={pendingEdits}
        placedIds={placedIds}
        labelOf={labelOf}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        focusedEditId={focusedEditId}
        onFocusEdit={setFocusedEditId}
      />
    </div>
  );
}
