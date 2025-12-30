import { GithubIcon, NewTwitterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { PerformanceCharts } from "@/components/benchmark/charts";
import { Filters } from "@/components/benchmark/filters";
import { ModelComparison } from "@/components/benchmark/model-comparison";
import { RunList } from "@/components/benchmark/run-list";
import { SuccessfulOnlyToggle } from "@/components/benchmark/successful-only-toggle";
import {
  getLatestReportByModel,
  getUniqueComplexities,
  getUniqueSizes,
  getUniqueObservationModes,
} from "@/lib/data";
import { loadBenchmarkReports } from "@/lib/loader";

export default async function Page() {
  const reports = await loadBenchmarkReports();

  const latestReports = getLatestReportByModel(reports);
  const complexities = getUniqueComplexities(reports);
  const sizes = getUniqueSizes(reports);
  const observationModes = getUniqueObservationModes(reports);

  return (
    <main className="container relative mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col justify-between gap-5 sm:flex-row">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-4">
              <h1 className="font-semibold text-xl">MazeBench</h1>
              <Link
                href="https://github.com/Mergemat/maze-bench"
                rel="noopener noreferrer"
                target="_blank"
              >
                <HugeiconsIcon className="h-5 w-5" icon={GithubIcon} />
                <span className="sr-only">GitHub</span>
              </Link>
              <Link
                href="https://x.com/bagase_k/status/2000226914636533913"
                rel="noopener noreferrer"
                target="_blank"
              >
                <HugeiconsIcon className="h-5 w-5" icon={NewTwitterIcon} />
                <span className="sr-only">X</span>
              </Link>
            </div>
            <p className="text-muted-foreground text-sm">
              Benchmark measuring how well AI models solve mazes. Models are
              given a maze and must find a way out using a tool call.
            </p>
            <p className="text-muted-foreground text-xs italic">
              More models coming soon™ (when I have money)
            </p>
          </div>
          <div className="flex w-fit sm:items-center sm:justify-end">
            <Filters
              complexities={complexities}
              sizes={sizes}
              observationModes={observationModes}
            />
          </div>
        </header>

        <section>
          <PerformanceCharts reports={latestReports} />
        </section>

        <div className="mt-4 flex flex-col gap-6 bg-secondary p-4 sm:p-6">
          <section>
            <div className="flex justify-between">
              <h2 className="mb-3 font-medium text-lg">Model Comparison</h2>
              <SuccessfulOnlyToggle />
            </div>
            <ModelComparison reports={latestReports} />
          </section>

          <section>
            <h2 className="mb-3 font-medium text-lg">Individual Runs </h2>
            <RunList reports={latestReports} />
          </section>
        </div>
      </div>
    </main>
  );
}
