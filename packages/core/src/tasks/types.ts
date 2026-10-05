import type { Dir, Pos, Tiles } from "../grid.ts";

/**
 * Every task is the same agent run: move through a maze with a batched `move` tool until you
 * reach the exit. Tasks differ only in what the agent sees.
 *  - full: the whole map, redrawn after every batch
 *  - once: the whole map at the start only; afterwards just whether each move worked
 *  - fog:  a 3x3 view after every move
 */
export type TaskId = "full" | "once" | "fog";
export const TASK_IDS: readonly TaskId[] = ["full", "once", "fog"];

export interface LevelSpec {
  level: number;
  cells: number;
  braid: number;
  items: number;
}

export interface ItemContext {
  level: LevelSpec;
  seed: number;
  index: number;
}

export interface MazeItem {
  tiles: Tiles;
  start: Pos;
  goal: Pos;
  /** Move budget: twice the number of open tiles. */
  budget: number;
  /** BFS distance from start to goal. */
  optimal: number;
}

export type Outcome = "success" | "budget_exhausted" | "stalled" | "truncated";
export type EpisodeEnd = "goal" | "budget" | "stalled" | "truncated";

export type Metrics = Record<string, number | boolean | null>;

export interface Scored {
  /** 1 if the agent reached the exit, else 0. */
  score: number;
  outcome: Outcome;
  metrics: Metrics;
  /** What the replay viewer needs beyond the seed: the move log. */
  trace?: Record<string, unknown>;
}

export interface Prompt {
  system: string;
  user: string;
}

export type BaselineKind = "oracle" | "random" | "heuristic";
export const BASELINE_KINDS: readonly BaselineKind[] = ["oracle", "random", "heuristic"];

export type MoveReport = { move: Dir; result: "moved" | "blocked"; view?: string };

export type BatchResult = {
  /** One entry per move that ran. In fog mode each entry carries the 3x3 view after the move. */
  steps: MoveReport[];
  /** Moves not run because the batch stopped early (wall, goal or budget). */
  skipped: number;
  /** Full mode only: the map after the batch. */
  map?: string;
  goal_reached: boolean;
  moves_left: number;
};

export interface TaskInfo {
  id: TaskId;
  /** Short name for the UI. */
  title: string;
  /** One sentence for tooltips and the methodology page. */
  summary: string;
}
