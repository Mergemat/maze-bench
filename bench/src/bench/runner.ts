import {
  generateText,
  type LanguageModel,
  type StopCondition,
  type ToolSet,
  tool,
} from "ai";
import z from "zod";
import { MAX_STEPS } from "./config";
import { createMazeEnv, getObservation, moveInMaze } from "./maze";
import type { ModelKey } from "./models";
import { MODELS } from "./models";
import type { MazeData, MazeEnv, RunResult, StepTrace } from "./types";

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("socket connection was closed unexpectedly") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ENOTFOUND")
  );
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
  baseDelay = 100
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      const delay = baseDelay * 2 ** attempt;
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
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
    execute: async ({ direction }) => {
      const posBefore = { ...env.pos };

      // Perform the move logic
      const result = moveInMaze(env, direction, MAX_STEPS);

      // Log for the trace
      onMove(direction, posBefore, result.view);

      // Return rich data to the model state
      return {
        success: result.success,
        newPosition: { x: env.pos.x, y: env.pos.y },
        observation: result.view,
        message: result.success
          ? "Goal reached!"
          : posBefore.x === env.pos.x && posBefore.y === env.pos.y
            ? "Hit a wall, position unchanged."
            : `Moved ${direction} to (${env.pos.x}, ${env.pos.y})`,
      };
    },
  });
}

export type StepCallback = (step: number, success: boolean) => void;

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
  onStep?: StepCallback
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
      s.toolResults?.some((r: any) => r.output?.success === true)
    );

  const start = performance.now();

  try {
    const result = await retryWithBackoff(() =>
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
      })
    );

    console.log(result.providerMetadata?.openrouter);
    const cost = (result.providerMetadata?.openrouter as any)?.usage?.cost;

    return createResult(env, mazeData, model, stepTrace, start, cost);
  } catch (error) {
    return createResult(
      env,
      mazeData,
      model,
      stepTrace,
      start,
      undefined,
      error
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

function createResult(
  env: MazeEnv,
  mazeData: MazeData,
  model: ModelKey,
  stepTrace: StepTrace[],
  startTime: number,
  cost?: number,
  error?: unknown
): RunResult {
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
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : undefined,
  };
}
