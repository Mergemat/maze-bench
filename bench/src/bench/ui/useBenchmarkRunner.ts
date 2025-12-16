import { useApp } from "ink";
import { useEffect, useMemo, useState } from "react";
import { CONCURRENCY_LIMIT } from "../config";
import { MODELS } from "../models";
import type { ModelKey } from "../models";
import { runSingleMaze } from "../runner";
import { computeStats } from "../stats";
import { generateMazesForSuite, getSuites } from "../suites";
import type { BenchmarkStats, MazeData, RunResult } from "../types";
import {
  runWithConcurrency,
  saveModelResults,
  updateErrorStats,
  updateSuccessStats,
} from "./runnerUtils";
import type { ModelStats, Phase } from "./types";
import { formatDefaultVersion } from "./utils";
import { enhanceResultsWithOptimalPaths } from "../optimal-paths-utils";

export function useBenchmarkRunner() {
  const { exit } = useApp();

  const suites = useMemo(() => getSuites(), []);
  const models = useMemo(() => Object.keys(MODELS) as ModelKey[], []);

  const [phase, setPhase] = useState<Phase>("pickSuite");
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [version, setVersion] = useState(formatDefaultVersion());

  const [modelOrder, setModelOrder] = useState<string[]>(models);
  const [stats, setStats] = useState<Record<string, ModelStats>>({});
  const [total, setTotal] = useState(0);

  const [completed, setCompleted] = useState(0);
  const [errors, setErrors] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  const [finalStats, setFinalStats] = useState<BenchmarkStats | null>(null);

  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    if (!selectedSuiteId) {
      return;
    }

    const suite = suites.find((s) => s.id === selectedSuiteId);
    if (!suite) {
      return;
    }

    let cancelled = false;

    (async () => {
      const mazes = generateMazesForSuite(suite);

      const tasks: Array<{ model: ModelKey; maze: MazeData }> = [];
      for (const model of models) {
        for (const maze of mazes) {
          tasks.push({ model, maze });
        }
      }

      if (cancelled) {
        return;
      }

      setModelOrder(models);
      setTotal(tasks.length);
      setCompleted(0);
      setErrors(0);
      setRunningCount(0);
      setTotalCost(0);
      setFinalStats(null);

      // init per-model stats
      setStats(
        models.reduce(
          (acc, name) => {
            acc[name] = {
              total: mazes.length,
              executedStarted: 0,
              executedDone: 0,
              executedErrors: 0,
              durationSumMs: 0,
              maxDurationMs: 0,
              correctCount: 0,
              incorrectCount: 0,
              costSum: 0,
              completionTokensSum: 0,
            };
            return acc;
          },
          {} as Record<string, ModelStats>
        )
      );

      const allResults: RunResult[] = [];

      // for per-model save
      const resultsByModel = new Map<ModelKey, RunResult[]>();
      const savedModels = new Set<ModelKey>();
      const mazesPerModel = mazes.length;

      await runWithConcurrency(
        tasks,
        CONCURRENCY_LIMIT,
        async ({ model, maze }) => {
          const startedAt = Date.now();

          setStats((prev) => {
            const prevStats = prev[model];
            if (!prevStats) return prev;
            return {
              ...prev,
              [model]: {
                ...prevStats,
                executedStarted: prevStats.executedStarted + 1,
              },
            };
          });
          setRunningCount((r) => r + 1);

          let result: RunResult;
          try {
            result = await runSingleMaze(model, maze, () => {
              // you can still wire per-step UI separately if you want
            });
          } catch (e) {
            // If runSingleMaze throws instead of returning { success:false }
            result = {
              model,
              mazeId: maze.id,
              success: false,
              error: (e as Error).message,
              totalDurationMs: Date.now() - startedAt,
              cost: undefined,
            } as unknown as RunResult;
          }

          allResults.push(result);

          if (!resultsByModel.has(model)) {
            resultsByModel.set(model, []);
          }
          resultsByModel.get(model)?.push(result);

          if (result.success) {
            setStats((prev) => {
              const prevStats = prev[model];
              if (!prevStats) return prev;
              return {
                ...prev,
                [model]: {
                  ...prevStats,
                  ...updateSuccessStats(prevStats, result),
                },
              };
            });
          } else {
            setStats((prev) => {
              const prevStats = prev[model];
              if (!prevStats) return prev;
              return {
                ...prev,
                [model]: {
                  ...prevStats,
                  ...updateErrorStats(prevStats, result),
                },
              };
            });
            if (result.error) {
              setErrors((e) => e + 1);
            }
          }

          // global counters
          setCompleted((c) => c + 1);
          setRunningCount((r) => Math.max(0, r - 1));
          setTotalCost((c) => c + (result.cost ?? 0));

          const modelResults = resultsByModel.get(model);
          if (
            !savedModels.has(model) &&
            modelResults &&
            modelResults.length === mazesPerModel
          ) {
            savedModels.add(model);
            saveModelResults({
              model,
              version,
              suite,
              mazes,
              results: modelResults,
            });
          }
        }
      );

      if (cancelled) {
        return;
      }

      setFinalStats(computeStats(allResults));
      setPhase("done");

      // Enhance results with optimal paths
      console.log("\nEnhancing results with optimal paths...");
      enhanceResultsWithOptimalPaths();

      // if you want it to "stay open", remove this:
      exit();
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, selectedSuiteId, version, suites, models, exit]);

  return {
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
  };
}
