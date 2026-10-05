"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { pct, usd } from "@/lib/format";

export interface ScatterPoint {
  key: string;
  name: string;
  href: string;
  cost: number;
  score: number;
  lo: number;
  hi: number;
  openWeights: boolean;
}

const W = 720;
const H = 360;
const M = { top: 16, right: 24, bottom: 40, left: 44 };
const BLUE = "rgb(53,143,243)";
const ORANGE = "rgb(255,150,50)";

/** Points that no other point beats on both cost and score. */
function frontier(points: ScatterPoint[]): Set<string> {
  const sorted = [...points].sort((a, b) => a.cost - b.cost);
  const out = new Set<string>();
  let best = -1;
  for (const p of sorted) {
    if (p.score > best) {
      out.add(p.key);
      best = p.score;
    }
  }
  return out;
}

/**
 * Score against total cost of the suite run, log-scaled on x. One y-axis (score), with the
 * 95% interval as a vertical whisker. Colour encodes open vs closed weights and is backed by
 * the marker shape, so it is never the only cue.
 */
export function CostScatter({ points }: { points: ScatterPoint[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const usable = points.filter((p) => p.cost > 0 && Number.isFinite(p.score));
  const onFrontier = useMemo(() => frontier(usable), [usable]);

  if (usable.length === 0) {
    return <p className="text-muted-foreground text-sm">No priced model runs yet.</p>;
  }

  const costs = usable.map((p) => p.cost);
  const minC = Math.min(...costs) / 1.6;
  const maxC = Math.max(...costs) * 1.6;
  const x = (c: number) =>
    M.left + ((Math.log10(c) - Math.log10(minC)) / (Math.log10(maxC) - Math.log10(minC))) * (W - M.left - M.right);
  const y = (s: number) => M.top + (1 - s) * (H - M.top - M.bottom);
  const decades: number[] = [];
  for (let e = Math.floor(Math.log10(minC)); e <= Math.ceil(Math.log10(maxC)); e++) {
    for (const m of [1, 3]) {
      const v = m * 10 ** e;
      if (v >= minC && v <= maxC) {
        decades.push(v);
      }
    }
  }
  const active = usable.find((p) => p.key === hover);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Score against cost per model">
        {[0, 0.25, 0.5, 0.75, 1].map((s) => (
          <g key={s}>
            <line x1={M.left} x2={W - M.right} y1={y(s)} y2={y(s)} stroke="currentColor" className="text-border" />
            <text x={M.left - 8} y={y(s) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {s * 100}
            </text>
          </g>
        ))}
        {decades.map((v) => (
          <g key={v}>
            <line
              x1={x(v)}
              x2={x(v)}
              y1={M.top}
              y2={H - M.bottom}
              stroke="currentColor"
              className="text-border"
              strokeDasharray="2 3"
            />
            <text x={x(v)} y={H - M.bottom + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {usd(v)}
            </text>
          </g>
        ))}
        <text x={(W + M.left) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          Cost of one full suite run (USD, log scale)
        </text>
        <text x={12} y={M.top + 4} className="fill-muted-foreground text-[10px]">
          Score
        </text>

        {usable.map((p) => {
          const color = p.openWeights ? ORANGE : BLUE;
          const dim = hover && hover !== p.key ? 0.3 : 1;
          const cx = x(p.cost);
          return (
            <g key={p.key} opacity={dim}>
              <line x1={cx} x2={cx} y1={y(p.hi)} y2={y(p.lo)} stroke={color} strokeWidth={2} opacity={0.6} />
              {p.openWeights ? (
                <rect x={cx - 5} y={y(p.score) - 5} width={10} height={10} fill={color} />
              ) : (
                <circle cx={cx} cy={y(p.score)} r={5.5} fill={color} />
              )}
              {onFrontier.has(p.key) || hover === p.key ? (
                <text x={cx + 9} y={y(p.score) - 7} className="fill-foreground text-[11px]">
                  {p.name}
                </text>
              ) : null}
              <Link
                href={p.href}
                aria-label={`${p.name}: score ${pct(p.score)}, ${usd(p.cost)}`}
                onMouseEnter={() => setHover(p.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.key)}
                onBlur={() => setHover(null)}
              >
                <rect x={cx - 14} y={y(p.score) - 14} width={28} height={28} fill="transparent" />
              </Link>
            </g>
          );
        })}
      </svg>
      {active ? (
        <div className="pointer-events-none absolute top-2 right-2 rounded-md border bg-popover px-3 py-2 text-xs shadow-lg">
          <div className="font-medium">{active.name}</div>
          <div className="text-muted-foreground">
            Score {pct(active.score)} ({pct(active.lo)}–{pct(active.hi)}) · {usd(active.cost)}
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex gap-5 text-muted-foreground text-xs">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <circle cx="5" cy="5" r="5" fill={BLUE} />
          </svg>
          Closed weights
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <rect width="10" height="10" fill={ORANGE} />
          </svg>
          Open weights
        </span>
        <span>Labelled: cost–score frontier. Whiskers: 95% CI.</span>
      </div>
    </div>
  );
}
