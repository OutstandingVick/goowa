import { Fragment, memo, useMemo, type ReactNode } from "react";

import {
  STATUS_LABEL,
  effectiveStatus,
  type Claim,
  type Edit,
  type Source,
} from "@/lib/goowa";

import type { Mark } from "../../../shared/segments";
import { parseBlocks, segmentRange } from "../../../shared/segments";

export type ProposalMark = Mark & { edit: Edit };

type Props = {
  body: string;
  claims: Claim[];
  sources: Source[];
  proposals: ProposalMark[];
  activeClaimId: string | null;
  hotClaimIds: string[];
  onClaimClick: (claimId: string) => void;
  onProposalClick: (editId: string) => void;
};

/**
 * Read view of the document body. Each text-bearing element carries
 * data-start/data-end body offsets (see selectionOffsets), so highlights and
 * selections are always in body coordinates.
 */
export const DocumentView = memo(function DocumentView({
  body,
  claims,
  sources,
  proposals,
  activeClaimId,
  hotClaimIds,
  onClaimClick,
  onProposalClick,
}: Props) {
  const blocks = useMemo(() => parseBlocks(body), [body]);
  const claimMarks = useMemo(
    () => claims.map((c) => ({ id: c.id, start: c.spanStart, end: c.spanEnd })),
    [claims],
  );
  const byId = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);
  const proposalEnds = useMemo(
    () => new Map(proposals.map((p) => [p.id, p])),
    [proposals],
  );

  return (
    <div className="g-prose" data-goowa-body>
      {blocks.map((block) => {
        const segments = segmentRange(
          body,
          block.contentStart,
          block.end,
          claimMarks,
          proposals,
        );
        const children: ReactNode[] = [];
        segments.forEach((seg, i) => {
          // The innermost (shortest) claim decides the colour of a segment.
          const claim = seg.claimIds
            .map((id) => byId.get(id)!)
            .sort(
              (a, b) => a.spanEnd - a.spanStart - (b.spanEnd - b.spanStart),
            )[0];
          let node: ReactNode = (
            <span data-start={seg.start} data-end={seg.end}>
              {seg.text}
            </span>
          );
          if (claim) {
            const status = effectiveStatus(claim, sources);
            node = (
              <span
                className="g-claim"
                data-start={seg.start}
                data-end={seg.end}
                data-claim-ids={seg.claimIds.join(" ")}
                data-status={status}
                data-overlap={seg.claimIds.length > 1 ? "true" : undefined}
                data-active={
                  seg.claimIds.includes(activeClaimId ?? "")
                    ? "true"
                    : undefined
                }
                data-hot={
                  seg.claimIds.some((id) => hotClaimIds.includes(id))
                    ? "true"
                    : undefined
                }
                title={`${STATUS_LABEL[status]} claim`}
                onClick={() => onClaimClick(claim.id)}
              >
                {seg.text}
              </span>
            );
          }
          if (seg.proposalIds.length > 0) {
            node = (
              <del
                className="g-del"
                data-edit-ids={seg.proposalIds.join(" ")}
                onClick={() => onProposalClick(seg.proposalIds[0]!)}
              >
                {node}
              </del>
            );
          }
          children.push(<Fragment key={seg.start}>{node}</Fragment>);
          // After the last segment of a proposal's range, show its new text.
          for (const id of seg.proposalIds) {
            const p = proposalEnds.get(id)!;
            if (p.end === seg.end && p.edit.after) {
              children.push(
                <ins
                  key={`ins-${id}-${i}`}
                  className="g-ins"
                  data-ignore
                  data-anchor={seg.end}
                  data-edit-ids={id}
                  title="Proposed text"
                  onClick={() => onProposalClick(id)}
                >
                  {p.edit.after}
                </ins>,
              );
            }
          }
        });

        if (block.kind === "heading") {
          const Tag = block.level <= 2 ? "h2" : "h3";
          return (
            <Tag
              key={block.start}
              className={
                Tag === "h2"
                  ? "mb-3 mt-10 text-xl font-semibold first:mt-0"
                  : "mb-2 mt-8 text-lg font-semibold"
              }
            >
              {children}
            </Tag>
          );
        }
        return (
          <p key={block.start} className="mb-5 whitespace-pre-wrap">
            {children}
          </p>
        );
      })}
    </div>
  );
});
