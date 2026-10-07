import { labColor, labOf } from "@/lib/labs";
import { cn } from "@/lib/utils";

/**
 * A lab's mark in its own colour. Creators without a mark get their initial in a tinted
 * square, so every row still carries a badge.
 */
export function LabLogo({
  creator,
  size = 16,
  className,
  mono,
}: {
  creator: string;
  size?: number;
  className?: string;
  /** Draw in the current text colour instead of the lab colour. */
  mono?: boolean;
}) {
  const lab = labOf(creator);
  if (lab.paths.length === 0) {
    return (
      <span
        role="img"
        aria-label={lab.name}
        className={cn(
          "inline-grid shrink-0 place-items-center rounded-[3px] font-mono uppercase leading-none",
          className,
        )}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.6,
          color: mono ? undefined : labColor(creator),
          background: labColor(creator, 0.15),
        }}
      >
        {lab.name.slice(0, 1)}
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={lab.name}
      fill={mono ? "currentColor" : labColor(creator)}
      fillRule="evenodd"
      className={cn("shrink-0", className)}
    >
      <title>{lab.name}</title>
      {lab.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The same mark for use inside an `<svg>`, with its top-left corner at (x, y). */
export function LabMark({ creator, x, y, size = 12 }: { creator: string; x: number; y: number; size?: number }) {
  const lab = labOf(creator);
  if (lab.paths.length === 0) {
    return (
      <g>
        <rect x={x} y={y} width={size} height={size} rx={2} fill={labColor(creator, 0.15)} />
        <text
          x={x + size / 2}
          y={y + size * 0.78}
          textAnchor="middle"
          fontSize={size * 0.6}
          fill={labColor(creator)}
          className="font-mono uppercase"
        >
          {lab.name.slice(0, 1)}
        </text>
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill={labColor(creator)} fillRule="evenodd">
      {lab.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}
