"use client";

import { useState } from "react";
import { EffortChart, type EffortPoint } from "@/components/effort-chart";
import { compact, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChartModel extends Omit<EffortPoint, "x"> {
  cost: number;
  outputTokens: number;
  steps: number;
}

const VIEWS = [
  { id: "cost", tab: "Cost", x: (m: ChartModel) => m.cost, format: (v: number) => usd(v) },
  { id: "tokens", tab: "Output tokens", x: (m: ChartModel) => m.outputTokens, format: (v: number) => compact(v) },
  {
    id: "steps",
    tab: "Agent steps",
    x: (m: ChartModel) => m.steps,
    format: (v: number) => (v < 10 ? String(Number(v.toPrecision(2))) : compact(v)),
  },
] as const;

/** Completion (y) against cost, output tokens or agent steps per maze (x). One line per model across efforts. */
export function Charts({ models }: { models: ChartModel[] }) {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("cost");
  const active = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Completion vs <span className="text-foreground">{active.tab.toLowerCase()}</span> per maze
        </p>
        <div role="tablist" className="flex rounded-md border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === view}
              onClick={() => setView(v.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs transition-colors",
                v.id === view ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.tab}
            </button>
          ))}
        </div>
      </div>
      <EffortChart
        key={active.id}
        metric={active.tab}
        points={models.map((m) => ({ ...m, x: active.x(m) }))}
        format={active.format}
      />
    </section>
  );
}
