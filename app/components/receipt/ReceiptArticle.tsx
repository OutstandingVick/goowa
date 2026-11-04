import { useMemo } from "react";

import { asStatus, STATUS_LABEL } from "@/lib/goowa";

import type { Receipt } from "../../../shared/receipt";
import { parseBlocks, segmentRange } from "../../../shared/segments";

/** The published article, read-only, with claims highlighted by status. */
export function ReceiptArticle({
  receipt,
  selected,
  onSelect,
}: {
  receipt: Receipt;
  selected: string | null;
  onSelect: (claimId: string) => void;
}) {
  const body = receipt.document.body;
  const blocks = useMemo(() => parseBlocks(body), [body]);
  const marks = useMemo(
    () =>
      receipt.claims.map((c) => ({
        id: c.id,
        start: c.span.start,
        end: c.span.end,
      })),
    [receipt.claims],
  );
  const byId = useMemo(
    () => new Map(receipt.claims.map((c) => [c.id, c])),
    [receipt.claims],
  );

  return (
    <div className="g-prose">
      {blocks.map((block) => {
        const children = segmentRange(
          body,
          block.contentStart,
          block.end,
          marks,
        ).map((seg) => {
          const claim = seg.claimIds.map((id) => byId.get(id)!)[0];
          if (!claim) return <span key={seg.start}>{seg.text}</span>;
          const status = asStatus(claim.status);
          return (
            <button
              key={seg.start}
              type="button"
              className="g-claim text-left [font:inherit]"
              data-status={status}
              data-active={claim.id === selected ? "true" : undefined}
              aria-label={`Claim ${claim.index}, ${STATUS_LABEL[status]}. Show evidence.`}
              onClick={() => onSelect(claim.id)}
            >
              {seg.text}
            </button>
          );
        });
        return block.kind === "heading" ? (
          <h2
            key={block.start}
            className="mb-3 mt-10 text-xl font-semibold first:mt-0"
          >
            {children}
          </h2>
        ) : (
          <p key={block.start} className="mb-5 whitespace-pre-wrap">
            {children}
          </p>
        );
      })}
    </div>
  );
}
