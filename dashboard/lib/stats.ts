import type { BenchmarkReport, RunResult } from "./types";

export interface ModelMetricsPoint {
  model: string;
  displayName: string;
  creator: string;
  nRuns: number;
  nSuccesses: number;
  successRatePct: number;
  avgSteps: number;
  avgTimeSec: number;
  avgCostPerRun: number;
  costPerSuccess: number;
  totalSteps: number;
  totalTimeMs: number;
  totalCost: number;
  avgEfficiencyScore: number;
  /** Composite score = successRate * avgEfficiency (0-100 scale) */
  compositeScore: number;
}

function filterRuns(
  runs: RunResult[],
  complexity: string | null,
  size: string | null,
  observationMode: string | null
): RunResult[] {
  return runs.filter((r) => {
    if (complexity && r.config.complexity !== complexity) {
      return false;
    }
    if (size && `${r.config.width}x${r.config.height}` !== size) {
      return false;
    }
    if (observationMode && r.config.observationMode !== observationMode) {
      return false;
    }
    return true;
  });
}

export function computeModelMetricsPoints(
  reports: Map<string, BenchmarkReport>,
  complexityFilter: string | null,
  sizeFilter: string | null,
  observationModeFilter: string | null
): ModelMetricsPoint[] {
  const points: ModelMetricsPoint[] = [];

  for (const [model, report] of reports.entries()) {
    const filtered = filterRuns(
      report.results,
      complexityFilter,
      sizeFilter,
      observationModeFilter
    );

    const nRuns = filtered.length;
    const successfulRuns = filtered.filter((r) => r.success);
    const nSuccesses = successfulRuns.length;

    const totalSteps = filtered.reduce((acc, r) => acc + r.totalSteps, 0);
    const totalTimeMs = filtered.reduce((acc, r) => acc + r.totalDurationMs, 0);
    const totalCost = filtered.reduce((acc, r) => acc + (r.cost ?? 0), 0);

    // Compute average efficiency score (only for successful runs)
    const successfulRunsWithEfficiency = successfulRuns.filter(
      (r) => r.efficiencyScore !== undefined && r.efficiencyScore > 0
    );
    const totalEfficiency = successfulRunsWithEfficiency.reduce(
      (acc, r) => acc + (r.efficiencyScore ?? 0),
      0
    );
    const avgEfficiencyScore =
      successfulRunsWithEfficiency.length === 0
        ? 0
        : totalEfficiency / successfulRunsWithEfficiency.length;

    // Composite score combines success rate and efficiency
    // Formula: successRate (0-1) * avgEfficiency (0-1) * 100
    // This penalizes models with few successful runs even if those runs were efficient
    const successRate = nRuns === 0 ? 0 : nSuccesses / nRuns;
    const compositeScore = successRate * avgEfficiencyScore * 100;

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
      costPerSuccess: nSuccesses === 0 ? 0 : totalCost / nSuccesses,
      totalSteps,
      totalTimeMs,
      totalCost,
      avgEfficiencyScore,
      compositeScore,
    });
  }

  // Default sort: most successful models first (change if you want)
  points.sort((a, b) => b.successRatePct - a.successRatePct);

  return points;
}
