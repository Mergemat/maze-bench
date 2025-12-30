import type { BenchmarkReport, RunResult } from "./types";

export type ModelMetricsPoint = {
  model: string;
  displayName: string;
  creator: string;
  nRuns: number;
  nSuccesses: number;
  successRatePct: number;
  avgSteps: number;
  avgTimeSec: number;
  avgCostPerRun: number;
  totalSteps: number;
  totalTimeMs: number;
  totalCost: number;
  avgEfficiencyScore: number;
};

function filterRuns(
  runs: RunResult[],
  complexity: string | null,
  size: string | null,
  vision: string | null
): RunResult[] {
  return runs.filter((r) => {
    if (complexity && r.config.complexity !== complexity) {
      return false;
    }
    if (size && `${r.config.width}x${r.config.height}` !== size) {
      return false;
    }
    if (vision && r.config.vision !== vision) {
      return false;
    }
    return true;
  });
}

export function computeModelMetricsPoints(
  reports: Map<string, BenchmarkReport>,
  complexityFilter: string | null,
  sizeFilter: string | null,
  visionFilter: string | null
): ModelMetricsPoint[] {
  const points: ModelMetricsPoint[] = [];

  for (const [model, report] of reports.entries()) {
    const filtered = filterRuns(
      report.results,
      complexityFilter,
      sizeFilter,
      visionFilter
    );

    const nRuns = filtered.length;
    const successfulRuns = filtered.filter((r) => r.success);
    const nSuccesses = successfulRuns.length;

    const totalSteps = filtered.reduce((acc, r) => acc + r.totalSteps, 0);
    const totalTimeMs = filtered.reduce((acc, r) => acc + r.totalDurationMs, 0);
    const totalCost = filtered.reduce((acc, r) => acc + (r.cost ?? 0), 0);

    // Compute average efficiency score (only for runs that have efficiency data)
    const runsWithEfficiency = filtered.filter(
      (r) => r.efficiencyScore !== undefined
    );
    const totalEfficiency = runsWithEfficiency.reduce(
      (acc, r) => acc + (r.efficiencyScore ?? 0),
      0
    );
    const avgEfficiencyScore =
      runsWithEfficiency.length === 0
        ? 0
        : totalEfficiency / runsWithEfficiency.length;

    points.push({
      model,
      displayName: report.metadata.displayName ?? model,
      creator: report.metadata.creator ?? "unknown",
      nRuns,
      nSuccesses,
      successRatePct: nRuns === 0 ? 0 : (nSuccesses / nRuns) * 100,
      avgSteps: nRuns === 0 ? 0 : totalSteps / nRuns,
      avgTimeSec: nRuns === 0 ? 0 : totalTimeMs / 1000 / nRuns,
      avgCostPerRun: nRuns === 0 ? 0 : totalCost / nRuns,
      totalSteps,
      totalTimeMs,
      totalCost,
      avgEfficiencyScore,
    });
  }

  // Default sort: most successful models first (change if you want)
  points.sort((a, b) => b.successRatePct - a.successRatePct);

  return points;
}
