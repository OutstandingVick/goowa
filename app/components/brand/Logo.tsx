import { cn } from "@/lib/utils";

/** Goowa's segmented-hexagon mark (paths match public/brand/*.svg). */
export function LogoMark({
  variant = "onWhite",
  size = 24,
  className,
}: {
  variant?: "onPurple" | "onWhite";
  size?: number;
  className?: string;
}) {
  const main = variant === "onPurple" ? "#FCFFFF" : "#723CD6";
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <g
        fill="none"
        strokeWidth={17}
        strokeLinejoin="round"
        strokeLinecap="butt"
      >
        <polyline points="86,27 60,12 25,32.2" stroke={main} />
        <polyline points="18.4,45 18.4,84 50,102.2" stroke={main} />
        <polyline points="67,104 101.6,84 101.6,77" stroke="#EDB158" />
        <polyline points="60,60 101.6,60 101.6,46" stroke={main} />
      </g>
    </svg>
  );
}

/**
 * Mark plus the "GOOWA" wordmark in Chakra Petch 700. Gap is 0.25x the mark;
 * the font size puts the cap height at about 0.6x the mark (Chakra Petch caps
 * are ~0.7em).
 */
export function Logo({
  variant = "onWhite",
  showWordmark = true,
  size = 24,
  className,
}: {
  variant?: "onPurple" | "onWhite";
  showWordmark?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: size * 0.25 }}
      aria-label="Goowa"
      role="img"
    >
      <LogoMark variant={variant} size={size} />
      {showWordmark && (
        <span
          aria-hidden="true"
          style={{
            fontFamily: '"Chakra Petch", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: size * 0.86,
            letterSpacing: "0.03em",
            lineHeight: 1,
            color: variant === "onPurple" ? "#FCFFFF" : "#723CD6",
          }}
        >
          GOOWA
        </span>
      )}
    </span>
  );
}
