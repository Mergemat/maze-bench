"use client";

import { useMemo, useState } from "react";
import { type DitherColor, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "@/components/dither-kit";
import { cn } from "@/lib/utils";

export interface CurveModel {
  key: string;
  name: string;
  /** task -> level -> score (0..1) */
  levels: Record<string, Record<number, number>>;
}

export interface CurveTask {
  id: string;
  title: string;
  metric: string;
  levels: number[];
  /** Heuristic baseline per level, shown as a caption so the chart keeps <= 4 series. */
  heuristic: Record<number, number>;
}

// Fixed categorical order, validated for colour-blind separation on the dark surface.
// Colour follows the selection slot, and a slot keeps its colour while others change.
const SLOTS: DitherColor[] = ["blue", "orange", "purple", "pink"];
const STROKES = ["solid", "dashed", "solid", "dashed"] as const;
const MAX = SLOTS.length;

export function LevelCurves({ tasks, models }: { tasks: CurveTask[]; models: CurveModel[] }) {
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [selected, setSelected] = useState<(string | null)[]>(() => {
    const first = models.slice(0, MAX).map((m) => m.key);
    return [...first, ...Array<null>(MAX - first.length).fill(null)];
  });
  const task = tasks.find((t) => t.id === taskId) ?? tasks[0];

  const toggle = (key: string) => {
    setSelected((cur) => {
      const at = cur.indexOf(key);
      if (at >= 0) {
        return cur.map((k, i) => (i === at ? null : k));
      }
      const free = cur.indexOf(null);
      return free >= 0 ? cur.map((k, i) => (i === free ? key : k)) : cur;
    });
  };

  const { data, config } = useMemo(() => {
    if (!task) {
      return { data: [], config: {} };
    }
    const active = selected
      .map((key, slot) => ({ key, slot }))
      .filter((s): s is { key: string; slot: number } => s.key !== null);
    const rows = task.levels.map((level) => {
      const row: Record<string, number | string> = { level: `L${level}` };
      for (const { key } of active) {
        const v = models.find((m) => m.key === key)?.levels[task.id]?.[level];
        row[key] = v === undefined ? 0 : Math.round(v * 1000) / 10;
      }
      return row;
    });
    const cfg = Object.fromEntries(
      active.map(({ key, slot }) => [
        key,
        { label: models.find((m) => m.key === key)?.name ?? key, color: SLOTS[slot] as DitherColor },
      ]),
    );
    return { data: rows, config: cfg };
  }, [task, selected, models]);

  if (!task || models.length === 0) {
    return <p className="text-muted-foreground text-sm">No model results yet.</p>;
  }
  const active = selected.filter((k): k is string => k !== null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTaskId(t.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              t.id === task.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div className="h-72 rounded-lg border bg-card p-3">
        {active.length > 0 ? (
          <LineChart data={data} config={config} bloom="low">
            <XAxis dataKey="level" />
            <YAxis tickFormatter={(v) => `${v}`} />
            <Legend />
            <Tooltip labelKey="level" />
            {active.map((key) => (
              <Line key={key} dataKey={key} strokeVariant={STROKES[selected.indexOf(key)] ?? "solid"} />
            ))}
          </LineChart>
        ) : (
          <p className="p-4 text-muted-foreground text-sm">Pick up to four models below.</p>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {task.title}, {task.metric} by level (× 100). Heuristic baseline:{" "}
        {task.levels.map((l) => `L${l} ${Math.round((task.heuristic[l] ?? 0) * 100)}`).join(" · ")}.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {models.map((m) => {
          const slot = selected.indexOf(m.key);
          const full = slot < 0 && !selected.includes(null);
          return (
            <button
              key={m.key}
              type="button"
              disabled={full}
              onClick={() => toggle(m.key)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs transition-colors disabled:opacity-40",
                slot >= 0 ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {slot >= 0 ? `● ${m.name}` : m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
