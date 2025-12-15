"use client";

import { useState } from "react";
import {
  getLatestReportByModel,
  getUniqueComplexities,
  getUniqueSizes,
  getUniqueVisions,
} from "@/lib/data";
import type { BenchmarkReport } from "@/lib/types";
import { PerformanceCharts } from "./charts";
import { Filters } from "./filters";
import { ModelComparison } from "./model-comparison";
import { RunList } from "./run-list";

type DashboardProps = {
  reports: BenchmarkReport[];
};

export function Dashboard({ reports }: DashboardProps) {
  const [complexityFilter, setComplexityFilter] = useState<string | null>(null);
  const [sizeFilter, setSizeFilter] = useState<string | null>(null);
  const [visionFilter, setVisionFilter] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const latestReports = getLatestReportByModel(reports);
  const complexities = getUniqueComplexities(reports);
  const sizes = getUniqueSizes(reports);
  const visions = getUniqueVisions(reports);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between sm:flex-row gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-xl">MazeBench</h1>
          <p className="text-muted-foreground text-sm">
            Benchmark measuring how well AI models solve mazes. Models are given
            a maze and must find a way out using a move tool.
          </p>
        </div>
        <div className="flex sm:items-center sm:justify-end">
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
        </div>
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

      <section>
        <h2 className="mb-3 font-medium text-lg">Individual Runs</h2>
        <RunList
          complexityFilter={complexityFilter}
          onModelChange={setSelectedModel}
          reports={latestReports}
          selectedModel={selectedModel}
          sizeFilter={sizeFilter}
          visionFilter={visionFilter}
        />
      </section>
    </div>
  );
}
