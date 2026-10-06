import type { ItemResult, RunFile, Subject } from "./schema.ts";
import { bootstrapMean, bootstrapValues, type Interval, mean, passAtK, passHatK, wilson } from "./stats.ts";
import { enumerateItems, type Suite, suiteKey } from "./suites.ts";
import type { TaskId } from "./tasks/types.ts";

export interface LevelSummary {
  level: number;
  n: number;
  interval: Interval;
}

export interface TaskSummary {
  task: TaskId;
  /** Items with at least one scored attempt. */
  n: number;
  expected: number;
  errors: number;
  interval: Interval;
  levels: LevelSummary[];
  outcomes: Record<string, number>;
  /** Mean of each numeric secondary metric over scored attempts. */
  metrics: Record<string, number>;
  /** pass@k and pass^k for k = 2..epochs, when epochs > 1. */
  passAt: Record<number, number>;
  passHat: Record<number, number>;
  /** Per scored maze. */
  perMaze: PerMaze;
}

export interface PerMaze {
  costUsd: number;
  outputTokens: number;
  inputTokens: number;
  /** Model calls (agent steps). */
  steps: number;
  latencyMs: number;
}

function perMaze(items: readonly ItemResult[]): PerMaze {
  const n = Math.max(1, items.length);
  const sum = (f: (i: ItemResult) => number) => items.reduce((s, i) => s + f(i), 0) / n;
  return {
    costUsd: sum((i) => i.usage.costUsd ?? 0),
    outputTokens: sum((i) => i.usage.outputTokens),
    inputTokens: sum((i) => i.usage.inputTokens),
    steps: sum((i) => i.calls),
    latencyMs: sum((i) => i.latencyMs),
  };
}

export interface SubjectSummary {
  subject: Subject;
  suite: string;
  runIds: string[];
  epochs: number;
  scored: number;
  expected: number;
  errors: number;
  /** Completion over all scored mazes (solved / scored), or null if any task has no scored items. */
  composite: Interval | null;
  tasks: Partial<Record<TaskId, TaskSummary>>;
  /** Per scored maze, across all conditions. */
  perMaze: PerMaze;
  usage: {
    costUsd: number;
    /** False if any scored attempt is missing a cost, so the total is a lower bound. */
    costComplete: boolean;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    calls: number;
    meanLatencyMs: number;
  };
  providers: Record<string, number>;
}

/** Latest scored result per (item, epoch) across all runs of one subject. Errors only fill gaps. */
export function mergeItems(runs: readonly RunFile[]): ItemResult[] {
  const sorted = [...runs].sort((a, b) => a.header.startedAt.localeCompare(b.header.startedAt));
  const best = new Map<string, ItemResult>();
  for (const run of sorted) {
    for (const item of run.items) {
      const key = `${item.itemId}#${item.epoch}`;
      const prev = best.get(key);
      if (item.status === "scored" || !prev || prev.status === "error") {
        best.set(key, item);
      }
    }
  }
  return [...best.values()];
}

function groupBy<T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const list = out.get(k);
    if (list) {
      list.push(x);
    } else {
      out.set(k, [x]);
    }
  }
  return out;
}

/** Per-item mean score over scored epochs, keyed by item id, for one task. */
export function itemScores(items: readonly ItemResult[], task: TaskId): Map<string, number> {
  const out = new Map<string, number>();
  const byItem = groupBy(
    items.filter((i) => i.task === task && i.status === "scored"),
    (i) => i.itemId,
  );
  for (const [id, list] of byItem) {
    out.set(id, mean(list.map((i) => i.score)));
  }
  return out;
}

function summarizeTask(task: TaskId, items: readonly ItemResult[], expected: number, epochs: number): TaskSummary {
  const all = items.filter((i) => i.task === task);
  const scored = all.filter((i) => i.status === "scored");
  const byItem = groupBy(scored, (i) => i.itemId);
  const clusters = [...byItem.values()].map((list) => list.map((i) => i.score));

  const levels = [...groupBy(scored, (i) => String(i.level)).entries()]
    .map(([level, list]) => {
      const perItem = [...groupBy(list, (i) => i.itemId).values()].map((l) => mean(l.map((i) => i.score)));
      const binary = list.every((i) => i.score === 0 || i.score === 1);
      const interval = binary
        ? wilson(list.filter((i) => i.score === 1).length, list.length)
        : bootstrapValues(perItem, { seed: Number(level) });
      return { level: Number(level), n: perItem.length, interval };
    })
    .sort((a, b) => a.level - b.level);

  const outcomes: Record<string, number> = {};
  for (const i of scored) {
    outcomes[i.outcome] = (outcomes[i.outcome] ?? 0) + 1;
  }

  const sums: Record<string, { s: number; n: number }> = {};
  for (const i of scored) {
    for (const [k, v] of Object.entries(i.metrics)) {
      const value = typeof v === "boolean" ? Number(v) : v;
      if (typeof value === "number" && Number.isFinite(value)) {
        const acc = sums[k] ?? { s: 0, n: 0 };
        acc.s += value;
        acc.n++;
        sums[k] = acc;
      }
    }
  }
  const metrics = Object.fromEntries(Object.entries(sums).map(([k, { s, n }]) => [k, s / n]));

  const passAt: Record<number, number> = {};
  const passHat: Record<number, number> = {};
  for (let k = 2; k <= epochs; k++) {
    const at: number[] = [];
    const hat: number[] = [];
    for (const list of byItem.values()) {
      const n = list.length;
      const c = list.filter((i) => i.score >= 1).length;
      const a = passAtK(n, c, k);
      const h = passHatK(n, c, k);
      if (a !== null && h !== null) {
        at.push(a);
        hat.push(h);
      }
    }
    if (at.length > 0) {
      passAt[k] = mean(at);
      passHat[k] = mean(hat);
    }
  }

  return {
    task,
    n: byItem.size,
    expected,
    errors: all.filter((i) => i.status === "error").length,
    interval: bootstrapMean(clusters),
    levels,
    outcomes,
    metrics,
    passAt,
    passHat,
    perMaze: perMaze(scored),
  };
}

/** Summaries for every subject that has runs of this suite. */
export function aggregate(runs: readonly RunFile[], suite: Suite): SubjectSummary[] {
  const key = suiteKey(suite);
  const relevant = runs.filter((r) => suiteKey(r.header.suite) === key && r.header.suite.split === "public");
  const bySubject = groupBy(relevant, (r) => r.header.subject.key);
  const refs = enumerateItems(suite);
  const out: SubjectSummary[] = [];

  for (const subjectRuns of bySubject.values()) {
    const latest = subjectRuns.reduce((a, b) => (a.header.startedAt > b.header.startedAt ? a : b));
    const epochs = Math.max(...subjectRuns.map((r) => r.header.settings.epochs));
    const items = mergeItems(subjectRuns);
    const tasks: Partial<Record<TaskId, TaskSummary>> = {};
    for (const t of suite.tasks) {
      const expected = refs.filter((r) => r.task === t.task).length;
      tasks[t.task] = summarizeTask(t.task, items, expected, epochs);
    }

    const strata = suite.tasks.map((t) => [...itemScores(items, t.task).values()]);
    const complete = strata.every((s) => s.length > 0);

    const scored = items.filter((i) => i.status === "scored");
    const providers: Record<string, number> = {};
    for (const i of scored) {
      for (const p of i.providers) {
        providers[p] = (providers[p] ?? 0) + 1;
      }
    }

    out.push({
      subject: latest.header.subject,
      suite: key,
      runIds: subjectRuns.map((r) => r.header.runId),
      epochs,
      scored: scored.length,
      expected: refs.length * epochs,
      errors: items.filter((i) => i.status === "error").length,
      // Completion is mazes solved / mazes scored, so the headline matches the solved count.
      composite: complete ? bootstrapValues(strata.flat()) : null,
      tasks,
      perMaze: perMaze(scored),
      usage: {
        costUsd: scored.reduce((s, i) => s + (i.usage.costUsd ?? 0), 0),
        costComplete: scored.every((i) => i.usage.costUsd !== null),
        inputTokens: scored.reduce((s, i) => s + i.usage.inputTokens, 0),
        outputTokens: scored.reduce((s, i) => s + i.usage.outputTokens, 0),
        reasoningTokens: scored.reduce((s, i) => s + i.usage.reasoningTokens, 0),
        calls: scored.reduce((s, i) => s + i.calls, 0),
        meanLatencyMs: mean(scored.map((i) => i.latencyMs)),
      },
      providers,
    });
  }

  return out.sort((a, b) => (b.composite?.mean ?? -1) - (a.composite?.mean ?? -1));
}

/**
 * Paired difference in composite score (a - b) over items both subjects scored,
 * with a stratified bootstrap CI. Positive means a is better.
 */
export function pairedComposite(
  a: readonly ItemResult[],
  b: readonly ItemResult[],
  suite: Suite,
): Interval & { n: number } {
  const strata: number[][] = [];
  let n = 0;
  for (const t of suite.tasks) {
    const sa = itemScores(a, t.task);
    const sb = itemScores(b, t.task);
    const diffs: number[] = [];
    for (const [id, va] of sa) {
      const vb = sb.get(id);
      if (vb !== undefined) {
        diffs.push(va - vb);
      }
    }
    n += diffs.length;
    strata.push(diffs);
  }
  return { ...bootstrapValues(strata.flat(), { seed: 7 }), n };
}
