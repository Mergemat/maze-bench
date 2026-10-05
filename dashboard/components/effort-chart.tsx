"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { rgb } from "@/components/dither-kit/palette";
import { fillOf, type PixelColor } from "@/components/dither-kit/pixel";
import { useChartDimensions } from "@/components/dither-kit/use-chart-dimensions";
import { DitherPlot } from "@/components/dither-plot";
import { pct } from "@/lib/format";

/** One leaderboard entry: a model at one reasoning effort. */
export interface EffortPoint {
  key: string;
  /** The model; its points form one line across reasoning efforts. */
  group: string;
  name: string;
  effort: string;
  creator: string;
  href: string;
  score: number;
  lo: number;
  hi: number;
  x: number;
}

// One dither-kit colour per lab, fixed so a lab keeps its colour whatever else is shown.
const LAB: Record<string, PixelColor> = {
  openai: "blue",
  anthropic: "orange",
  google: "green",
  "x-ai": "purple",
  qwen: "pink",
  deepseek: 200,
  moonshotai: 48,
  "z-ai": 172,
};
const colorOf = (creator: string): PixelColor => LAB[creator] ?? "grey";
const EFFORTS = ["none", "minimal", "low", "default", "medium", "high", "xhigh"];

export function EffortChart({
  points,
  format,
  metric,
}: {
  points: EffortPoint[];
  format: (v: number) => string;
  /** Name of the x measure, shown in the tooltip ("Cost", "Output tokens", "Steps"). */
  metric: string;
}) {
  const { ref, size } = useChartDimensions<HTMLDivElement>();
  const router = useRouter();
  const [hover, setHover] = useState<EffortPoint | null>(null);
  const [labelGroup, setLabelGroup] = useState<string | null>(null);
  const active = hover?.group ?? labelGroup;

  const wide = size.width >= 640;
  const width = size.width;
  const height = wide ? 420 : 300;
  const m = { top: 12, right: wide ? 150 : 14, bottom: 26, left: 38 };
  const plotW = Math.max(1, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;

  const usable = useMemo(() => points.filter((p) => p.x > 0 && Number.isFinite(p.score)), [points]);
  const lines = useMemo(() => {
    const byGroup = new Map<string, EffortPoint[]>();
    for (const p of usable) {
      byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), p]);
    }
    return [...byGroup.values()].map((list) =>
      [...list].sort((a, b) => EFFORTS.indexOf(a.effort) - EFFORTS.indexOf(b.effort) || a.x - b.x),
    );
  }, [usable]);

  const xs = usable.map((p) => p.x);
  const lo = Math.log10(xs.length > 0 ? Math.min(...xs) / 1.6 : 0.001);
  const hi = Math.log10(xs.length > 0 ? Math.max(...xs) * 1.6 : 1);
  const x = (v: number) => ((Math.log10(v) - lo) / (hi - lo || 1)) * plotW;
  const y = (s: number) => (1 - s) * plotH;

  const xTicks: number[] = [];
  for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
    for (const k of [1, 2, 5]) {
      const v = k * 10 ** e;
      if (Math.log10(v) >= lo && Math.log10(v) <= hi) {
        xTicks.push(v);
      }
    }
  }
  // Keep few tick labels so they never collide on small screens.
  const stride = Math.ceil(xTicks.length / (wide ? 8 : 4));
  const shownTicks = xTicks.filter((_, i) => i % stride === 0);

  // One label per model in a column on the right, joined to the end of its line by a leader
  // line. Labels are nudged apart so they never overlap.
  const labels = lines
    .map((list) => {
      const last = list.at(-1) as EffortPoint;
      const right = [...list].sort((a, b) => b.x - a.x)[0] as EffortPoint;
      return {
        group: last.group,
        name: last.name,
        href: last.href,
        color: rgb(fillOf(colorOf(last.creator))),
        ax: x(right.x),
        ay: y(right.score),
        y: y(right.score),
      };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1] as { y: number };
    const cur = labels[i] as { y: number };
    cur.y = Math.max(cur.y, prev.y + 18);
  }
  const overflow = (labels.at(-1)?.y ?? 0) - plotH;
  if (overflow > 0) {
    for (const l of labels) {
      l.y -= overflow;
    }
  }

  const fade = (group: string) => (active && active !== group ? 0.2 : 1);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left - m.left;
    const my = e.clientY - box.top - m.top;
    let best: EffortPoint | null = null;
    let bestD = 28 * 28;
    for (const p of usable) {
      const d = (x(p.x) - mx) ** 2 + (y(p.score) - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    setHover(best);
  };

  const hoverColor = hover ? rgb(fillOf(colorOf(hover.creator))) : undefined;

  return (
    <div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 ? (
          <>
            <div className="absolute" style={{ left: m.left, top: m.top, width: plotW, height: plotH }}>
              <DitherPlot
                width={plotW}
                height={plotH}
                hovered={active}
                series={lines.map((list) => ({
                  key: list[0]?.group ?? "",
                  color: colorOf(list[0]?.creator ?? ""),
                  points: [...list].sort((a, b) => a.x - b.x).map((p) => ({ x: x(p.x), y: y(p.score) })),
                }))}
              />
            </div>
            <svg
              width={width}
              height={height}
              className="absolute inset-0"
              role="img"
              aria-label="Completion by reasoning effort for each model"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              // Pointer convenience only; every model is also a link in the table below.
              onClick={() => hover && router.push(hover.href)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hover) {
                  router.push(hover.href);
                }
              }}
              style={{ cursor: hover ? "pointer" : "default" }}
            >
              <g transform={`translate(${m.left},${m.top})`}>
                {[0, 0.25, 0.5, 0.75, 1].map((s) => (
                  <g key={s}>
                    <line
                      x1={0}
                      x2={plotW}
                      y1={y(s)}
                      y2={y(s)}
                      stroke="currentColor"
                      strokeDasharray="1 4"
                      className="text-muted-foreground/30"
                    />
                    <text x={-8} y={y(s) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                      {s * 100}%
                    </text>
                  </g>
                ))}
                {shownTicks.map((v) => (
                  <text
                    key={v}
                    x={x(v)}
                    y={plotH + 18}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono text-[10px]"
                  >
                    {format(v)}
                  </text>
                ))}
                {wide
                  ? labels.map((l) => (
                      // biome-ignore lint/a11y/noStaticElementInteractions: hover highlight only; the table links every model
                      <g
                        key={l.group}
                        opacity={fade(l.group)}
                        className="cursor-pointer transition-opacity"
                        onPointerEnter={() => setLabelGroup(l.group)}
                        onPointerLeave={() => setLabelGroup(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(l.href);
                        }}
                      >
                        <path
                          d={`M ${l.ax + 5} ${l.ay} L ${plotW + 6} ${l.y} L ${plotW + 12} ${l.y}`}
                          fill="none"
                          stroke={l.color}
                          strokeWidth={1}
                          opacity={active === l.group ? 0.9 : 0.35}
                        />
                        <rect x={plotW + 14} y={l.y - 9} width={m.right - 16} height={18} fill="transparent" />
                        <text x={plotW + 16} y={l.y + 4} className="text-[11px]" fill={l.color}>
                          {l.name}
                        </text>
                      </g>
                    ))
                  : null}
                {hover ? (
                  <rect
                    x={x(hover.x) - 4}
                    y={y(hover.score) - 4}
                    width={8}
                    height={8}
                    fill={hoverColor}
                    style={{ filter: `drop-shadow(0 0 6px ${hoverColor})` }}
                  />
                ) : null}
                {usable.length === 0 ? (
                  <text x={plotW / 2} y={plotH / 2} textAnchor="middle" className="fill-muted-foreground text-xs">
                    No runs yet
                  </text>
                ) : null}
              </g>
            </svg>
            {hover ? (
              <div
                className="pointer-events-none absolute z-10 w-44 rounded border bg-popover/95 px-2 py-1.5 font-mono text-[11px] shadow-lg backdrop-blur"
                style={{
                  left: Math.min(m.left + x(hover.x) + 10, width - 184),
                  top: Math.min(Math.max(0, m.top + y(hover.score) - 30), height - 70),
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-sans" style={{ color: hoverColor }}>
                    {hover.name}
                  </span>
                  <span className="text-muted-foreground">{hover.effort}</span>
                </div>
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>Completion</span>
                  <span className="text-foreground">{pct(hover.score, 0)}%</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{metric}</span>
                  <span className="text-foreground">{format(hover.x)}</span>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {wide ? null : (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {labels.map((l) => (
            <button
              key={l.group}
              type="button"
              className="flex items-center gap-1.5 text-[11px] transition-opacity"
              style={{ opacity: fade(l.group) }}
              onPointerEnter={() => setLabelGroup(l.group)}
              onPointerLeave={() => setLabelGroup(null)}
              onClick={() => setLabelGroup((g) => (g === l.group ? null : l.group))}
            >
              <span className="size-2" style={{ background: l.color }} />
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
