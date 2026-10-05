import { fogTask } from "./fog.ts";
import { localTask } from "./local.ts";
import { planTask } from "./plan.ts";
import { recallTask } from "./recall.ts";
import { traceTask } from "./trace.ts";
import type { InteractiveTask, OneShotTask, TaskId } from "./types.ts";
import type { Env } from "./types.ts";

// Erase item and value types so the harness can treat tasks uniformly.
export type AnyOneShotTask = OneShotTask<unknown, unknown>;
export type AnyInteractiveTask = InteractiveTask<unknown, Env>;
export type AnyTask = AnyOneShotTask | AnyInteractiveTask;

export const TASKS: Record<TaskId, AnyTask> = {
  local: localTask as unknown as AnyOneShotTask,
  trace: traceTask as unknown as AnyOneShotTask,
  plan: planTask as unknown as AnyOneShotTask,
  recall: recallTask as unknown as AnyOneShotTask,
  fog: fogTask as unknown as AnyInteractiveTask,
};

export function getTask(id: TaskId): AnyTask {
  return TASKS[id];
}

export { fogTask, localTask, planTask, recallTask, traceTask };
export { FogEnv, replayFog } from "./fog.ts";
export { spl, wallFollower } from "./plan.ts";
export { knownTiles, tourPositions } from "./recall.ts";
export type { FogItem } from "./fog.ts";
export type { LocalItem } from "./local.ts";
export type { PlanItem } from "./plan.ts";
export type { RecallItem } from "./recall.ts";
export type { TraceItem } from "./trace.ts";
export * from "./types.ts";
