import type { Interval } from "@mazebench/core";
import { pct } from "@/lib/format";
import { labColor } from "@/lib/labs";

/**
 * Score with its 95% interval on a 0–100 track. The filled part is an ordered-dither
 * pattern (the same 4x4 Bayer tile dither-kit uses), the whisker is the interval.
 */
export function CiBar({
  interval,
  width = 132,
  creator,
}: {
  interval: Interval | null;
  width?: number;
  /** Lab whose colour fills the bar; grey when omitted (baselines). */
  creator?: string;
}) {
  if (!(interval && Number.isFinite(interval.mean))) {
    return <span className="text-muted-foreground text-xs">partial</span>;
  }
  const h = 14;
  const x = (v: number) => Math.max(0, Math.min(1, v)) * width;
  const color = creator ? labColor(creator) : "rgb(140 140 150)";
  const id = `dither-${creator ?? "grey"}`;
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 text-right font-mono text-sm tabular-nums">{pct(interval.mean)}</span>
      <svg
        width={width}
        height={h}
        role="img"
        aria-label={`${pct(interval.mean)} (95% CI ${pct(interval.lo)} to ${pct(interval.hi)})`}
        className="overflow-visible"
      >
        <title>{`95% CI ${pct(interval.lo)}–${pct(interval.hi)}`}</title>
        <defs>
          <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
            {/* Bayer 4x4 at ~60% density */}
            {[
              [0, 0],
              [2, 0],
              [1, 1],
              [3, 1],
              [0, 2],
              [2, 2],
              [3, 3],
              [1, 3],
              [2, 1],
              [0, 3],
            ].map(([px, py]) => (
              <rect key={`${px}-${py}`} x={px} y={py} width="1" height="1" fill={color} />
            ))}
          </pattern>
        </defs>
        <rect x={0} y={3} width={width} height={h - 6} fill="currentColor" className="text-muted" />
        <rect x={0} y={3} width={x(interval.mean)} height={h - 6} fill={`url(#${id})`} />
        <rect x={Math.max(0, x(interval.mean) - 1)} y={1} width={2} height={h - 2} fill={color} />
        <line
          x1={x(interval.lo)}
          x2={x(interval.hi)}
          y1={h / 2}
          y2={h / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-foreground/70"
        />
        <line
          x1={x(interval.lo)}
          x2={x(interval.lo)}
          y1={3}
          y2={h - 3}
          stroke="currentColor"
          className="text-foreground/70"
        />
        <line
          x1={x(interval.hi)}
          x2={x(interval.hi)}
          y1={3}
          y2={h - 3}
          stroke="currentColor"
          className="text-foreground/70"
        />
      </svg>
    </div>
  );
}
