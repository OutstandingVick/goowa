import { IconSparkles, IconUser } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

/** Who made a change: a human (person icon) or the agent (sparkles). */
export function ActorBadge({
  actor,
  verb,
  className,
}: {
  actor: string;
  verb: string;
  className?: string;
}) {
  const isAgent = actor === "agent";
  const Icon = isAgent ? IconSparkles : IconUser;
  return (
    <span
      title={`${verb || "By"} ${verb ? "by " : ""}${isAgent ? "the agent" : "a human"}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2} />
      {verb ? `${verb} by ` : ""}
      {isAgent ? "agent" : "human"}
    </span>
  );
}
