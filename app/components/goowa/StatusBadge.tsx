import {
  IconCircleCheck,
  IconCircleDashed,
  IconCircleHalf2,
  IconCircleX,
  IconShieldLock,
  type Icon,
} from "@tabler/icons-react";

import { STATUS_LABEL, type ClaimStatus } from "@/lib/goowa";
import { cn } from "@/lib/utils";

export const STATUS_ICON: Record<ClaimStatus, Icon> = {
  supported: IconCircleCheck,
  weak: IconCircleHalf2,
  unsupported: IconCircleX,
  unverified: IconCircleDashed,
  quarantined: IconShieldLock,
};

export function StatusIcon({
  status,
  className,
}: {
  status: ClaimStatus;
  className?: string;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <Icon
      aria-hidden
      data-status={status}
      className={cn("size-4 shrink-0 text-[hsl(var(--tone))]", className)}
      strokeWidth={2}
    />
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: ClaimStatus;
  className?: string;
}) {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[hsl(var(--tone-bg))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--tone))]",
        className,
      )}
    >
      <StatusIcon status={status} className="size-3.5" />
      {STATUS_LABEL[status]}
    </span>
  );
}
