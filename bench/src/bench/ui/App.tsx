import { Box, render } from "ink";
import type { FC } from "react";
import {
  DoneBanner,
  Header,
  ModelSelector,
  ProgressBar,
  RecentErrors,
  ResultsTable,
  StatsSummary,
  SuiteSelector,
} from "./components";
import { useBenchmarkRunner } from "./useBenchmarkRunner";

const App: FC = () => {
  const {
    phase,
    setPhase,
    suites,
    selectedSuiteId,
    setSelectedSuiteId,
    allModels,
    selectedModels,
    existingResults,
    toggleModel,
    confirmModels,
    modelOrder,
    stats,
    total,
    completed,
    errors,
    runningCount,
    totalCost,
    recentErrors,
    finalStats,
  } = useBenchmarkRunner();

  // Suite selection phase
  if (phase === "pickSuite") {
    return (
      <SuiteSelector
        onSelect={(id) => {
          setSelectedSuiteId(id);
          setPhase("pickModels");
        }}
        suites={suites}
      />
    );
  }

  // Model selection phase
  if (phase === "pickModels") {
    return (
      <ModelSelector
        existingResults={existingResults}
        models={allModels}
        onConfirm={confirmModels}
        onToggle={toggleModel}
        selectedModels={selectedModels}
      />
    );
  }

  // Calculate overall stats
  const overallAnswered = modelOrder.reduce((acc, m) => {
    const s = stats[m];
    return acc + (s ? s.correctCount + s.incorrectCount : 0);
  }, 0);

  const overallCorrect = modelOrder.reduce((acc, m) => {
    const s = stats[m];
    return acc + (s ? s.correctCount : 0);
  }, 0);

  const overallPct =
    overallAnswered > 0
      ? Math.round((overallCorrect / overallAnswered) * 100)
      : null;

  const overallAvgSec = (() => {
    let sum = 0;
    let denom = 0;
    for (const m of modelOrder) {
      const s = stats[m];
      if (!s) {
        continue;
      }
      const c = s.executedDone + s.executedErrors;
      sum += s.durationSumMs;
      denom += c;
    }
    return denom > 0 ? sum / denom / 1000 : null;
  })();

  // Running or Done phase
  return (
    <Box flexDirection="column">
      <Header
        subtitle={`Suite: ${selectedSuiteId}`}
        title={
          phase === "running" ? "Running Benchmark..." : "Benchmark Complete"
        }
      />

      <ResultsTable modelOrder={modelOrder} stats={stats} />

      <Box marginTop={1}>
        <ProgressBar completed={completed} total={total} />
      </Box>

      <StatsSummary
        completed={completed}
        errors={errors}
        overallAvgSec={overallAvgSec}
        overallPct={overallPct}
        runningCount={runningCount}
        total={total}
        totalCost={totalCost}
      />

      <RecentErrors errors={recentErrors} />

      {phase === "done" && finalStats && (
        <DoneBanner
          successRate={finalStats.overall.successRate * 100}
          suiteId={selectedSuiteId ?? ""}
        />
      )}
    </Box>
  );
};

export function startApp() {
  render(<App />);
}
