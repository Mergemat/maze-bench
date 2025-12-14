"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BenchmarkReport, RunResult } from "@/lib/types";

type RunListProps = {
  reports: Map<string, BenchmarkReport>;
  complexityFilter: string | null;
  sizeFilter: string | null;
  visionFilter: string | null;
  onSelectRun: (run: RunResult) => void;
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

export function RunList({
  reports,
  complexityFilter,
  sizeFilter,
  visionFilter,
  onSelectRun,
}: RunListProps) {
  const models = Array.from(reports.entries());

  return (
    <div className="w-full space-y-6">
      {models.map(([model, report]) => {
        const filtered = filterResults(
          report.results,
          complexityFilter,
          sizeFilter,
          visionFilter
        );

        return (
          <div className="space-y-2" key={model}>
            <h3 className="font-medium text-sm">{model}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((run) => (
                <Button
                  className="h-auto justify-start px-3 py-2 text-left"
                  key={run.id}
                  onClick={() => onSelectRun(run)}
                  variant="outline"
                >
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="text-[10px]" variant="outline">
                        {run.config.complexity}
                      </Badge>
                      <Badge className="text-[10px]" variant="outline">
                        {run.config.width}x{run.config.height}
                      </Badge>
                      <Badge className="text-[10px]" variant="outline">
                        {run.config.vision}
                      </Badge>
                      <Badge
                        className="text-[10px]"
                        variant={run.success ? "default" : "destructive"}
                      >
                        {run.success ? "✓" : "✗"}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {run.totalSteps} steps •{" "}
                      {(run.totalDurationMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
