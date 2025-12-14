"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BenchmarkReport, RunResult } from "@/lib/types";

type ModelComparisonProps = {
  reports: Map<string, BenchmarkReport>;
  complexityFilter: string | null;
  sizeFilter: string | null;
  visionFilter: string | null;
};

function filterResults(
  results: RunResult[],
  complexity: string | null,
  size: string | null,
  vision: string | null
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

export function ModelComparison({
  reports,
  complexityFilter,
  sizeFilter,
  visionFilter,
}: ModelComparisonProps) {
  const models = Array.from(reports.entries());

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {models.map(([model, report]) => {
        const filtered = filterResults(
          report.results,
          complexityFilter,
          sizeFilter,
          visionFilter
        );
        const stats = computeStats(filtered);

        return (
          <Card key={model}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{model}</span>
                <Badge
                  variant={stats.successRate > 50 ? "default" : "destructive"}
                >
                  {stats.successRate.toFixed(1)}%
                </Badge>
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
