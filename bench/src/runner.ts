import {
  buildItem,
  enumerateItems,
  getTask,
  type ItemRef,
  type ItemResult,
  itemHash,
  mergeItems,
  PROMPT_VERSION,
  type RunHeader,
  SCHEMA_VERSION,
  type Suite,
  suiteKey,
  type TaskId,
} from "@mazebench/core";
import type { LanguageModel } from "ai";
import { aiSdkVersion, gitSha } from "./env.ts";
import { runInteractive } from "./harness/fog.ts";
import { runOneShot } from "./harness/oneshot.ts";
import type { Attempt, CallOptions } from "./harness/types.ts";
import { type Effort, type ModelEntry, subjectKey } from "./models.ts";
import { createModel } from "./providers.ts";
import { loadSubjectRuns, RunWriter, runPath, timestampId } from "./storage.ts";

export interface RunOptions {
  suite: Suite;
  entry: ModelEntry;
  effort: Effort;
  epochs: number;
  concurrency: number;
  maxOutputTokens: number;
  timeoutMs: number;
  tasks?: TaskId[];
  levels?: number[];
  /** Keep only the first N items of each (task, level). */
  limit?: number;
  /** Skip (item, epoch) pairs that already have a scored result for this subject. */
  resume: boolean;
  holdoutSalt?: string;
  /** Injected in tests. */
  model?: LanguageModel;
  log: (line: string) => void;
}

export interface RunSummary {
  path: string | null;
  attempted: number;
  scored: number;
  errors: number;
  costUsd: number;
  meanScore: number;
}

export function selectItems(suite: Suite, opts: Pick<RunOptions, "tasks" | "levels" | "limit" | "holdoutSalt">): ItemRef[] {
  return enumerateItems(suite, opts.holdoutSalt ?? "").filter(
    (r) =>
      (!opts.tasks || opts.tasks.includes(r.task)) &&
      (!opts.levels || opts.levels.includes(r.level.level)) &&
      (opts.limit === undefined || r.index < opts.limit),
  );
}

/** Run worker functions over a queue with a fixed concurrency. */
export async function pool<T>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

export async function runModel(opts: RunOptions): Promise<RunSummary> {
  const { suite, entry, effort, log } = opts;
  const split = opts.holdoutSalt ? "holdout" : "public";
  const key = subjectKey(entry, effort);
  const sKey = suiteKey(suite);

  let jobs = selectItems(suite, opts).flatMap((ref) => Array.from({ length: opts.epochs }, (_, epoch) => ({ ref, epoch })));
  if (opts.resume) {
    const done = new Set(
      mergeItems(loadSubjectRuns(split, sKey, key))
        .filter((i) => i.status === "scored")
        .map((i) => `${i.itemId}#${i.epoch}`),
    );
    jobs = jobs.filter((j) => !done.has(`${j.ref.itemId}#${j.epoch}`));
  }
  if (jobs.length === 0) {
    log(`${key}: nothing to run.`);
    return { path: null, attempted: 0, scored: 0, errors: 0, costUsd: 0, meanScore: Number.NaN };
  }

  const startedAt = new Date();
  const header: RunHeader = {
    type: "run",
    schemaVersion: SCHEMA_VERSION as "2.0.0",
    runId: `${key}_${timestampId(startedAt)}`,
    suite: { id: suite.id, version: suite.version, split },
    subject: {
      kind: "model",
      key,
      displayName: effort === "default" ? entry.displayName : `${entry.displayName} (${effort})`,
      creator: entry.creator,
      provider: entry.provider,
      modelId: entry.modelId,
      reasoningEffort: effort,
      openWeights: entry.openWeights,
      ...(entry.routing ? { routing: { ...entry.routing } } : {}),
    },
    settings: { epochs: opts.epochs, maxOutputTokens: opts.maxOutputTokens, temperature: null, concurrency: opts.concurrency },
    harness: { gitSha: gitSha(), promptVersion: PROMPT_VERSION, aiSdkVersion: aiSdkVersion(), runtime: `bun ${Bun.version}` },
    startedAt: startedAt.toISOString(),
  };
  const writer = new RunWriter(runPath(split, sKey, key, `${timestampId(startedAt)}.jsonl`), header);
  const model = opts.model ?? createModel(entry, effort);
  log(`${key}: ${jobs.length} attempts on ${sKey} (${split}) -> ${writer.path}`);

  let finished = 0;
  let scored = 0;
  let errors = 0;
  let cost = 0;
  let scoreSum = 0;

  await pool(jobs, opts.concurrency, async ({ ref, epoch }) => {
    const task = getTask(ref.task);
    const item = buildItem(ref);
    const call: CallOptions = {
      maxOutputTokens: opts.maxOutputTokens,
      timeoutMs: opts.timeoutMs,
      onRetry: (msg) => log(`  ${ref.itemId} e${epoch}: ${msg}`),
    };
    const attempt: Attempt =
      task.kind === "oneshot"
        ? await runOneShot(model, task, item, ref.repr, call)
        : await runInteractive(model, task, item, call);

    const result: ItemResult = {
      type: "item",
      itemId: ref.itemId,
      itemHash: itemHash(ref, item),
      task: ref.task,
      level: ref.level.level,
      seed: ref.seed,
      epoch,
      status: attempt.status,
      score: attempt.scored.score,
      outcome: attempt.status === "error" ? "error" : attempt.scored.outcome,
      metrics: attempt.scored.metrics,
      ...(attempt.answer ? { answer: attempt.answer } : {}),
      ...(attempt.scored.trace ? { trace: attempt.scored.trace } : {}),
      usage: attempt.usage,
      latencyMs: attempt.latencyMs,
      calls: attempt.calls,
      providers: attempt.providers,
      ...(attempt.finishReason ? { finishReason: attempt.finishReason } : {}),
      ...(attempt.error ? { error: attempt.error } : {}),
      finishedAt: new Date().toISOString(),
    };
    writer.append(result);

    finished++;
    cost += attempt.usage.costUsd ?? 0;
    if (attempt.status === "scored") {
      scored++;
      scoreSum += attempt.scored.score;
    } else {
      errors++;
    }
    const mark = attempt.status === "error" ? `ERROR ${attempt.error?.category}` : `${attempt.scored.outcome} ${attempt.scored.score.toFixed(2)}`;
    log(
      `[${finished}/${jobs.length}] ${ref.itemId} e${epoch} ${mark} ` +
        `$${(attempt.usage.costUsd ?? 0).toFixed(4)} ${attempt.calls} call(s) ${(attempt.latencyMs / 1000).toFixed(1)}s`,
    );
  });

  log(
    `${key}: done. scored ${scored}, errors ${errors}, mean score ${(scoreSum / Math.max(1, scored)).toFixed(3)}, cost $${cost.toFixed(4)}`,
  );
  return { path: writer.path, attempted: jobs.length, scored, errors, costUsd: cost, meanScore: scoreSum / Math.max(1, scored) };
}
