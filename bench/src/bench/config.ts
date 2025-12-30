import type { BenchmarkConfig } from "./types";

export const BENCHMARK_CONFIGS: BenchmarkConfig[] = [
  { width: 5, height: 5, complexity: "simple", observationMode: "continuous" },
  { width: 5, height: 5, complexity: "simple", observationMode: "initial" },

  {
    width: 11,
    height: 11,
    complexity: "simple",
    observationMode: "continuous",
  },
  {
    width: 11,
    height: 11,
    complexity: "complex",
    observationMode: "continuous",
  },
  { width: 11, height: 11, complexity: "simple", observationMode: "initial" },
  { width: 11, height: 11, complexity: "complex", observationMode: "initial" },

  {
    width: 21,
    height: 21,
    complexity: "simple",
    observationMode: "continuous",
  },
  {
    width: 21,
    height: 21,
    complexity: "complex",
    observationMode: "continuous",
  },
  {
    width: 21,
    height: 21,
    complexity: "extreme",
    observationMode: "continuous",
  },
  { width: 21, height: 21, complexity: "simple", observationMode: "initial" },
  { width: 21, height: 21, complexity: "complex", observationMode: "initial" },
  { width: 21, height: 21, complexity: "extreme", observationMode: "initial" },

  {
    width: 31,
    height: 31,
    complexity: "simple",
    observationMode: "continuous",
  },
  {
    width: 31,
    height: 31,
    complexity: "complex",
    observationMode: "continuous",
  },
  {
    width: 31,
    height: 31,
    complexity: "extreme",
    observationMode: "continuous",
  },
  { width: 31, height: 31, complexity: "simple", observationMode: "initial" },
  { width: 31, height: 31, complexity: "complex", observationMode: "initial" },
  { width: 31, height: 31, complexity: "extreme", observationMode: "initial" },
];

export const RUNS_PER_CONFIG = 1;
export const CONCURRENCY_LIMIT = 40;
