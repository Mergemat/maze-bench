export type MazeComplexity = "simple" | "normal" | "complex" | "extreme";
// continuous: model receives observation after every move
// initial: model only sees the maze once at the start
export type ObservationMode = "continuous" | "initial";

export interface Pos {
  x: number;
  y: number;
}

export interface BenchmarkConfig {
  width: number;
  height: number;
  complexity: MazeComplexity;
  observationMode: ObservationMode;
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
  optimalPathLength?: number;
  efficiencyScore?: number;
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
    model: string;
    displayName?: string;
    creator?: string;
    date: string;
    version?: string;
    suite?: string;
    seeds: number[];
  };
  stats: BenchmarkStats;
  results: RunResult[];
}
