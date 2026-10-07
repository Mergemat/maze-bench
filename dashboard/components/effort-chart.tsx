"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useChartDimensions } from "@/components/dither-kit/use-chart-dimensions";
import { DitherPlot } from "@/components/dither-plot";
import { LabLogo, LabMark } from "@/components/lab-logo";
import { pct } from "@/lib/format";
import { labColor, labOf } from "@/lib/labs";

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
  /** Extra rows for the tooltip, e.g. cost, output tokens and steps per task. */
  details?: { label: string; value: string; active?: boolean }[];
}

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
  const [labHover, setLabHover] = useState<string | null>(null);
  const active = hover?.group ?? labelGroup;

  const wide = size.width >= 640;
  const width = size.width;
  const height = wide ? 560 : 360;
  const m = { top: 12, right: wide ? 180 : 14, bottom: 26, left: 38 };
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
  // The y axis starts just under the weakest model rather than at 0%, so the field spreads out.
  const minScore = usable.length > 0 ? Math.min(...usable.map((p) => p.score)) : 0;
  const yMin = Math.max(0, Math.floor((minScore - 0.05) * 10) / 10);
  const y = (s: number) => ((1 - s) / (1 - yMin || 1)) * plotH;
  const yStep = 1 - yMin > 0.5 ? 20 : 10;
  const yTicks: number[] = [];
  for (let v = 100; v >= Math.round(yMin * 100); v -= yStep) {
    yTicks.push(v / 100);
  }

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
      // The label hangs off the highest-effort point, where the line ends.
      const last = list.at(-1) as EffortPoint;
      return {
        group: last.group,
        name: last.name,
        creator: last.creator,
        href: last.href,
        color: labColor(last.creator),
        ax: x(last.x),
        ay: y(last.score),
        y: y(last.score),
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

  const creatorOf = new Map(usable.map((p) => [p.group, p.creator]));
  const labs = [...new Set(usable.map((p) => p.creator))];
  const isActive = (group: string) => (active ? active === group : labHover ? creatorOf.get(group) === labHover : true);
  const fade = (group: string) => (isActive(group) ? 1 : 0.2);
  // The plot highlights one series; a hovered lab highlights all of its models.
  const highlighted = useMemo(
    () =>
      active
        ? [active]
        : labHover
          ? lines.filter((l) => l[0]?.creator === labHover).map((l) => l[0]?.group ?? "")
          : null,
    [active, labHover, lines],
  );

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

  const hoverColor = hover ? labColor(hover.creator) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {labs.map((c) => (
          <span
            key={c}
            className="flex cursor-default items-center gap-1.5 text-[11px] text-muted-foreground transition-opacity hover:text-foreground"
            style={{ opacity: labHover && labHover !== c ? 0.4 : 1 }}
            onPointerEnter={() => setLabHover(c)}
            onPointerLeave={() => setLabHover(null)}
          >
            <LabLogo creator={c} size={13} />
            {labOf(c).name}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 ? (
          <>
            <div className="absolute" style={{ left: m.left, top: m.top, width: plotW, height: plotH }}>
              <DitherPlot
                width={plotW}
                height={plotH}
                hovered={highlighted}
                series={lines.map((list) => ({
                  key: list[0]?.group ?? "",
                  color: labOf(list[0]?.creator ?? "").color,
                  // In effort order (low → high), so the line reads as "more effort", even when a
                  // lower effort happens to cost more and the line turns back.
                  points: list.map((p) => ({ x: x(p.x), y: y(p.score) })),
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
                {yTicks.map((s) => (
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
                      {Math.round(s * 100)}%
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
                {labels.map((l) => (
                  <g key={l.group} opacity={fade(l.group)} className="pointer-events-none transition-opacity">
                    <LabMark creator={l.creator} x={l.ax + 6} y={l.ay - 6} />
                  </g>
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
                        {/* The leader only shows for the hovered model; at rest the logo at the line's end ties it to its label. */}
                        {active === l.group ? (
                          <path
                            d={`M ${l.ax + 22} ${l.ay} L ${plotW + 6} ${l.y} L ${plotW + 12} ${l.y}`}
                            fill="none"
                            stroke={l.color}
                            strokeWidth={1}
                            opacity={0.7}
                          />
                        ) : null}
                        <rect x={plotW + 14} y={l.y - 9} width={m.right - 16} height={18} fill="transparent" />
                        <LabMark creator={l.creator} x={plotW + 16} y={l.y - 6} />
                        <text x={plotW + 33} y={l.y + 4} className="text-[11px]" fill={l.color}>
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
                className="pointer-events-none absolute z-10 w-52 rounded border bg-popover/95 px-2 py-1.5 font-mono text-[11px] shadow-lg backdrop-blur"
                style={{
                  left: Math.min(m.left + x(hover.x) + 10, width - 216),
                  top: Math.min(Math.max(0, m.top + y(hover.score) - 30), height - 110),
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 font-sans" style={{ color: hoverColor }}>
                    <LabLogo creator={hover.creator} size={12} />
                    <span className="truncate">{hover.name}</span>
                  </span>
                  <span className="text-muted-foreground">{hover.effort}</span>
                </div>
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>Completion</span>
                  <span className="text-foreground">{pct(hover.score, 0)}%</span>
                </div>
                {(hover.details ?? [{ label: metric, value: format(hover.x), active: true }]).map((d) => (
                  <div
                    key={d.label}
                    className={`flex justify-between ${d.active ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    <span>{d.label}</span>
                    <span>{d.value}</span>
                  </div>
                ))}
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
              <LabLogo creator={l.creator} size={11} />
              <span style={{ color: l.color }}>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
