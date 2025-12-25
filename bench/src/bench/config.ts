import type { BenchmarkConfig } from "./types";

export const BENCHMARK_CONFIGS: BenchmarkConfig[] = [
  { width: 7, height: 7, complexity: "simple", vision: "local" },
  { width: 7, height: 7, complexity: "complex", vision: "local" },
  { width: 7, height: 7, complexity: "simple", vision: "global" },
  { width: 7, height: 7, complexity: "complex", vision: "global" },

  { width: 21, height: 21, complexity: "simple", vision: "local" },
  { width: 21, height: 21, complexity: "complex", vision: "local" },
  { width: 21, height: 21, complexity: "simple", vision: "global" },
  { width: 21, height: 21, complexity: "complex", vision: "global" },

  { width: 41, height: 41, complexity: "simple", vision: "local" },
  { width: 41, height: 41, complexity: "complex", vision: "local" },

  { width: 41, height: 41, complexity: "simple", vision: "global" },
  { width: 41, height: 41, complexity: "complex", vision: "global" },
];

export const MAX_STEPS = 200;
export const RUNS_PER_CONFIG = 1;
export const CONCURRENCY_LIMIT = 40;
