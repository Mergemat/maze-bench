export type Phase = "pickSuite" | "pickModels" | "running" | "done";

export interface SuiteChoice {
  id: string;
  name: string;
  description?: string;
}

export interface ModelStats {
  total: number;

  executedStarted: number;
  executedDone: number;
  executedErrors: number;

  durationSumMs: number;
  maxDurationMs: number;

  correctCount: number;
  incorrectCount: number;

  costSum: number;
  completionTokensSum: number;

  // Error tracking
  lastError?: string;
  errorCategories: Record<string, number>;
}

export interface RecentError {
  model: string;
  error: string;
  timestamp: number;
}
