import { PerformanceCharts } from "@/components/benchmark/charts";
import { Filters } from "@/components/benchmark/filters";
import { ModelComparison } from "@/components/benchmark/model-comparison";
import { RunList } from "@/components/benchmark/run-list";
import { SuccessfulOnlyToggle } from "@/components/benchmark/successful-only-toggle";
import {
  getLatestReportByModel,
  getUniqueComplexities,
  getUniqueSizes,
  getUniqueVisions,
} from "@/lib/data";
import { loadBenchmarkReports } from "@/lib/loader";

export default async function Page() {
  const reports = await loadBenchmarkReports();

  const latestReports = getLatestReportByModel(reports);
  const complexities = getUniqueComplexities(reports);
  const sizes = getUniqueSizes(reports);
  const visions = getUniqueVisions(reports);

  return (
    <main className="container relative mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col justify-between gap-5 sm:flex-row">
          <div className="flex flex-col gap-1">
            <h1 className="font-semibold text-xl">MazeBench</h1>
            <p className="text-muted-foreground text-sm">
              Benchmark measuring how well AI models solve mazes. Models are
              given a maze and must find a way out using a move tool.
            </p>
          </div>
          <div className="flex w-fit sm:items-center sm:justify-end">
            <Filters
              complexities={complexities}
              sizes={sizes}
              visions={visions}
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
            <h2 className="mb-3 font-medium text-lg">Individual Runs</h2>
            <RunList reports={latestReports} />
          </section>
        </div>
      </div>
    </main>
  );
}
