"use client";

import { useAtomValue } from "jotai";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BenchmarkReport, RunResult } from "@/lib/types";
import {
  complexityFilterAtom,
  sizeFilterAtom,
  successfulOnlyAtom,
  observationModeFilterAtom,
} from "@/store/filters";

type ModelComparisonProps = {
  reports: Map<string, BenchmarkReport>;
};

type FilterOptions = {
  complexity: string | null;
  size: string | null;
  observationMode: string | null;
  successfulOnly?: boolean | null;
};

function filterResults(
  results: RunResult[],
  options: FilterOptions
): RunResult[] {
  const { complexity, size, observationMode, successfulOnly } = options;
  return results.filter((r) => {
    if (complexity && r.config.complexity !== complexity) {
      return false;
    }
    if (size && `${r.config.width}x${r.config.height}` !== size) {
      return false;
    }
    if (observationMode && r.config.observationMode !== observationMode) {
      return false;
    }
    if (successfulOnly && !r.success) {
      return false;
    }
    return true;
  });
}

function computeStats(results: RunResult[]) {
  if (results.length === 0) {
    return { successRate: 0, avgSteps: 0, avgTime: 0, totalCost: 0, efficiencyScore: 0 };
  }
  const successfulRuns = results.filter((r) => r.success);
  const successes = successfulRuns.length;
  const totalSteps = results.reduce((acc, r) => acc + r.totalSteps, 0);
  const totalTime = results.reduce((acc, r) => acc + r.totalDurationMs, 0);
  const totalCost = results.reduce((acc, r) => acc + (r.cost ?? 0), 0);

  // Compute efficiency only for successful runs
  const successfulRunsWithEfficiency = successfulRuns.filter(
    (r) => r.efficiencyScore !== undefined && r.efficiencyScore > 0
  );
  const totalEfficiencyScore = successfulRunsWithEfficiency.reduce(
    (acc, r) => acc + (r.efficiencyScore ?? 0),
    0
  );
  const efficiencyScore =
    successfulRunsWithEfficiency.length === 0
      ? 0
      : totalEfficiencyScore / successfulRunsWithEfficiency.length;

  return {
    successRate: (successes / results.length) * 100,
    avgSteps: totalSteps / results.length,
    avgTime: totalTime / results.length,
    totalCost,
    efficiencyScore,
  };
}

export function ModelComparison({ reports }: ModelComparisonProps) {
  const complexityFilter = useAtomValue(complexityFilterAtom);
  const sizeFilter = useAtomValue(sizeFilterAtom);
  const observationModeFilter = useAtomValue(observationModeFilterAtom);
  const successfulOnly = useAtomValue(successfulOnlyAtom);

  const models = Array.from(reports.entries());

  const filterOptions: FilterOptions = {
    complexity: complexityFilter,
    size: sizeFilter,
    observationMode: observationModeFilter,
  };

  const sortedModels = models.sort((a, b) => {
    const aStats = computeStats(filterResults(a[1].results, filterOptions));
    const bStats = computeStats(filterResults(b[1].results, filterOptions));
    return bStats.successRate - aStats.successRate;
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sortedModels.map(([model, report]) => {
        const filtered = filterResults(report.results, {
          ...filterOptions,
          successfulOnly,
        });
        const stats = computeStats(filtered);

        const displayName = report.metadata.displayName ?? model;
        return (
          <Card key={model}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{displayName}</span>
                {successfulOnly ? null : (
                  <Badge
                    variant={stats.successRate > 50 ? "default" : "destructive"}
                  >
                    {stats.successRate.toFixed(1)}%
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Avg Steps:</span>
                  <span className="ml-2 font-mono">
                    {stats.avgSteps.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Time:</span>
                  <span className="ml-2 font-mono">
                    {(stats.avgTime / 1000).toFixed(2)}s
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="ml-2 font-mono">
                    ${stats.totalCost.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Efficiency:</span>
                  <span className="ml-2 font-mono">
                    {(stats.efficiencyScore * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
