import {
  generateText,
  type LanguageModel,
  type StopCondition,
  type ToolSet,
  tool,
} from "ai";
import z from "zod";
import { createMazeEnv, getObservation, moveInMaze } from "./maze";
import type { ModelKey } from "./models";
import { MODELS } from "./models";
import type { MazeData, MazeEnv, RunResult, StepTrace } from "./types";

// Error categories for better handling
export const ErrorCategory = {
  Network: "network",
  RateLimit: "rate_limit",
  Timeout: "timeout",
  ServerError: "server_error",
  InvalidResponse: "invalid_response",
  Unknown: "unknown",
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

export interface BenchError extends Error {
  category: ErrorCategory;
  retryable: boolean;
  statusCode?: number;
  originalError?: unknown;
}

// Create a typed error with category
function createBenchError(
  message: string,
  category: ErrorCategory,
  retryable: boolean,
  originalError?: unknown,
  statusCode?: number
): BenchError {
  const error = new Error(message) as BenchError;
  error.category = category;
  error.retryable = retryable;
  error.originalError = originalError;
  error.statusCode = statusCode;
  return error;
}

// Extract detailed error information from various error shapes
function extractErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts: string[] = [error.message];

  // Check for common error properties that might contain more details
  const errorObj = error as Record<string, unknown>;

  // AI SDK errors often have a 'cause' property
  if (errorObj.cause) {
    const causeStr =
      errorObj.cause instanceof Error
        ? errorObj.cause.message
        : String(errorObj.cause);
    if (causeStr && !parts.includes(causeStr)) {
      parts.push(`Cause: ${causeStr}`);
    }
  }

  // Check for response body or data
  if (errorObj.responseBody) {
    parts.push(`Response: ${JSON.stringify(errorObj.responseBody)}`);
  }
  if (errorObj.data) {
    parts.push(`Data: ${JSON.stringify(errorObj.data)}`);
  }

  // Check for status code
  if (errorObj.status || errorObj.statusCode) {
    parts.push(`Status: ${errorObj.status || errorObj.statusCode}`);
  }

  // Check for error code
  if (errorObj.code) {
    parts.push(`Code: ${errorObj.code}`);
  }

  // Check for API error details (common in provider responses)
  if (errorObj.error && typeof errorObj.error === "object") {
    const apiError = errorObj.error as Record<string, unknown>;
    if (apiError.message) {
      parts.push(`API Error: ${apiError.message}`);
    }
    if (apiError.type) {
      parts.push(`Type: ${apiError.type}`);
    }
  }

  return parts.join(" | ");
}

// Categorize errors for better handling
function categorizeError(error: unknown): BenchError {
  const message = extractErrorDetails(error);
  const lowerMessage = message.toLowerCase();

  // Network errors - retryable
  if (
    lowerMessage.includes("socket connection was closed unexpectedly") ||
    lowerMessage.includes("econnreset") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("etimedout") ||
    lowerMessage.includes("enotfound") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("dns") ||
    lowerMessage.includes("fetch failed")
  ) {
    return createBenchError(message, ErrorCategory.Network, true, error);
  }

  // Rate limit errors - retryable with longer backoff
  if (
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many requests") ||
    lowerMessage.includes("429") ||
    lowerMessage.includes("quota exceeded")
  ) {
    return createBenchError(message, ErrorCategory.RateLimit, true, error, 429);
  }

  // Timeout errors - retryable
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("deadline exceeded")
  ) {
    return createBenchError(message, ErrorCategory.Timeout, true, error);
  }

  // Server errors (5xx) - retryable
  if (
    lowerMessage.includes("500") ||
    lowerMessage.includes("502") ||
    lowerMessage.includes("503") ||
    lowerMessage.includes("504") ||
    lowerMessage.includes("internal server error") ||
    lowerMessage.includes("bad gateway") ||
    lowerMessage.includes("service unavailable")
  ) {
    return createBenchError(
      message,
      ErrorCategory.ServerError,
      true,
      error,
      500
    );
  }

  // Invalid response - not retryable (likely a bug)
  if (
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("parse") ||
    lowerMessage.includes("json") ||
    lowerMessage.includes("unexpected token")
  ) {
    return createBenchError(
      message,
      ErrorCategory.InvalidResponse,
      false,
      error
    );
  }

  // Unknown errors - not retryable by default
  return createBenchError(message, ErrorCategory.Unknown, false, error);
}

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  rateLimitMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 4,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  rateLimitMultiplier: 3, // Rate limit errors get longer backoff
};

// Calculate delay with exponential backoff and jitter
function calculateDelay(
  attempt: number,
  config: RetryConfig,
  isRateLimit: boolean
): number {
  const multiplier = isRateLimit ? config.rateLimitMultiplier : 1;
  const exponentialDelay = config.baseDelayMs * 2 ** attempt * multiplier;
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (error: BenchError, attempt: number, delayMs: number) => void
): Promise<T> {
  let lastError: BenchError | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = categorizeError(error);

      // Don't retry non-retryable errors
      if (!lastError.retryable || attempt === config.maxRetries) {
        throw lastError;
      }

      const isRateLimit = lastError.category === ErrorCategory.RateLimit;
      const delay = calculateDelay(attempt, config, isRateLimit);

      onRetry?.(lastError, attempt + 1, delay);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw (
    lastError ??
    createBenchError("Unexpected retry loop exit", ErrorCategory.Unknown, false)
  );
}

type Direction = "up" | "down" | "left" | "right";

function createMoveTool(
  env: MazeEnv,
  onMove: (
    direction: Direction,
    posBefore: { x: number; y: number },
    observation: string
  ) => void
) {
  return tool({
    description: "Move the character one step in the specified direction.",
    inputSchema: z.object({
      direction: z.enum(["up", "down", "left", "right"]),
    }),
    execute: ({ direction }) => {
      const posBefore = { ...env.pos };

      // Perform the move logic
      const result = moveInMaze(env, direction);

      // Log for the trace
      onMove(direction, posBefore, result.view);

      // Determine message based on result
      let moveMessage: string;
      if (result.success) {
        moveMessage = "Goal reached!";
      } else if (posBefore.x === env.pos.x && posBefore.y === env.pos.y) {
        moveMessage = "Hit a wall, position unchanged.";
      } else {
        moveMessage = `Moved ${direction} to (${env.pos.x}, ${env.pos.y})`;
      }

      // Return rich data to the model state
      return {
        success: result.success,
        newPosition: { x: env.pos.x, y: env.pos.y },
        observation: result.view,
        message: moveMessage,
      };
    },
  });
}

export type StepCallback = (step: number, success: boolean) => void;
export type RetryCallback = (
  error: BenchError,
  attempt: number,
  delayMs: number
) => void;

const SYSTEM_PROMPT = `You are navigating a maze. 
Your goal is to find the exit (G).

Legend:
# = wall
(space) = empty
A = your current position
G = goal

You can move 'up', 'down', 'left', or 'right'. 
Every time you move, you will receive your new coordinates and a view of the maze.`;

export async function runSingleMaze(
  model: ModelKey,
  mazeData: MazeData,
  onStep?: StepCallback,
  onRetry?: RetryCallback
): Promise<RunResult> {
  const env = createMazeEnv(mazeData);
  const stepTrace: StepTrace[] = [];

  const onMove = (
    direction: Direction,
    posBefore: { x: number; y: number },
    observation: string
  ) => {
    stepTrace.push({
      step: env.steps,
      action: direction,
      posBefore,
      posAfter: { ...env.pos },
      success: env.success,
      observation,
    });
  };

  const tools = { move: createMoveTool(env, onMove) } satisfies ToolSet;

  // Stop the loop if the tool reports success
  const stop: StopCondition<typeof tools> = ({ steps }) =>
    steps.some((s) =>
      s.toolResults?.some((r) => {
        const output = r.output as { success?: boolean } | undefined;
        return output?.success === true;
      })
    );

  const start = performance.now();

  try {
    const result = await retryWithBackoff(
      () =>
        generateText({
          model: MODELS[model] as LanguageModel,
          tools,
          stopWhen: stop,
          system: SYSTEM_PROMPT,
          prompt: `Start Position: (1, 1). Initial view:\n${getObservation(env)}`,
          temperature: 0, // Deterministic logic is better for navigation
          onStepFinish: () => {
            onStep?.(env.steps, env.success);
          },
        }),
      DEFAULT_RETRY_CONFIG,
      onRetry
    );

    let totalCost = 0;
    for (const step of result.steps) {
      const stepMeta = (step as unknown as Record<string, unknown>)
        .providerMetadata as Record<string, unknown> | undefined;
      const openrouterMeta = stepMeta?.openrouter as
        | { usage?: { cost?: number } }
        | undefined;
      totalCost += openrouterMeta?.usage?.cost ?? 0;
    }
    const cost = totalCost > 0 ? totalCost : undefined;

    return createResult(env, mazeData, model, stepTrace, start, cost);
  } catch (error) {
    const benchError =
      error instanceof Error && "category" in error
        ? (error as BenchError)
        : categorizeError(error);

    return createResult(
      env,
      mazeData,
      model,
      stepTrace,
      start,
      undefined,
      benchError
    );
  }
}

function findGoalPos(maze: string[]): { x: number; y: number } {
  for (let y = 0; y < maze.length; y++) {
    const row = maze[y];
    if (row) {
      const x = row.indexOf("G");
      if (x !== -1) {
        return { x, y };
      }
    }
  }
  return { x: (maze[0]?.length ?? 2) - 2, y: maze.length - 2 };
}

function calculateEfficiencyScore(
  success: boolean,
  optimalPathLength: number,
  totalSteps: number
): number {
  // Only successful runs with reachable goals get efficiency scores
  if (!(success && Number.isFinite(optimalPathLength)) || totalSteps === 0) {
    return 0;
  }
  return optimalPathLength / totalSteps;
}

function createResult(
  env: MazeEnv,
  mazeData: MazeData,
  model: ModelKey,
  stepTrace: StepTrace[],
  startTime: number,
  cost?: number,
  error?: BenchError
): RunResult {
  let errorMessage: string | undefined;
  if (error) {
    errorMessage = `[${error.category}] ${error.message}`;
  }

  const efficiencyScore = calculateEfficiencyScore(
    env.success,
    mazeData.optimalPathLength,
    env.steps
  );

  return {
    id: `${model}_${mazeData.id}`,
    timestamp: new Date().toISOString(),
    config: mazeData.cfg,
    model,
    maze: mazeData.maze,
    startPos: { x: 1, y: 1 },
    goalPos: findGoalPos(mazeData.maze),
    seed: mazeData.seed,
    success: env.success,
    totalSteps: env.steps,
    totalDurationMs: performance.now() - startTime,
    cost,
    stepsTrace: stepTrace,
    lastObservation: getObservation(env),
    error: errorMessage,
    optimalPathLength: mazeData.optimalPathLength,
    efficiencyScore,
  };
}
