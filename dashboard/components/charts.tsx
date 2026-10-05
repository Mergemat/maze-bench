"use client";

import { useState } from "react";
import { type ChartPoint, MetricChart } from "@/components/metric-scatter";
import { compact, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChartModel extends Omit<ChartPoint, "x"> {
  cost: number;
  outputTokens: number;
  steps: number;
}

const VIEWS = [
  { id: "cost", tab: "Cost", axis: "Cost per maze (USD)", x: (m: ChartModel) => m.cost, format: (v: number) => usd(v) },
  {
    id: "tokens",
    tab: "Output tokens",
    axis: "Output tokens per maze",
    x: (m: ChartModel) => m.outputTokens,
    format: (v: number) => compact(v),
  },
  {
    id: "steps",
    tab: "Agent steps",
    axis: "Agent steps per maze",
    x: (m: ChartModel) => m.steps,
    format: (v: number) => (v < 10 ? String(Number(v.toPrecision(2))) : compact(v)),
  },
] as const;

/** Completion against cost, output tokens or agent steps, one line per model across efforts. */
export function Charts({ models }: { models: ChartModel[] }) {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("cost");
  const active = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-2 flex items-center gap-4">
        <h2 className="font-medium text-lg">Completion vs {active.tab.toLowerCase()}</h2>
        <div role="tablist" className="flex gap-1 rounded-md border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === view}
              onClick={() => setView(v.id)}
              className={cn(
                "rounded px-3 py-1 text-xs transition-colors",
                v.id === view ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.tab}
            </button>
          ))}
        </div>
      </div>
      <MetricChart
        key={active.id}
        axisLabel={active.axis}
        points={models.map((m) => ({ ...m, x: active.x(m) }))}
        format={active.format}
      />
    </section>
  );
}
