export type Phase = "pickSuite" | "version" | "running" | "done";

export type SuiteChoice = {
  id: string;
  name: string;
  description?: string;
  // Put whatever you need here to generate mazes/config
  // e.g. mazeCount, difficulty, seedSet, etc.
};

export type ModelStats = {
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
};
