"use client";

import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  BenchmarkReport,
  MazeComplexity,
  ObservationMode,
  RunResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { successfulOnlyAtom } from "@/store/filters";
import { RunReplicator } from "./run-replicator";

interface RunListProps {
  reports: Map<string, BenchmarkReport>;
}

interface SizeGroup {
  size: string;
  runs: RunResult[];
}

const SIZE_LABELS: Record<string, string> = {
  "5x5": "Tiny",
  "11x11": "Small",
  "21x21": "Medium",
  "35x35": "Large",
};

const COMPLEXITY_ORDER: MazeComplexity[] = [
  "simple",
  "normal",
  "complex",
  "extreme",
];
const OBSERVATION_MODE_ORDER: ObservationMode[] = ["continuous", "initial"];

function getDisplayName(
  reports: Map<string, BenchmarkReport>,
  model: string | null
): string {
  if (!model) {
    return "";
  }
  const report = reports.get(model);
  return report?.metadata.displayName ?? model;
}

function groupBySize(results: RunResult[]): SizeGroup[] {
  const groups = new Map<string, RunResult[]>();

  for (const r of results) {
    const size = `${r.config.width}x${r.config.height}`;
    if (!groups.has(size)) {
      groups.set(size, []);
    }
    const group = groups.get(size);
    if (group) {
      group.push(r);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const [aw] = a.split("x").map(Number);
      const [bw] = b.split("x").map(Number);
      return aw - bw;
    })
    .map(([size, runs]) => ({ size, runs }));
}

function RunGrid({
  runs,
  complexity,
  observationMode,
  successfulOnly,
}: {
  runs: RunResult[];
  complexity: MazeComplexity | null;
  observationMode: ObservationMode | null;
  successfulOnly: boolean;
}) {
  const filtered = runs.filter((r) => {
    if (complexity && r.config.complexity !== complexity) {
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

  if (filtered.length === 0) {
    return <div className="text-muted-foreground text-xs">No runs</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {filtered.map((run) => (
        <RunReplicator key={run.id} run={run}>
          <Button
            className={cn(
              run.error ? "border-destructive/50" : "",
              run.success ? "border-primary/50" : ""
            )}
            title={run.error ?? `${run.totalSteps} steps`}
            variant={"outline"}
          >
            {run.error
              ? `${run.config.complexity} | ${run.config.observationMode} ERROR`
              : `${run.config.complexity} | ${run.config.observationMode} (${run.totalSteps})`}
          </Button>
        </RunReplicator>
      ))}
    </div>
  );
}

export function RunList({ reports }: RunListProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedComplexity, setSelectedComplexity] =
    useState<MazeComplexity | null>(null);
  const [selectedObservationMode, setSelectedObservationMode] =
    useState<ObservationMode | null>(null);

  const successfulOnly = useAtomValue(successfulOnlyAtom);

  const models = Array.from(reports.keys());
  const activeModel = selectedModel ?? models[0] ?? null;
  const report = activeModel ? reports.get(activeModel) : null;

  const sizeGroups = useMemo(
    () => (report ? groupBySize(report.results) : []),
    [report]
  );

  const complexities = useMemo(() => {
    if (!report) {
      return [];
    }
    const set = new Set<MazeComplexity>();
    for (const r of report.results) {
      set.add(r.config.complexity);
    }
    return COMPLEXITY_ORDER.filter((c) => set.has(c));
  }, [report]);

  const observationModes = useMemo(() => {
    if (!report) {
      return [];
    }
    const set = new Set<ObservationMode>();
    for (const r of report.results) {
      set.add(r.config.observationMode);
    }
    return OBSERVATION_MODE_ORDER.filter((v) => set.has(v));
  }, [report]);

  return (
    <div className="space-y-4">
      <Select
        onValueChange={(v) => setSelectedModel(v)}
        value={activeModel ?? ""}
      >
        <SelectTrigger className="w-48">
          <SelectValue>{getDisplayName(reports, activeModel)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {getDisplayName(reports, m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-4">
        <div className="space-y-1">
          <div className="font-medium text-muted-foreground text-xs">
            Complexity
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              onClick={() => setSelectedComplexity(null)}
              size="sm"
              variant={selectedComplexity === null ? "default" : "outline"}
            >
              all
            </Button>
            {complexities.map((c) => (
              <Button
                key={c}
                onClick={() => setSelectedComplexity(c)}
                size="sm"
                variant={selectedComplexity === c ? "default" : "outline"}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="font-medium text-muted-foreground text-xs">
            Observation
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              onClick={() => setSelectedObservationMode(null)}
              size="sm"
              variant={selectedObservationMode === null ? "default" : "outline"}
            >
              all
            </Button>
            {observationModes.map((v) => (
              <Button
                key={v}
                onClick={() => setSelectedObservationMode(v)}
                size="sm"
                variant={selectedObservationMode === v ? "default" : "outline"}
              >
                {v}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="font-medium text-muted-foreground text-xs">
          Runs (click to replay)
        </div>
        <div className="space-y-4">
          {sizeGroups.map(({ size, runs }) => (
            <div className="space-y-2" key={size}>
              <div className="font-medium text-sm">
                {SIZE_LABELS[size] ?? size}{" "}
                <span className="text-muted-foreground">({size})</span>
              </div>
              <RunGrid
                complexity={selectedComplexity}
                observationMode={selectedObservationMode}
                runs={runs}
                successfulOnly={successfulOnly}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
