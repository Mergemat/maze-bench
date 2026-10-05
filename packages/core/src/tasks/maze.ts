import { shortestPath } from "../bfs.ts";
import { generateMaze, placeStartGoal } from "../generate.ts";
import { CLOCKWISE, countOpen, DIRS, type Dir, isOpen, type Pos, posKey, samePos, step } from "../grid.ts";
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
  return { tiles, start, goal, budget: 2 * countOpen(tiles), optimal: distance };
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

  get done(): boolean {
    return this.reached || this.moves >= this.item.budget;
  }

  get movesLeft(): number {
    return Math.max(0, this.item.budget - this.moves);
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

  /** One move. Returns whether it moved; a blocked move still uses up budget. */
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

  /** Run moves in order, stopping after the first blocked move, at the goal, or when the budget runs out. */
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
      moves_left: this.movesLeft,
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

const LEGEND = "`#` is a wall, `.` is open floor, `@` is you and `G` is the exit. Up is the top of the map.";

const TOOL_RULES =
  "Use the `move` tool with a list of moves, each U (up), D (down), L (left) or R (right), for example " +
  '["R", "R", "D"]. You can send one move or a whole route; the moves run in order. A batch stops early if a ' +
  "move hits a wall or you reach the exit.";

const SYSTEM: Record<TaskId, (budget: number) => string> = {
  full: (budget) =>
    `You are in a maze and must reach the exit. ${LEGEND}\n\n${TOOL_RULES} After each batch you get the updated map. ` +
    `Moving into a wall uses up a move. You have ${budget} moves.`,
  once: (budget) =>
    `You are in a maze and must reach the exit. ${LEGEND}\n\n${TOOL_RULES} You see the map only once, now. After ` +
    "each batch you only learn which moves worked and which were blocked, so keep track of where you are yourself. " +
    `Moving into a wall uses up a move. You have ${budget} moves.`,
  fog: (budget) =>
    "You are in a maze and must reach the exit. You can only see the 3x3 area around you. In a view `#` is a wall, " +
    "`.` is open floor, `@` is you and `G` is the exit, which you only see once it is within view. The top row of a " +
    `view is up.\n\n${TOOL_RULES} You get the view after each move. Moving into a wall uses up a move. ` +
    `You have ${budget} moves. There are no coordinates, so keep track of where you have been yourself.`,
};

export interface MazeTask extends TaskInfo {
  generate(ctx: ItemContext): MazeItem;
  createEnv(item: MazeItem): MazeEnv;
  prompt(item: MazeItem, env: MazeEnv): Prompt;
  toolDescription: string;
  /** Sent when the agent stops without calling the tool. */
  nudge: string;
  maxNudges: number;
  scoreEpisode(item: MazeItem, env: MazeEnv, end: EpisodeEnd): Scored;
  /** Next move for a baseline policy. */
  baselinePolicy(kind: BaselineKind, item: MazeItem, rng: Rng): (env: MazeEnv) => Dir;
}

const OUTCOME = { goal: "success", budget: "budget_exhausted", stalled: "stalled", truncated: "truncated" } as const;

function makeTask(id: TaskId, title: string, summary: string): MazeTask {
  return {
    id,
    title,
    summary,
    generate: generateItem,
    createEnv: (item) => new MazeEnv(item, id),
    prompt: (item, env) => ({
      system: SYSTEM[id](item.budget),
      user:
        id === "fog"
          ? `Your current view:\n${env.view()}\n\nFind the exit.`
          : `The maze:\n\n${env.map()}\n\nFind the exit.`,
    }),
    toolDescription:
      "Make one or more moves in order. Reports, for each move that ran, whether you moved or were blocked" +
      (id === "fog" ? " and your 3x3 view after it" : "") +
      (id === "full" ? ", then the updated map" : "") +
      "; then whether you reached the exit and how many moves you have left.",
    nudge: "Call the move tool to continue.",
    maxNudges: 3,
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
