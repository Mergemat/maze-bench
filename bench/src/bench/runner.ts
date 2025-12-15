import { type StopCondition, streamText, type ToolSet, tool } from "ai";
import z from "zod";
import { MAX_STEPS } from "./config";
import { createMazeEnv, getObservation, moveInMaze } from "./maze";
import type { ModelKey } from "./models";
import { MODELS } from "./models";
import type { MazeData, MazeEnv, RunResult, StepTrace } from "./types";

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
    description: "Move in the maze",
    inputSchema: z.object({
      direction: z.enum(["up", "down", "left", "right"]),
    }),
    execute: async ({ direction }) => {
      const observation = getObservation(env);
      const posBefore = { ...env.pos };
      const result = moveInMaze(env, direction, MAX_STEPS);
      onMove(direction, posBefore, observation);
      return result;
    },
  });
}

const SYSTEM_PROMPT = `You are navigating a maze. Find a way out.

Legend:
# = wall
(space) = empty
A = you
G = goal

Choose one move using the move tool.`;

export type StepCallback = (step: number, success: boolean) => void;

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
    onStep?.(env.steps, env.success);
  };

  const tools = { move: createMoveTool(env, onMove) } satisfies ToolSet;

  const stop: StopCondition<typeof tools> = ({ steps }) =>
    steps.some((s) =>
      s.toolResults?.some(
        (r) =>
          (r as { output?: { success?: boolean } }).output?.success === true
      )
    );

  const start = performance.now();

  try {
    const stream = streamText({
      model: MODELS[model] as Parameters<typeof streamText>[0]["model"],
      tools,
      stopWhen: stop,
      prompt: getObservation(env),
      system: SYSTEM_PROMPT,
    });

    const metadata = await stream.providerMetadata;
    console.log("metadata", metadata);
    const cost = (metadata?.openrouter as { usage?: { cost?: number } })?.usage
      ?.cost;

    return createResult(
      env,
      mazeData,
      model,
      stepTrace,
      start,
      cost,
      undefined
    );
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
