"use client";

import { useAtomValue } from "jotai";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BenchmarkReport, RunResult } from "@/lib/types";
import { formatModelName } from "@/lib/utils";
import {
  complexityFilterAtom,
  sizeFilterAtom,
  successfulOnlyAtom,
  visionFilterAtom,
} from "@/store/filters";
import { Button } from "../ui/button";
import { RunReplicator } from "./run-replicator";

type RunListProps = {
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

export function RunList({ reports }: RunListProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const complexityFilter = useAtomValue(complexityFilterAtom);
  const sizeFilter = useAtomValue(sizeFilterAtom);
  const visionFilter = useAtomValue(visionFilterAtom);
  const successfulOnly = useAtomValue(successfulOnlyAtom);

  const models = Array.from(reports.keys());
  const activeModel = selectedModel ?? models[0] ?? null;
  const report = activeModel ? reports.get(activeModel) : null;
  const filtered = report
    ? filterResults(
        report.results,
        complexityFilter,
        sizeFilter,
        visionFilter,
        successfulOnly
      )
    : [];

  return (
    <div className="space-y-3">
      <Select
        onValueChange={(v) => setSelectedModel(v)}
        value={activeModel ?? ""}
      >
        <SelectTrigger className="w-48">
          <SelectValue>{formatModelName(activeModel)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {formatModelName(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap gap-2 xl:h-60 2xl:h-52">
        {filtered.map((run) => (
          <RunReplicator key={run.id} run={run}>
            <Button key={run.id} type="button" variant="outline" title={run.error ?? undefined}>
              <span className="text-muted-foreground">
                {run.config.complexity}
              </span>
              <span className="text-muted-foreground">
                {run.config.width}x{run.config.height}
              </span>
              <span className="text-muted-foreground">{run.config.vision}</span>
              <span className="text-muted-foreground">
                | {run.totalSteps} steps
              </span>
              {run.error ? (
                <Badge
                  className="h-4 px-1 text-[9px]"
                  variant="destructive"
                >
                  ERROR
                </Badge>
              ) : (
                <Badge
                  className="h-4 px-1 text-[9px]"
                  variant={run.success ? "default" : "destructive"}
                >
                  {run.success ? "✓" : "✗"}
                </Badge>
              )}
            </Button>
          </RunReplicator>
        ))}
      </div>
    </div>
  );
}
