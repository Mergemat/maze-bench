import { useApp } from "ink";
import { useEffect, useMemo, useState } from "react";
import { CONCURRENCY_LIMIT } from "../config";
import {
  type ModelKey,
  getAllModels,
  getModelKey,
  MODELS,
  rebuildModels,
  setModelEnabled,
} from "../models";

import { runSingleMaze, type BenchError } from "../runner";
import { IncrementalResultSaver } from "../save";
import { computeStats } from "../stats";
import { generateMazesForSuite, getSuites } from "../suites";
import type { BenchmarkStats, MazeData, RunResult } from "../types";
import {
  runWithConcurrency,
  updateErrorStats,
  updateSuccessStats,
} from "./runnerUtils";
import type { ModelStats, Phase, RecentError } from "./types";

// Regex for extracting error category - defined at module level for performance
const ERROR_CATEGORY_REGEX = /^\[(\w+)\]/;

function createEmptyModelStats(total: number): ModelStats {
  return {
    total,
    executedStarted: 0,
    executedDone: 0,
    executedErrors: 0,
    durationSumMs: 0,
    maxDurationMs: 0,
    correctCount: 0,
    incorrectCount: 0,
    costSum: 0,
    completionTokensSum: 0,
    errorCategories: {},
  };
}

export function useBenchmarkRunner() {
  const { exit } = useApp();

  const suites = useMemo(() => getSuites(), []);
  const allModels = useMemo(() => getAllModels(), []);

  const [phase, setPhase] = useState<Phase>("pickSuite");
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(() => {
    // Initialize with currently enabled models
    const enabled = new Set<string>();
    for (const def of allModels) {
      if (def.enabled) {
        enabled.add(getModelKey(def));
      }
    }
    return enabled;
  });

  const [modelOrder, setModelOrder] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, ModelStats>>({});
  const [total, setTotal] = useState(0);

  const [completed, setCompleted] = useState(0);
  const [errors, setErrors] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([]);

  const [finalStats, setFinalStats] = useState<BenchmarkStats | null>(null);

  // Toggle model selection
  const toggleModel = (modelKey: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelKey)) {
        next.delete(modelKey);
      } else {
        next.add(modelKey);
      }
      return next;
    });
  };

  // Confirm model selection and update MODELS
  const confirmModels = () => {
    // Update enabled status for all models
    for (const def of allModels) {
      const key = getModelKey(def);
      setModelEnabled(key, selectedModels.has(key));
    }
    // Rebuild MODELS object with updated enabled states
    rebuildModels();
    // Skip version input phase - use auto-generated timestamp
    setPhase("running");
  };

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

      // Get enabled model keys
      const models = Object.keys(MODELS) as ModelKey[];
      if (models.length === 0) {
        console.error("No models enabled!");
        exit();
        return;
      }

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
      setRecentErrors([]);
      setFinalStats(null);

      // Init per-model stats
      const initialStats: Record<string, ModelStats> = {};
      for (const name of models) {
        initialStats[name] = createEmptyModelStats(mazes.length);
      }
      setStats(initialStats);

      const allResults: RunResult[] = [];

      // Create incremental savers for each model
      const savers = new Map<ModelKey, IncrementalResultSaver>();
      for (const model of models) {
        savers.set(
          model,
          new IncrementalResultSaver({
            model,
            suiteId: suite.id,
            seeds: mazes.map((m) => m.seed),
          })
        );
      }

      await runWithConcurrency(
        tasks,
        CONCURRENCY_LIMIT,
        async ({ model, maze }) => {
          const startedAt = Date.now();

          setStats((prev) => {
            const prevStats = prev[model];
            if (!prevStats) {
              return prev;
            }
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
            result = await runSingleMaze(
              model,
              maze,
              () => {
                // Per-step callback if needed
              },
              (error: BenchError, attempt: number, delayMs: number) => {
                // Retry callback - track retries
                setRecentErrors((prev) => [
                  ...prev.slice(-9),
                  {
                    model,
                    error: `[Retry ${attempt}] ${error.message} (waiting ${Math.round(delayMs / 1000)}s)`,
                    timestamp: Date.now(),
                  },
                ]);
              }
            );
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

          // Save result incrementally to file as it comes in
          const saver = savers.get(model);
          if (saver) {
            saver.addResult(result);
          }

          if (result.success) {
            setStats((prev) => {
              const prevStats = prev[model];
              if (!prevStats) {
                return prev;
              }
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
              if (!prevStats) {
                return prev;
              }
              const updates = updateErrorStats(prevStats, result);

              // Track error category
              const errorCategories = { ...prevStats.errorCategories };
              if (result.error) {
                const match = ERROR_CATEGORY_REGEX.exec(result.error);
                const category = match?.[1] ?? "unknown";
                errorCategories[category] =
                  (errorCategories[category] ?? 0) + 1;
              }

              return {
                ...prev,
                [model]: {
                  ...prevStats,
                  ...updates,
                  lastError: result.error,
                  errorCategories,
                },
              };
            });

            if (result.error) {
              setErrors((e) => e + 1);
              const errorMessage = result.error;
              setRecentErrors((prev) => [
                ...prev.slice(-9),
                {
                  model,
                  error: errorMessage,
                  timestamp: Date.now(),
                },
              ]);
            }
          }

          // Global counters
          setCompleted((c) => c + 1);
          setRunningCount((r) => Math.max(0, r - 1));
          setTotalCost((c) => c + (result.cost ?? 0));
        }
      );

      if (cancelled) {
        return;
      }

      setFinalStats(computeStats(allResults));
      setPhase("done");

      // Exit after completion
      exit();
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, selectedSuiteId, suites, exit]);

  return {
    phase,
    setPhase,
    suites,
    selectedSuiteId,
    setSelectedSuiteId,
    allModels,
    selectedModels,
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
  };
}
