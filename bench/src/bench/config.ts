import type { BenchmarkConfig } from "./types";

export const BENCHMARK_CONFIGS: BenchmarkConfig[] = [
  // Tiny (5x5) - Quick sanity check
  { width: 5, height: 5, complexity: "simple", vision: "local" },
  { width: 5, height: 5, complexity: "complex", vision: "local" },
  { width: 5, height: 5, complexity: "extreme", vision: "local" },
  { width: 5, height: 5, complexity: "simple", vision: "global" },
  { width: 5, height: 5, complexity: "complex", vision: "global" },
  { width: 5, height: 5, complexity: "extreme", vision: "global" },

  // Small (11x11) - Warmup challenge
  { width: 11, height: 11, complexity: "simple", vision: "local" },
  { width: 11, height: 11, complexity: "complex", vision: "local" },
  { width: 11, height: 11, complexity: "extreme", vision: "local" },
  { width: 11, height: 11, complexity: "simple", vision: "global" },
  { width: 11, height: 11, complexity: "complex", vision: "global" },
  { width: 11, height: 11, complexity: "extreme", vision: "global" },

  // Medium (21x21) - Real test
  { width: 21, height: 21, complexity: "simple", vision: "local" },
  { width: 21, height: 21, complexity: "complex", vision: "local" },
  { width: 21, height: 21, complexity: "extreme", vision: "local" },
  { width: 21, height: 21, complexity: "simple", vision: "global" },
  { width: 21, height: 21, complexity: "complex", vision: "global" },
  { width: 21, height: 21, complexity: "extreme", vision: "global" },

  // Large (35x35) - Serious challenge
  { width: 31, height: 31, complexity: "simple", vision: "local" },
  { width: 31, height: 31, complexity: "complex", vision: "local" },
  { width: 31, height: 31, complexity: "extreme", vision: "local" },
  { width: 31, height: 31, complexity: "simple", vision: "global" },
  { width: 31, height: 31, complexity: "complex", vision: "global" },
  { width: 31, height: 31, complexity: "extreme", vision: "global" },
];

export const RUNS_PER_CONFIG = 1;
export const CONCURRENCY_LIMIT = 40;
