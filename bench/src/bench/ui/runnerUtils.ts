import { computeStats } from "../stats";
import type { BenchmarkStats, MazeData, RunResult } from "../types";
import type { ModelKey } from "../models";
import { saveRunResult } from "../save";
import type { ModelStats, SuiteChoice } from "./types";

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const item = items[currentIndex];
      if (item) {
        await fn(item);
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
}

export function updateSuccessStats(
  prev: ModelStats,
  result: RunResult
): Partial<ModelStats> {
  const completionTokens =
    "completionTokens" in result
      ? ((result.completionTokens as number) ?? 0)
      : 0;

  return {
    executedDone: prev.executedDone + 1,
    durationSumMs: prev.durationSumMs + (result.totalDurationMs ?? 0),
    maxDurationMs: Math.max(prev.maxDurationMs, result.totalDurationMs ?? 0),
    correctCount: prev.correctCount + 1,
    costSum: prev.costSum + (result.cost ?? 0),
    completionTokensSum: prev.completionTokensSum + completionTokens,
  };
}

export function updateErrorStats(
  prev: ModelStats,
  result: RunResult
): Partial<ModelStats> {
  const isError = !!result.error;
  const completionTokens =
    "completionTokens" in result
      ? ((result.completionTokens as number) ?? 0)
      : 0;

  return {
    executedErrors: isError ? prev.executedErrors + 1 : prev.executedErrors,
    executedDone: isError ? prev.executedDone : prev.executedDone + 1,
    durationSumMs: prev.durationSumMs + (result.totalDurationMs ?? 0),
    maxDurationMs: Math.max(prev.maxDurationMs, result.totalDurationMs ?? 0),
    incorrectCount: prev.incorrectCount + 1,
    costSum: prev.costSum + (result.cost ?? 0),
    completionTokensSum: prev.completionTokensSum + completionTokens,
  };
}

export function saveModelResults(params: {
  model: ModelKey;
  version: string;
  suite: SuiteChoice;
  mazes: MazeData[];
  results: RunResult[];
}): void {
  const { model, version, suite, mazes, results } = params;
  const modelStats = computeStats(results);
  const filename = `${model}_${version}_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;

  saveRunResult(filename, {
    metadata: {
      model,
      date: new Date().toISOString(),
      version,
      suite: suite.id,
      seeds: mazes.map((m) => m.seed),
    },
    stats: modelStats,
    results,
  });
}
