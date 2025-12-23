export type MazeComplexity = "simple" | "normal" | "complex" | "extreme";
export type VisionMode = "local" | "global";

export type Pos = { x: number; y: number };

export type BenchmarkConfig = {
  width: number;
  height: number;
  complexity: MazeComplexity;
  vision: VisionMode;
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
  model: string;
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
    model: string;
    date: string;
    seeds: number[];
  };
  stats: BenchmarkStats;
  results: RunResult[];
};
