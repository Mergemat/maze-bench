import type { ModelKey } from "./models";

export type MazeComplexity = "simple" | "normal" | "complex" | "extreme";
export type VisionMode = "local" | "global";

export interface Pos {
  x: number;
  y: number;
}

export interface BenchmarkConfig {
  width: number;
  height: number;
  complexity: MazeComplexity;
  vision: VisionMode;
}

export interface MazeEnv {
  id: string;
  maze: string[];
  pos: Pos;
  steps: number;
  done: boolean;
  success: boolean;
  visionMode: VisionMode;
}

export interface MazeData {
  id: string;
  cfg: BenchmarkConfig;
  maze: string[];
  seed: number;
  optimalPathLength: number; // Pre-computed optimal path length for efficiency scoring
}

export interface StepTrace {
  step: number;
  action: "up" | "down" | "left" | "right";
  posBefore: Pos;
  posAfter: Pos;
  success: boolean;
  observation?: string;
  reasoning?: string;
}

export interface RunResult {
  id: string;
  timestamp: string;
  config: BenchmarkConfig;
  model: ModelKey;
  maze: string[];
  startPos: Pos;
  goalPos: Pos;
  seed: number;
  success: boolean;
  totalSteps: number;
  totalDurationMs: number;
  cost?: number;
  stepsTrace: StepTrace[];
  lastObservation?: string;
  error?: string;
  optimalPathLength: number;
  efficiencyScore: number; // optimalPathLength / totalSteps (0 if failed or unreachable)
}

export type RunStatus = "pending" | "running" | "success" | "failed";

export interface RunState {
  mazeId: string;
  model: ModelKey;
  status: RunStatus;
  currentStep: number;
  error?: string;
  timeMs?: number;
  cost?: number;
}

export interface BenchmarkStats {
  overall: {
    successRate: number;
    avgSteps: number;
    avgTimeMs: number;
    totalCost: number;
  };
  byConfig: Record<
    string,
    {
      successRate: number;
      avgSteps: number;
      avgTimeMs: number;
      totalCost: number;
      n: number;
    }
  >;
}

export interface BenchmarkReport {
  metadata: {
    model: ModelKey;
    displayName: string;
    creator: string;
    date: string;
    seeds: number[];
    suite: string;
  };
  stats: BenchmarkStats;
  results: RunResult[];
}
