import { Box, render, Text } from "ink";
import React from "react";
import {
  ProgressBar,
  ResultsTable,
  SuiteSelector,
  VersionInput,
} from "./components";
import { useBenchmarkRunner } from "./useBenchmarkRunner";
import { pctColor } from "./utils";

const App: React.FC = () => {
  const {
    phase,
    setPhase,
    suites,
    selectedSuiteId,
    setSelectedSuiteId,
    version,
    setVersion,
    modelOrder,
    stats,
    total,
    completed,
    errors,
    runningCount,
    totalCost,
    finalStats,
  } = useBenchmarkRunner();

  if (phase === "pickSuite") {
    return (
      <SuiteSelector
        suites={suites}
        onSelect={(id) => {
          setSelectedSuiteId(id);
          setPhase("version");
        }}
      />
    );
  }

  if (phase === "version") {
    return (
      <VersionInput
        version={version}
        onChange={setVersion}
        onSubmit={() => setPhase("running")}
      />
    );
  }

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

  return (
    <Box flexDirection="column">
      <Text>
        {phase === "running" ? "Running" : "Done"} suite{" "}
        <Text color="magentaBright">{selectedSuiteId}</Text> @ version{" "}
        <Text color="cyan">{version}</Text>
      </Text>

      <ResultsTable modelOrder={modelOrder} stats={stats} />

      <Box marginTop={1}>
        <ProgressBar completed={completed} total={total} />
      </Box>

      <Box marginTop={1}>
        <Text>
          Overall: <Text color="green">{completed}</Text>/
          <Text color="white">{total}</Text> done •{" "}
          <Text color={overallPct === null ? "gray" : pctColor(overallPct)}>
            {overallPct === null ? "-" : `${overallPct}%`}
          </Text>{" "}
          correct • <Text color="red">{errors || "-"}</Text> errors •{" "}
          <Text color="yellow">{runningCount || "-"}</Text> running •{" "}
          <Text color={overallAvgSec === null ? "gray" : "cyan"}>
            {overallAvgSec === null ? "-" : `${overallAvgSec.toFixed(2)}s`}
          </Text>{" "}
          avg duration • <Text color="green">${totalCost.toFixed(4)}</Text>{" "}
          total cost
        </Text>
      </Box>

      {phase === "done" && finalStats && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">
            Final stats computed (hook your StatsDisplay here).
          </Text>
          {/* If you want, render your existing <StatsDisplay stats={finalStats} /> */}
        </Box>
      )}
    </Box>
  );
};

export function startApp() {
  render(<App />);
}
