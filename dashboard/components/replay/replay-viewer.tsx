"use client";

import { buildItem, findItem, getSuite, type ItemResult, TASKS, type TaskId } from "@mazebench/core";
import { useEffect, useMemo, useState } from "react";
import { compact, seconds, slug, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildScene } from "./frames";
import { MazeCanvas } from "./maze-canvas";

type Filter = "all" | "success" | "failed";

function outcomeTone(i: ItemResult): string {
  if (i.status === "error") {
    return "bg-[rgb(140,140,150)]";
  }
  if (i.score >= 1) {
    return "bg-[rgb(53,143,243)]";
  }
  return i.score > 0 ? "bg-[rgb(150,110,255)]" : "bg-[rgb(255,150,50)]";
}

export function ReplayViewer({ suiteId, subjectKey }: { suiteId: string; subjectKey: string }) {
  const suite = getSuite(suiteId);
  const tasks = suite.tasks.map((t) => t.task);
  const [items, setItems] = useState<ItemResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<TaskId>(tasks[0] as TaskId);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch(`/data/${suiteId}/${slug(subjectKey)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ItemResult[]) => setItems(data))
      .catch((e: unknown) => setError(String(e)));
  }, [suiteId, subjectKey]);

  const visible = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          i.task === task &&
          (filter === "all" || (filter === "success" ? i.score >= 1 : i.score < 1 || i.status === "error")),
      ),
    [items, task, filter],
  );

  const current = visible.find((i) => i.itemId === selected) ?? visible[0];

  const scene = useMemo(() => {
    if (!current || current.status === "error") {
      return null;
    }
    const ref = findItem(suite, current.itemId);
    return ref ? buildScene(current.task, buildItem(ref), current) : null;
  }, [current, suite]);

  // Restart playback whenever the item changes; one-frame scenes just show their frame.
  useEffect(() => {
    setFrameIndex(scene ? scene.frames.length - 1 : 0);
    setPlaying(false);
  }, [scene]);

  useEffect(() => {
    if (!(playing && scene)) {
      return;
    }
    const delay = scene.frames.length > 120 ? 40 : 110;
    const id = setInterval(() => {
      setFrameIndex((f) => {
        if (f >= scene.frames.length - 1) {
          setPlaying(false);
          return f;
        }
        return f + 1;
      });
    }, delay);
    return () => clearInterval(id);
  }, [playing, scene]);

  if (error) {
    return <p className="text-muted-foreground text-sm">Could not load results: {error}</p>;
  }
  if (!items) {
    return <p className="text-muted-foreground text-sm">Loading results…</p>;
  }

  const frame = scene?.frames[Math.min(frameIndex, scene.frames.length - 1)];

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {tasks.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTask(t);
                setSelected(null);
              }}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                t === task ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TASKS[t].title}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["all", "success", "failed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs capitalize",
                f === filter ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <ul className="max-h-[440px] space-y-0.5 overflow-y-auto pr-1 font-mono text-xs">
          {visible.map((i) => (
            <li key={`${i.itemId}#${i.epoch}`}>
              <button
                type="button"
                onClick={() => setSelected(i.itemId)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1 text-left",
                  current?.itemId === i.itemId
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                <span className={cn("size-2 shrink-0", outcomeTone(i))} aria-hidden="true" />
                <span className="flex-1">{i.itemId}</span>
                <span className="tabular-nums">{i.status === "error" ? "err" : i.score.toFixed(2)}</span>
              </button>
            </li>
          ))}
          {visible.length === 0 ? <li className="px-2 py-1 text-muted-foreground">No items.</li> : null}
        </ul>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Squares: blue full score, purple partial, orange zero, grey API error (not scored).
        </p>
      </div>

      <div className="min-w-0 space-y-4">
        {current ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="font-mono">{current.itemId}</span>
              <span className="text-muted-foreground">{current.outcome.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">score {current.score.toFixed(2)}</span>
              <span className="text-muted-foreground">
                {compact(current.usage.inputTokens)} in · {compact(current.usage.outputTokens)} out ·{" "}
                {current.usage.costUsd === null ? "cost n/a" : usd(current.usage.costUsd)} · {current.calls} call(s) ·{" "}
                {seconds(current.latencyMs)}
              </span>
            </div>
            {scene && frame ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-card p-3 dither-surface">
                  <MazeCanvas scene={scene} frame={frame} />
                </div>
                {scene.frames.length > 1 ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (frameIndex >= scene.frames.length - 1) {
                          setFrameIndex(0);
                        }
                        setPlaying((p) => !p);
                      }}
                      className="rounded-md border px-3 py-1 font-mono text-xs hover:bg-accent"
                    >
                      {playing ? "pause" : "play"}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={scene.frames.length - 1}
                      value={frameIndex}
                      onChange={(e) => {
                        setPlaying(false);
                        setFrameIndex(Number(e.target.value));
                      }}
                      className="flex-1 accent-[rgb(53,143,243)]"
                      aria-label="Replay position"
                    />
                    <span className="w-16 text-right font-mono text-muted-foreground text-xs tabular-nums">
                      {frameIndex + 1}/{scene.frames.length}
                    </span>
                  </div>
                ) : null}
                <p className="text-muted-foreground text-sm">{frame.caption}</p>
                <p className="text-[11px] text-muted-foreground">
                  Blue: the model's path, brighter = later; large blue block = current position. Purple: optimal route
                  (plan) or the walk shown to the model (recall). Green ring: start. Orange block: goal. Orange ring:
                  legal moves (local). Red ×: a move into a wall. Faint tiles: not yet seen.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{current.error?.message ?? "Nothing to replay."}</p>
            )}
            {current.answer?.text ? (
              <details className="rounded-lg border bg-card">
                <summary className="cursor-pointer px-4 py-2 text-muted-foreground text-xs">
                  Final reply (last 1,500 characters, parse: {current.answer.parse})
                </summary>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-4 pb-4 font-mono text-xs leading-relaxed">
                  {current.answer.text}
                </pre>
              </details>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Pick an item.</p>
        )}
      </div>
    </div>
  );
}
