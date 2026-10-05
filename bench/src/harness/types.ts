import type { Scored, Usage } from "@mazebench/core";
import type { SpendGuard } from "./guard.ts";
import type { RetryOptions } from "./retry.ts";

/** What one attempt at one item produced, before it is written to the results file. */
export interface Attempt {
  status: "scored" | "error";
  scored: Scored;
  answer?: { text: string; parse: "ok" | "fallback" | "failed"; value: unknown };
  usage: Usage;
  calls: number;
  providers: string[];
  latencyMs: number;
  finishReason?: string;
  error?: { category: string; message: string };
}

export interface CallOptions {
  maxOutputTokens: number;
  /** Per model call. Reasoning models can think for minutes on large mazes. */
  timeoutMs: number;
  onRetry?: (message: string) => void;
  /** Overrides for tests. */
  retry?: Omit<RetryOptions, "onRetry">;
  /** Shared spending cap; the episode stops once it trips. */
  guard?: SpendGuard;
}

/** Keep the end of long replies: that is where the answer line is. */
export function clip(text: string, max = 4000): string {
  return text.length <= max ? text : `…${text.slice(text.length - max)}`;
}

export function errorScored(): Scored {
  return { score: 0, outcome: "stalled", metrics: {} };
}
