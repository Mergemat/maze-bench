"use client";

import { useAtomValue } from "jotai";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BenchmarkReport, RunResult } from "@/lib/types";
import { formatModelName } from "@/lib/utils";
import {
  complexityFilterAtom,
  sizeFilterAtom,
  successfulOnlyAtom,
  visionFilterAtom,
} from "@/store/filters";

type ModelComparisonProps = {
  reports: Map<string, BenchmarkReport>;
};

function filterResults(
  results: RunResult[],
  complexity: string | null,
  size: string | null,
  vision: string | null,
  successfulOnly?: boolean | null
): RunResult[] {
  return results.filter((r) => {
    if (complexity && r.config.complexity !== complexity) {
      return false;
    }
    if (size && `${r.config.width}x${r.config.height}` !== size) {
      return false;
    }
    if (vision && r.config.vision !== vision) {
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
    return { successRate: 0, avgSteps: 0, avgTime: 0, totalCost: 0 };
  }
  const successes = results.filter((r) => r.success).length;
  const totalSteps = results.reduce((acc, r) => acc + r.totalSteps, 0);
  const totalTime = results.reduce((acc, r) => acc + r.totalDurationMs, 0);
  const totalCost = results.reduce((acc, r) => acc + (r.cost ?? 0), 0);

  return {
    successRate: (successes / results.length) * 100,
    avgSteps: totalSteps / results.length,
    avgTime: totalTime / results.length,
    totalCost,
  };
}

export function ModelComparison({ reports }: ModelComparisonProps) {
  const complexityFilter = useAtomValue(complexityFilterAtom);
  const sizeFilter = useAtomValue(sizeFilterAtom);
  const visionFilter = useAtomValue(visionFilterAtom);
  const successfulOnly = useAtomValue(successfulOnlyAtom);

  const models = Array.from(reports.entries());

  const sortedModels = models.sort((a, b) => {
    const aStats = computeStats(
      filterResults(a[1].results, complexityFilter, sizeFilter, visionFilter)
    );
    const bStats = computeStats(
      filterResults(b[1].results, complexityFilter, sizeFilter, visionFilter)
    );
    return bStats.successRate - aStats.successRate;
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sortedModels.map(([model, report]) => {
        const filtered = filterResults(
          report.results,
          complexityFilter,
          sizeFilter,
          visionFilter,
          successfulOnly
        );
        const stats = computeStats(filtered);

        return (
          <Card key={model}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{formatModelName(model)}</span>
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
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Runs:</span>
                  <span className="ml-2 font-mono">{filtered.length}</span>
                </div>
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
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
