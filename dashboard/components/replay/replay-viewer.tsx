"use client";

import {
  buildItem,
  findItem,
  getSuite,
  type ItemResult,
  type LevelSpec,
  type MazeItem,
  sizeLabel,
  TASK_IDS,
  TASKS,
  type TaskId,
} from "@mazebench/core";
import { useEffect, useMemo, useState } from "react";
import { compact, slug, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildScene, type Scene } from "./frames";
import { MazeCanvas } from "./maze-canvas";

interface Attempt {
  result: ItemResult;
  mode: TaskId;
  level: LevelSpec;
  scene: Scene;
}

function Player({ attempt }: { attempt: Attempt }) {
  const { scene, result } = attempt;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const id = setInterval(
      () =>
        setFrame((f) => {
          if (f >= scene.frames.length - 1) {
            setPlaying(false);
            return f;
          }
          return f + 1;
        }),
      scene.frames.length > 100 ? 35 : 90,
    );
    return () => clearInterval(id);
  }, [playing, scene]);

  const current = scene.frames[Math.min(frame, scene.frames.length - 1)];
  if (!current) {
    return null;
  }
  const stats: Array<[string, string]> = [
    [scene.success ? "solved" : "failed", TASKS[attempt.mode].title],
    [`${frame}/${scene.frames.length - 1}`, "moves"],
    [String(result.calls), "steps"],
    [result.usage.costUsd === null ? "–" : usd(result.usage.costUsd), `${compact(result.usage.outputTokens)} out`],
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3">
        <MazeCanvas scene={scene} frame={current} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (frame >= scene.frames.length - 1) {
              setFrame(0);
            }
            setPlaying((p) => !p);
          }}
          className="w-14 rounded-md border py-1 font-mono text-xs hover:bg-accent"
        >
          {playing ? "pause" : "play"}
        </button>
        <input
          type="range"
          min={0}
          max={scene.frames.length - 1}
          value={frame}
          onChange={(e) => {
            setPlaying(false);
            setFrame(Number(e.target.value));
          }}
          className="flex-1 accent-[rgb(53,143,243)]"
          aria-label="Replay position"
        />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {stats.map(([big, small]) => (
          <div key={small} className="rounded-md border bg-card px-2 py-1.5">
            <div className={cn("font-pixel text-base", big === "failed" && "text-[rgb(255,150,50)]")}>{big}</div>
            <div className="text-[10px] text-muted-foreground">{small}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Thumb({ attempt, active, onClick }: { attempt: Attempt; active: boolean; onClick: () => void }) {
  const last = attempt.scene.frames.at(-1);
  if (!last) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${attempt.result.itemId}: ${attempt.scene.success ? "solved" : "failed"}`}
      className={cn(
        "rounded-sm border-2 p-0.5 transition-transform hover:scale-105",
        attempt.scene.success ? "border-[rgb(53,143,243)]/70" : "border-[rgb(255,150,50)]/70",
        active && "ring-2 ring-foreground",
      )}
    >
      {/* Thumbnails show the whole maze and the full path, even for fog. */}
      <MazeCanvas scene={attempt.scene} frame={{ ...last, revealed: undefined }} className="size-14" />
    </button>
  );
}

/** Every maze the model attempted as thumbnails, by condition and size, next to a player. */
export function ReplayViewer({ suiteId, subjectKey }: { suiteId: string; subjectKey: string }) {
  const suite = getSuite(suiteId);
  const [items, setItems] = useState<ItemResult[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/data/${slug(subjectKey)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ItemResult[]) => setItems(data))
      .catch(() => setItems([]));
  }, [subjectKey]);

  const attempts = useMemo<Attempt[]>(
    () =>
      (items ?? [])
        .filter((r) => r.status === "scored")
        .flatMap((r) => {
          const ref = findItem(suite, r.itemId);
          if (!ref) {
            return [];
          }
          const item = buildItem(ref) as MazeItem;
          return [{ result: r, mode: ref.task, level: ref.level, scene: buildScene(ref.task, item, r) }];
        }),
    [items, suite],
  );

  if (!items) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }
  const current = attempts.find((a) => a.result.itemId === selected) ?? attempts[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
      <div className="space-y-6">
        {TASK_IDS.map((mode) => {
          const ofMode = attempts.filter((a) => a.mode === mode);
          if (ofMode.length === 0) {
            return null;
          }
          const levels = [...new Map(ofMode.map((a) => [a.level.level, a.level])).values()].sort(
            (a, b) => a.level - b.level,
          );
          const solved = ofMode.filter((a) => a.scene.success).length;
          return (
            <section key={mode} className="space-y-2">
              <h3 className="flex items-baseline gap-3">
                <span className="font-pixel text-lg">{TASKS[mode].title}</span>
                <span className="font-mono text-muted-foreground text-xs">
                  {solved}/{ofMode.length} solved
                </span>
              </h3>
              {levels.map((level) => (
                <div key={level.level} className="flex items-start gap-3">
                  <span className="w-12 pt-5 font-mono text-[11px] text-muted-foreground">{sizeLabel(level)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ofMode
                      .filter((a) => a.level.level === level.level)
                      .map((a) => (
                        <Thumb
                          key={a.result.itemId}
                          attempt={a}
                          active={current?.result.itemId === a.result.itemId}
                          onClick={() => setSelected(a.result.itemId)}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <div className="lg:sticky lg:top-20 lg:self-start">
        {current ? <Player key={current.result.itemId} attempt={current} /> : null}
      </div>
    </div>
  );
}
