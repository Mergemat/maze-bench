import type { ModelKey } from "./models";

export type MazeComplexity = "simple" | "normal" | "complex" | "extreme";
export type VisionMode = "local" | "global";

export type Pos = { x: number; y: number };

export type BenchmarkConfig = {
  width: number;
  height: number;
  complexity: MazeComplexity;
  vision: VisionMode;
};

export type MazeEnv = {
  id: string;
  maze: string[];
  pos: Pos;
  steps: number;
  done: boolean;
  success: boolean;
  visionMode: VisionMode;
};

export type MazeData = {
  id: string;
  cfg: BenchmarkConfig;
  maze: string[];
  seed: number;
};

export type StepTrace = {
  step: number;
  action: "up" | "down" | "left" | "right";
  posBefore: Pos;
  posAfter: Pos;
  success: boolean;
  observation?: string;
  reasoning?: string;
};

export type RunResult = {
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
};

export type RunStatus = "pending" | "running" | "success" | "failed";

export type RunState = {
  mazeId: string;
  model: ModelKey;
  status: RunStatus;
  currentStep: number;
  error?: string;
  timeMs?: number;
  cost?: number;
};

export type BenchmarkStats = {
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
};

export type BenchmarkReport = {
  metadata: {
    model: ModelKey;
    date: string;
    seeds: number[];
    version: string;
    suite: string;
  };
  stats: BenchmarkStats;
  results: RunResult[];
};
