"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BenchmarkReport, RunResult } from "@/lib/types";
import { Button } from "../ui/button";
import { RunReplicator } from "./run-replicator";

type RunListProps = {
  reports: Map<string, BenchmarkReport>;
  complexityFilter: string | null;
  sizeFilter: string | null;
  visionFilter: string | null;
  selectedModel: string | null;
  onModelChange: (model: string | null) => void;
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
  selectedModel,
  onModelChange,
}: RunListProps) {
  const models = Array.from(reports.keys());
  const activeModel = selectedModel ?? models[0] ?? null;
  const report = activeModel ? reports.get(activeModel) : null;
  const filtered = report
    ? filterResults(report.results, complexityFilter, sizeFilter, visionFilter)
    : [];

  return (
    <div className="space-y-3">
      <Select onValueChange={(v) => onModelChange(v)} value={activeModel ?? ""}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap gap-1">
        {filtered.map((run) => (
          <RunReplicator key={run.id} run={run}>
            <Button key={run.id} type="button" variant="outline">
              <span className="text-muted-foreground">
                {run.config.complexity}
              </span>
              <span className="text-muted-foreground">
                {run.config.width}x{run.config.height}
              </span>
              <span className="text-muted-foreground">{run.config.vision}</span>
              <Badge
                className="h-4 px-1 text-[9px]"
                variant={run.success ? "default" : "destructive"}
              >
                {run.success ? "✓" : "✗"}
              </Badge>
            </Button>
          </RunReplicator>
        ))}
      </div>
    </div>
  );
}
