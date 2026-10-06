import { shortestPath } from "../bfs.ts";
import { generateMaze, placeStartGoal } from "../generate.ts";
import { CLOCKWISE, DIRS, type Dir, isOpen, type Pos, posKey, samePos, step } from "../grid.ts";
import { localView, renderAscii } from "../render.ts";
import { Rng } from "../rng.ts";
import type {
  BaselineKind,
  BatchResult,
  EpisodeEnd,
  ItemContext,
  MazeItem,
  MoveReport,
  Prompt,
  Scored,
  TaskId,
  TaskInfo,
} from "./types.ts";

/** Success weighted by path length (Anderson et al. 2018). */
export function spl(success: boolean, optimal: number, taken: number): number {
  return success ? optimal / Math.max(taken, optimal, 1e-9) : 0;
}

export function generateItem({ level, seed }: ItemContext): MazeItem {
  const rng = new Rng(seed);
  const tiles = generateMaze({ cells: level.cells, braid: level.braid }, rng);
  const { start, goal, distance } = placeStartGoal(tiles, rng);
  return { tiles, start, goal, optimal: distance };
}

/** The maze an agent is walking through. Counts moves, blocked moves and revisits. */
export class MazeEnv {
  pos: Pos;
  moves = 0;
  blocked = 0;
  revisits = 0;
  reached = false;
  /** Every attempted move in order. Blocked moves leave the position unchanged. */
  readonly log: Dir[] = [];
  private readonly visits = new Map<number, number>();

  constructor(
    readonly item: MazeItem,
    readonly mode: TaskId,
  ) {
    this.pos = item.start;
    this.visits.set(posKey(item.start), 1);
  }

  /** The episode ends only at the exit (or when the agent stops); there is no move limit. */
  get done(): boolean {
    return this.reached;
  }

  get uniqueVisited(): number {
    return this.visits.size;
  }

  map(): string {
    return renderAscii(this.item.tiles, [
      { pos: this.item.goal, ch: "G" },
      { pos: this.pos, ch: "@" },
    ]);
  }

  view(): string {
    return localView(this.item.tiles, this.pos, [
      { pos: this.item.goal, ch: "G" },
      { pos: this.pos, ch: "@" },
    ]);
  }

  /** One move. Returns whether it moved; a blocked move still counts as a move. */
  move(dir: Dir): "moved" | "blocked" {
    this.moves++;
    this.log.push(dir);
    const next = step(this.pos, dir);
    if (!isOpen(this.item.tiles, next)) {
      this.blocked++;
      return "blocked";
    }
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
    return "moved";
  }

  /** Run moves in order, stopping after the first blocked move or at the exit. */
  moveBatch(dirs: readonly Dir[]): BatchResult {
    const steps: MoveReport[] = [];
    for (const dir of dirs) {
      if (this.done) {
        break;
      }
      const result = this.move(dir);
      steps.push(this.mode === "fog" ? { move: dir, result, view: this.view() } : { move: dir, result });
      if (result === "blocked") {
        break;
      }
    }
    return {
      steps,
      skipped: dirs.length - steps.length,
      ...(this.mode === "full" ? { map: this.map() } : {}),
      goal_reached: this.reached,
    };
  }
}

/** Replay a move log (including blocked moves) into positions, for the viewer. */
export function replayLog(item: MazeItem, log: readonly Dir[]): { positions: Pos[]; blocked: boolean[] } {
  const positions = [item.start];
  const blocked: boolean[] = [];
  let cur = item.start;
  for (const d of log) {
    const next = step(cur, d);
    const ok = isOpen(item.tiles, next);
    blocked.push(!ok);
    if (ok) {
      cur = next;
    }
    positions.push(cur);
  }
  return { positions, blocked };
}

// The system prompt states the goal and what the agent sees. The tool description is the single
// place the move mechanics live. Strategy (how far to plan, how many moves per call, how to
// remember the maze) is left entirely to the model. There is no move limit: the episode ends at
// the exit or when the agent stops calling the tool.
const SYMBOLS = "`#` wall · `.` floor · `@` you · `G` exit";

const SYSTEM: Record<TaskId, string> = {
  full: `Reach the exit of the maze.\n\n${SYMBOLS}. Up is the top of the map.`,
  once: `Reach the exit of the maze.\n\n${SYMBOLS}. Up is the top of the map. The map is shown once, at the start.`,
  fog:
    `Reach the exit of the maze.\n\nYou see the 3×3 area centred on you. ${SYMBOLS}; the exit shows once it is ` +
    "within view. Up is the top of the view.",
};

const TOOL_RETURNS: Record<TaskId, string> = {
  full: "whether each move went through, the map after the last move,",
  once: "whether each move went through",
  fog: "whether each move went through, the 3×3 view after each move,",
};

export interface MazeTask extends TaskInfo {
  generate(ctx: ItemContext): MazeItem;
  createEnv(item: MazeItem): MazeEnv;
  prompt(item: MazeItem, env: MazeEnv): Prompt;
  toolDescription: string;
  scoreEpisode(item: MazeItem, env: MazeEnv, end: EpisodeEnd): Scored;
  /** Next move for a baseline policy. */
  baselinePolicy(kind: BaselineKind, item: MazeItem, rng: Rng): (env: MazeEnv) => Dir;
}

function makeTask(id: TaskId, title: string, summary: string): MazeTask {
  return {
    id,
    title,
    summary,
    generate: generateItem,
    createEnv: (item) => new MazeEnv(item, id),
    prompt: (_item, env) => ({
      system: SYSTEM[id],
      user: id === "fog" ? env.view() : env.map(),
    }),
    toolDescription:
      "Walk through the maze. Takes any number of moves (U up, D down, L left, R right) and runs them in order, " +
      `stopping at the first wall or at the exit. Returns ${TOOL_RETURNS[id]} and whether you reached the exit.`,
    scoreEpisode(item, env, end) {
      const success = env.reached;
      const moved = env.moves - env.blocked;
      return {
        score: success ? 1 : 0,
        outcome: success ? "success" : end,
        metrics: {
          moves: env.moves,
          optimal: item.optimal,
          spl: spl(success, item.optimal, moved),
          invalidRate: env.moves === 0 ? 0 : env.blocked / env.moves,
          revisitRate: moved === 0 ? 0 : env.revisits / moved,
        },
        trace: { moves: env.log.join("") },
      };
    },
    baselinePolicy(kind, item, rng) {
      if (kind === "oracle") {
        return (env) => {
          const next = shortestPath(item.tiles, env.pos, item.goal)?.[1];
          return DIRS.find((d) => next && samePos(step(env.pos, d), next)) ?? "U";
        };
      }
      if (kind === "random") {
        return (env) => rng.pick(DIRS.filter((d) => isOpen(item.tiles, step(env.pos, d))));
      }
      // Right-hand wall follower: needs no map and no memory.
      let heading: Dir = DIRS.find((d) => isOpen(item.tiles, step(item.start, d))) ?? "U";
      return (env) => {
        const h = CLOCKWISE.indexOf(heading);
        const order = [1, 0, 3, 2].map((o) => CLOCKWISE[(h + o) % 4] as Dir);
        heading = order.find((d) => isOpen(item.tiles, step(env.pos, d))) ?? heading;
        return heading;
      };
    },
  };
}

export const TASKS: Record<TaskId, MazeTask> = {
  full: makeTask("full", "Full map", "Sees the whole map after every batch of moves."),
  once: makeTask("once", "Map once", "Sees the map once at the start, then only whether each move worked."),
  fog: makeTask("fog", "Fog", "Sees only the 3×3 area around itself after each move."),
};

export function getTask(id: TaskId): MazeTask {
  return TASKS[id];
}
