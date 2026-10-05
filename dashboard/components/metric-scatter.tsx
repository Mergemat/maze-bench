"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rgb } from "@/components/dither-kit/palette";
import { fillOf, type PixelColor } from "@/components/dither-kit/pixel";
import { DitherPlot, type DitherSeries } from "@/components/dither-plot";
import { pct } from "@/lib/format";

/** One leaderboard entry: a model at one reasoning effort. */
export interface ChartPoint {
  key: string;
  /** Points with the same group (the model) are joined into one line across efforts. */
  group: string;
  name: string;
  effort: string;
  creator: string;
  href: string;
  /** Completion rate 0..1 with its 95% interval. */
  score: number;
  lo: number;
  hi: number;
  x: number;
}

// One dither-kit colour per lab, fixed, so a lab keeps its colour whatever else is on the chart.
// Named palette colours first; labs beyond them get a raw hue, which dither-kit also accepts.
const LAB_COLORS: Record<string, PixelColor> = {
  openai: "blue",
  anthropic: "orange",
  google: "green",
  "x-ai": "purple",
  qwen: "pink",
  deepseek: 200,
  moonshotai: 48,
  "z-ai": 172,
};
const colorOf = (creator: string): PixelColor => LAB_COLORS[creator] ?? "grey";
const css = (c: PixelColor) => rgb(fillOf(c));

const EFFORT_ORDER = ["none", "minimal", "low", "default", "medium", "high", "xhigh"];

const W = 1000;
const H = 560;
const M = { top: 34, right: 230, bottom: 44, left: 56 };
const LABEL_GAP = 20;

function niceTicks(min: number, max: number, log: boolean): number[] {
  if (log) {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** e;
        if (v >= min && v <= max) {
          out.push(v);
        }
      }
    }
    return out;
  }
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / 5));
  const unit = [1, 2, 5, 10].map((k) => k * step).find((s) => span / s <= 6) ?? step * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / unit) * unit; v <= max + 1e-12; v += unit) {
    out.push(Number(v.toPrecision(6)));
  }
  return out;
}

/** Points nobody beats on both axes: lower x and higher completion. */
function paretoFront(points: ChartPoint[]): ChartPoint[] {
  const out: ChartPoint[] = [];
  let best = -1;
  for (const p of [...points].sort((a, b) => a.x - b.x || b.score - a.score)) {
    if (p.score > best) {
      out.push(p);
      best = p.score;
    }
  }
  return out;
}

/** Spread label positions so neighbours keep at least `gap` px apart, then pull back into the plot. */
function spread(ys: { key: string; y: number }[], gap: number, top: number, bottom: number) {
  const sorted = ys.map((s) => ({ ...s })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1] as { y: number };
    const cur = sorted[i] as { y: number };
    cur.y = Math.max(cur.y, prev.y + gap);
  }
  const overflow = (sorted.at(-1)?.y ?? 0) - bottom;
  if (overflow > 0) {
    for (const s of sorted) {
      s.y = Math.max(top, s.y - overflow);
    }
  }
  return new Map(sorted.map((s) => [s.key, s.y]));
}

/**
 * Completion (one y-axis) against cost, output tokens or agent steps. Each model is a line
 * through its reasoning-effort settings, coloured by lab and labelled in a column on the right.
 */
export function MetricChart({
  points,
  axisLabel,
  format,
}: {
  points: ChartPoint[];
  /** e.g. "Cost per maze (USD)". */
  axisLabel: string;
  format: (v: number) => string;
}) {
  const [log, setLog] = useState(true);
  const [pareto, setPareto] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const usable = useMemo(() => points.filter((p) => p.x > 0 && Number.isFinite(p.score)), [points]);
  const groups = useMemo(() => {
    const map = new Map<string, ChartPoint[]>();
    for (const p of usable) {
      map.set(p.group, [...(map.get(p.group) ?? []), p]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => EFFORT_ORDER.indexOf(a.effort) - EFFORT_ORDER.indexOf(b.effort) || a.x - b.x);
    }
    return [...map.entries()];
  }, [usable]);

  const xs = usable.map((p) => p.x);
  const rawMin = xs.length > 0 ? Math.min(...xs) : 1;
  const rawMax = xs.length > 0 ? Math.max(...xs) : 10;
  const minX = log ? rawMin / 2 : 0;
  const maxX = log ? rawMax * 2 : rawMax * 1.1;
  const scores = usable.map((p) => p.score);
  const minY = Math.max(0, Math.floor(((scores.length > 0 ? Math.min(...scores) : 0) - 0.1) * 10) / 10);
  const maxY = 1;

  const plotRight = W - M.right;
  const px = (v: number) => {
    const t = log
      ? (Math.log10(v) - Math.log10(minX)) / (Math.log10(maxX) - Math.log10(minX) || 1)
      : (v - minX) / (maxX - minX || 1);
    return M.left + t * (W - M.left - M.right);
  };
  const py = (s: number) => M.top + (1 - (s - minY) / (maxY - minY || 1)) * (H - M.top - M.bottom);

  // Each line is labelled at its last point (highest effort), in a column on the right.
  const labelY = spread(
    groups.map(([group, list]) => ({ key: group, y: py((list.at(-1) as ChartPoint).score) })),
    LABEL_GAP,
    M.top,
    H - M.bottom,
  );
  const front = pareto ? paretoFront(usable) : [];
  const plotW = plotRight - M.left;
  const plotH = H - M.top - M.bottom;
  const dither: DitherSeries[] = groups.map(([group, list]) => ({
    key: group,
    color: colorOf(list[0]?.creator ?? ""),
    points: [...list].sort((a, b) => a.x - b.x).map((p) => ({ x: px(p.x) - M.left, y: py(p.score) - M.top })),
  }));
  const hoveredGroup = usable.find((p) => p.key === hover)?.group ?? null;
  const active = usable.find((p) => p.key === hover);

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 flex items-center gap-4 text-xs">
        <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={pareto}
            onChange={(e) => setPareto(e.target.checked)}
            className="accent-[rgb(53,143,243)]"
          />
          Pareto line
        </label>
        {(["Linear", "Log"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setLog(mode === "Log")}
            className={
              (mode === "Log") === log
                ? "border-foreground border-b pb-0.5 text-foreground"
                : "pb-0.5 text-muted-foreground hover:text-foreground"
            }
          >
            {mode}
          </button>
        ))}
      </div>

      <div
        className="absolute"
        style={{
          left: `${(M.left / W) * 100}%`,
          top: `${(M.top / H) * 100}%`,
          width: `${(plotW / W) * 100}%`,
          height: `${(plotH / H) * 100}%`,
        }}
      >
        <DitherPlot series={dither} width={plotW} height={plotH} hovered={hoveredGroup} />
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="relative w-full"
        role="img"
        aria-label={`Completion against ${axisLabel}`}
      >
        <text x={M.left} y={M.top - 16} className="fill-muted-foreground text-[11px]">
          Completion
        </text>
        {niceTicks(minY, maxY, false).map((s) => (
          <g key={s}>
            <line
              x1={M.left}
              x2={plotRight}
              y1={py(s)}
              y2={py(s)}
              stroke="currentColor"
              strokeDasharray="1 5"
              className="text-muted-foreground/40"
            />
            <text x={M.left - 10} y={py(s) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {Math.round(s * 100)}%
            </text>
          </g>
        ))}
        <line
          x1={M.left}
          x2={plotRight}
          y1={H - M.bottom}
          y2={H - M.bottom}
          stroke="currentColor"
          className="text-border"
        />
        {usable.length > 0
          ? niceTicks(log ? minX : 0, maxX, log).map((v) => (
              <g key={v}>
                <line
                  x1={px(v)}
                  x2={px(v)}
                  y1={H - M.bottom}
                  y2={H - M.bottom + 5}
                  stroke="currentColor"
                  className="text-border"
                />
                <text x={px(v)} y={H - M.bottom + 20} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {format(v)}
                </text>
              </g>
            ))
          : null}
        <text x={(M.left + plotRight) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {axisLabel}
          {log ? ", log scale" : ""}
        </text>

        {front.length > 1 ? (
          <polyline
            points={front.map((p) => `${px(p.x)},${py(p.score)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-foreground/50"
          />
        ) : null}

        {groups.map(([group, list]) => {
          const color = css(colorOf(list[0]?.creator ?? ""));
          const dim = hover && !list.some((p) => p.key === hover) ? 0.25 : 1;
          const last = list.at(-1) as ChartPoint;
          const ly = labelY.get(group) ?? py(last.score);
          return (
            <g key={group} opacity={dim}>
              <line x1={px(last.x) + 6} x2={plotRight + 12} y1={py(last.score)} y2={ly} stroke={color} opacity={0.25} />
              <rect x={plotRight + 16} y={ly - 5} width={10} height={10} fill={color} opacity={0.9} />
              <text x={plotRight + 32} y={ly + 4} className="text-[12px]" fill={color}>
                {last.name}
              </text>
              {list.map((p) => (
                <g key={p.key}>
                  {hover === p.key ? (
                    <line
                      x1={px(p.x)}
                      x2={px(p.x)}
                      y1={py(p.hi)}
                      y2={py(p.lo)}
                      stroke={color}
                      strokeWidth={2}
                      opacity={0.5}
                    />
                  ) : null}
                  <Link
                    href={p.href}
                    aria-label={`${p.name} (${p.effort}): ${pct(p.score, 0)}% completion, ${format(p.x)}`}
                    onMouseEnter={() => setHover(p.key)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(p.key)}
                    onBlur={() => setHover(null)}
                  >
                    <circle cx={px(p.x)} cy={py(p.score)} r={12} fill="transparent" />
                  </Link>
                </g>
              ))}
            </g>
          );
        })}
        {usable.length === 0 ? (
          <text x={(M.left + plotRight) / 2} y={H / 2} textAnchor="middle" className="fill-muted-foreground text-sm">
            No model runs yet
          </text>
        ) : null}
      </svg>

      {active ? (
        <div className="pointer-events-none absolute top-8 left-16 rounded-md border bg-popover px-3 py-2 text-xs shadow-lg">
          <div className="font-medium">
            {active.name} <span className="text-muted-foreground">· {active.effort} effort</span>
          </div>
          <div className="text-muted-foreground">
            {pct(active.score, 0)}% completion (95% CI {pct(active.lo, 0)}–{pct(active.hi, 0)}) · {format(active.x)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
