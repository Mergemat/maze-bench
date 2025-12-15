"use client";

import { useState } from "react";
import {
  getLatestReportByModel,
  getUniqueComplexities,
  getUniqueSizes,
  getUniqueVisions,
} from "@/lib/data";
import type { BenchmarkReport, RunResult } from "@/lib/types";
import { PerformanceCharts } from "./charts";
import { Filters } from "./filters";
import { ModelComparison } from "./model-comparison";
import { RunList } from "./run-list";
import { RunReplicator } from "./run-replicator";

type DashboardProps = {
  reports: BenchmarkReport[];
};

export function Dashboard({ reports }: DashboardProps) {
  const [complexityFilter, setComplexityFilter] = useState<string | null>(null);
  const [sizeFilter, setSizeFilter] = useState<string | null>(null);
  const [visionFilter, setVisionFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunResult | null>(null);

  const latestReports = getLatestReportByModel(reports);
  const complexities = getUniqueComplexities(reports);
  const sizes = getUniqueSizes(reports);
  const visions = getUniqueVisions(reports);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-semibold text-xl">MazeBench</h1>
        <Filters
          complexities={complexities}
          onComplexityChange={setComplexityFilter}
          onSizeChange={setSizeFilter}
          onVisionChange={setVisionFilter}
          selectedComplexity={complexityFilter}
          selectedSize={sizeFilter}
          selectedVision={visionFilter}
          sizes={sizes}
          visions={visions}
        />
      </header>

      <section>
        <PerformanceCharts
          complexityFilter={complexityFilter}
          reports={latestReports}
          sizeFilter={sizeFilter}
          visionFilter={visionFilter}
        />
      </section>

      <section>
        <h2 className="mb-3 font-medium text-lg">Model Comparison</h2>
        <ModelComparison
          complexityFilter={complexityFilter}
          reports={latestReports}
          sizeFilter={sizeFilter}
          visionFilter={visionFilter}
        />
      </section>

      {selectedRun && (
        <section>
          <h2 className="mb-3 font-medium text-lg">Run Details</h2>
          <RunReplicator
            onClose={() => setSelectedRun(null)}
            open={!!selectedRun}
            run={selectedRun}
          />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-medium text-lg">Individual Runs</h2>
        <RunList
          complexityFilter={complexityFilter}
          onSelectRun={setSelectedRun}
          reports={latestReports}
          sizeFilter={sizeFilter}
          visionFilter={visionFilter}
        />
      </section>
    </div>
  );
}
