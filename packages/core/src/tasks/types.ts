import type { Dir, Pos, Tiles } from "../grid.ts";
import type { Rng } from "../rng.ts";

export type TaskId = "local" | "trace" | "plan" | "recall" | "fog";
export const TASK_IDS: readonly TaskId[] = ["local", "trace", "plan", "recall", "fog"];

export type Repr = "ascii" | "adjacency";

export interface LevelSpec {
  level: number;
  cells: number;
  braid: number;
  items: number;
}

export interface ItemContext {
  level: LevelSpec;
  seed: number;
  /** Position of the item within its level, used for stratified sampling. */
  index: number;
}

export type Outcome =
  | "success"
  | "wrong_answer"
  | "parse_failed"
  | "invalid_move"
  | "did_not_reach"
  | "truncated"
  | "stalled"
  | "budget_exhausted";

export type Metrics = Record<string, number | boolean | null>;

export interface Scored {
  /** Primary metric in [0, 1]. */
  score: number;
  outcome: Outcome;
  metrics: Metrics;
  /** Data the replay viewer needs, beyond what can be regenerated from the seed. */
  trace?: Record<string, unknown>;
}

export interface Prompt {
  system: string;
  user: string;
}

export type BaselineKind = "oracle" | "random" | "heuristic";
export const BASELINE_KINDS: readonly BaselineKind[] = ["oracle", "random", "heuristic"];

/** Which marks to draw when showing an item's maze. */
export interface MazeView {
  tiles: Tiles;
  start?: Pos;
  goal?: Pos;
  agent?: Pos;
}

interface TaskInfo {
  id: TaskId;
  title: string;
  ability: "spatial" | "planning" | "memory" | "integrated";
  /** One sentence for the leaderboard and methodology page. */
  summary: string;
  /** Name of the primary metric as shown in the UI. */
  metric: string;
}

export interface OneShotTask<Item, Value> extends TaskInfo {
  kind: "oneshot";
  generate(ctx: ItemContext): Item;
  prompt(item: Item, repr: Repr): Prompt;
  /** Parse the content after `ANSWER:`. Null means unparseable. */
  parse(content: string): Value | null;
  score(item: Item, value: Value): Scored;
  baseline(item: Item, kind: BaselineKind, rng: Rng): Value;
  view(item: Item): MazeView;
}

export type StepResult = {
  result: "moved" | "blocked";
  view: string;
  goal_reached: boolean;
  moves_left: number;
};

export type BatchResult = {
  /** One entry per executed move, with the 3x3 view after it. */
  steps: Array<{ move: Dir; result: "moved" | "blocked"; view: string }>;
  /** Moves that were not run because the batch stopped early. */
  skipped: number;
  goal_reached: boolean;
  moves_left: number;
};

export interface Env {
  readonly done: boolean;
  readonly reached: boolean;
  readonly movesLeft: number;
  move(dir: Dir): StepResult;
  /** Run moves in order, stopping after the first blocked move, at the goal, or when the budget runs out. */
  moveBatch(dirs: readonly Dir[]): BatchResult;
  currentView(): string;
}

export type EpisodeEnd = "goal" | "budget" | "stalled" | "truncated";

export interface InteractiveTask<Item, E extends Env> extends TaskInfo {
  kind: "interactive";
  generate(ctx: ItemContext): Item;
  createEnv(item: Item): E;
  prompt(item: Item, env: E): Prompt;
  /** Message sent when the model replies without calling the tool. */
  nudge: string;
  maxNudges: number;
  toolDescription: string;
  scoreEpisode(item: Item, env: E, end: EpisodeEnd): Scored;
  /** Next move for a baseline policy, given only what the agent can observe. */
  baselinePolicy(kind: BaselineKind, item: Item, rng: Rng): (env: E) => Dir;
  view(item: Item): MazeView;
}

export const SYSTEM_ONESHOT =
  "You are solving a maze puzzle. Work it out as carefully as you need to. " +
  "Finish your reply with one final line in the form `ANSWER: <answer>` and nothing after it.";

export const LEGEND = "`#` is a wall and `.` is open floor.";
