import type { BenchmarkConfig } from "./types";

export const BENCHMARK_CONFIGS: BenchmarkConfig[] = [
  { width: 10, height: 10, complexity: "simple", vision: "local" },
  { width: 10, height: 10, complexity: "complex", vision: "local" },
  { width: 10, height: 10, complexity: "extreme", vision: "local" },

  { width: 10, height: 10, complexity: "simple", vision: "global" },
  { width: 10, height: 10, complexity: "complex", vision: "global" },
  { width: 10, height: 10, complexity: "extreme", vision: "global" },

  { width: 21, height: 21, complexity: "simple", vision: "local" },
  { width: 21, height: 21, complexity: "complex", vision: "local" },
  { width: 21, height: 21, complexity: "extreme", vision: "local" },

  { width: 21, height: 21, complexity: "simple", vision: "global" },
  { width: 21, height: 21, complexity: "complex", vision: "global" },
  { width: 21, height: 21, complexity: "extreme", vision: "global" },
];

export const RUNS_PER_CONFIG = 1;
export const CONCURRENCY_LIMIT = 40;
