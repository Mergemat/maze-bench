import { shortestPath } from "../bfs.ts";
import { generateMaze, placeStartGoal } from "../generate.ts";
import { CLOCKWISE, countOpen, DIRS, type Dir, isOpen, type Pos, posKey, samePos, step, type Tiles } from "../grid.ts";
import { localView } from "../render.ts";
import { Rng } from "../rng.ts";
import { spl } from "./plan.ts";
import type { BatchResult, Env, EpisodeEnd, InteractiveTask, StepResult } from "./types.ts";

export interface FogItem {
  tiles: Tiles;
  start: Pos;
  goal: Pos;
  budget: number;
  optimal: number;
}

export class FogEnv implements Env {
  pos: Pos;
  moves = 0;
  blocked = 0;
  revisits = 0;
  reached = false;
  /** Every attempted move in order. Blocked moves leave the position unchanged. */
  readonly log: Dir[] = [];
  private readonly visits = new Map<number, number>();

  constructor(readonly item: FogItem) {
    this.pos = item.start;
    this.visits.set(posKey(item.start), 1);
  }

  get done(): boolean {
    return this.reached || this.moves >= this.item.budget;
  }

  get movesLeft(): number {
    return Math.max(0, this.item.budget - this.moves);
  }

  get uniqueVisited(): number {
    return this.visits.size;
  }

  currentView(): string {
    return localView(this.item.tiles, this.pos, [
      { pos: this.item.goal, ch: "G" },
      { pos: this.pos, ch: "@" },
    ]);
  }

  moveBatch(dirs: readonly Dir[]): BatchResult {
    return runBatch(this, dirs);
  }

  move(dir: Dir): StepResult {
    if (this.done) {
      return { result: "blocked", view: this.currentView(), goal_reached: this.reached, moves_left: this.movesLeft };
    }
    this.moves++;
    this.log.push(dir);
    const next = step(this.pos, dir);
    let result: StepResult["result"] = "blocked";
    if (isOpen(this.item.tiles, next)) {
      result = "moved";
      this.pos = next;
      const key = posKey(next);
      const seen = this.visits.get(key) ?? 0;
      if (seen > 0) {
        this.revisits++;
      }
      this.visits.set(key, seen + 1);
      if (samePos(next, this.item.goal)) {
        this.reached = true;
      }
    } else {
      this.blocked++;
    }
    return { result, view: this.currentView(), goal_reached: this.reached, moves_left: this.movesLeft };
  }
}

export function runBatch(env: Env, dirs: readonly Dir[]): BatchResult {
  const steps: BatchResult["steps"] = [];
  for (const dir of dirs) {
    if (env.done) {
      break;
    }
    const r = env.move(dir);
    steps.push({ move: dir, result: r.result, view: r.view });
    if (r.result === "blocked") {
      break;
    }
  }
  return { steps, skipped: dirs.length - steps.length, goal_reached: env.reached, moves_left: env.movesLeft };
}

/** Replay a move log (including blocked moves) into positions, for the viewer. */
export function replayFog(tiles: Tiles, start: Pos, log: readonly Dir[]): { positions: Pos[]; blocked: boolean[] } {
  const positions = [start];
  const blocked: boolean[] = [];
  let cur = start;
  for (const d of log) {
    const next = step(cur, d);
    const ok = isOpen(tiles, next);
    blocked.push(!ok);
    if (ok) {
      cur = next;
    }
    positions.push(cur);
  }
  return { positions, blocked };
}

const OUTCOME: Record<EpisodeEnd, "success" | "budget_exhausted" | "stalled" | "truncated"> = {
  goal: "success",
  budget: "budget_exhausted",
  stalled: "stalled",
  truncated: "truncated",
};

export const fogTask: InteractiveTask<FogItem, FogEnv> = {
  id: "fog",
  kind: "interactive",
  title: "Fog navigation",
  ability: "integrated",
  summary: "Find the goal with only a 3x3 view, moving one step per tool call and remembering where you have been.",
  metric: "success rate",
  nudge: "Call the move tool to continue.",
  maxNudges: 3,
  toolDescription:
    "Make one or more moves in order. Returns, for each move that ran, whether you moved or were blocked and your 3x3 view after it; " +
    "then whether you reached the goal and how many moves you have left. A batch stops early at the first blocked move or at the goal.",

  generate({ level, seed }) {
    const rng = new Rng(seed);
    const tiles = generateMaze({ cells: level.cells, braid: level.braid }, rng);
    const { start, goal, distance } = placeStartGoal(tiles, rng);
    return { tiles, start, goal, budget: 2 * countOpen(tiles), optimal: distance };
  },

  createEnv(item) {
    return new FogEnv(item);
  },

  prompt(item, env) {
    return {
      system:
        "You are in a maze and can only see the 3x3 area around you. In a view `#` is a wall, `.` is open floor, " +
        "`@` is you, and `G` is the goal, which you only see once it is within your view. The top row of a view is up.\n\n" +
        "Find the goal. Use the `move` tool with a list of moves, each U (up), D (down), L (left) or R (right), " +
        'for example ["U", "U", "L"]. The moves run in order and you get the view after each one. ' +
        "A batch stops early if a move hits a wall or you reach the goal. " +
        `Moving into a wall uses up a move. You have ${item.budget} moves. ` +
        "There are no coordinates, so keep track of where you have been yourself.",
      user: `Your current view:\n${env.currentView()}\n\nFind the goal.`,
    };
  },

  scoreEpisode(item, env, end) {
    const success = env.reached;
    const moved = env.moves - env.blocked;
    return {
      score: success ? 1 : 0,
      outcome: success ? "success" : OUTCOME[end],
      metrics: {
        moves: env.moves,
        budget: item.budget,
        optimal: item.optimal,
        spl: spl(success, item.optimal, moved),
        invalidRate: env.moves === 0 ? 0 : env.blocked / env.moves,
        revisitRate: moved === 0 ? 0 : env.revisits / moved,
        uniqueTiles: env.uniqueVisited,
      },
      trace: { moves: env.log.join("") },
    };
  },

  baselinePolicy(kind, item, rng) {
    if (kind === "oracle") {
      return (env) => {
        const path = shortestPath(item.tiles, env.pos, item.goal);
        const next = path?.[1];
        return DIRS.find((d) => next && samePos(step(env.pos, d), next)) ?? "U";
      };
    }
    if (kind === "random") {
      return (env) => rng.pick(DIRS.filter((d) => isOpen(item.tiles, step(env.pos, d))));
    }
    let heading: Dir = DIRS.find((d) => isOpen(item.tiles, step(item.start, d))) ?? "U";
    return (env) => {
      const h = CLOCKWISE.indexOf(heading);
      const order = [1, 0, 3, 2].map((o) => CLOCKWISE[(h + o) % 4] as Dir);
      heading = order.find((d) => isOpen(item.tiles, step(env.pos, d))) ?? heading;
      return heading;
    };
  },

  view(item) {
    return { tiles: item.tiles, start: item.start, goal: item.goal };
  },
};
