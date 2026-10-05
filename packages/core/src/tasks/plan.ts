import { shortestPath } from "../bfs.ts";
import { generateMaze, placeStartGoal } from "../generate.ts";
import { CLOCKWISE, DIRS, type Dir, isOpen, movesFromPath, type Pos, samePos, step, type Tiles } from "../grid.ts";
import { executeMoves, parseMoves } from "../moves.ts";
import { renderAdjacency, renderAscii } from "../render.ts";
import { Rng } from "../rng.ts";
import { LEGEND, type OneShotTask, SYSTEM_ONESHOT } from "./types.ts";

export interface PlanItem {
  tiles: Tiles;
  start: Pos;
  goal: Pos;
  optimal: number;
}

/** Success weighted by path length (Anderson et al. 2018). */
export function spl(success: boolean, optimal: number, taken: number): number {
  if (!success) {
    return 0;
  }
  return optimal / Math.max(taken, optimal, 1e-9);
}

/** Right-hand wall follower from `start`, stopping at `goal` or after `limit` moves. */
export function wallFollower(tiles: Tiles, start: Pos, goal: Pos, limit: number): Dir[] {
  const moves: Dir[] = [];
  let cur = start;
  let heading: Dir = DIRS.find((d) => isOpen(tiles, step(start, d))) ?? "U";
  while (moves.length < limit && !samePos(cur, goal)) {
    const h = CLOCKWISE.indexOf(heading);
    // Try right, straight, left, back.
    const order = [1, 0, 3, 2].map((o) => CLOCKWISE[(h + o) % 4] as Dir);
    const next = order.find((d) => isOpen(tiles, step(cur, d)));
    if (!next) {
      break;
    }
    heading = next;
    cur = step(cur, next);
    moves.push(next);
  }
  return moves;
}

export const planTask: OneShotTask<PlanItem, Dir[]> = {
  id: "plan",
  kind: "oneshot",
  title: "One-shot route",
  ability: "planning",
  summary: "See the whole maze once and write out the full route from S to G.",
  metric: "SPL",

  generate({ level, seed }) {
    const rng = new Rng(seed);
    const tiles = generateMaze({ cells: level.cells, braid: level.braid }, rng);
    const { start, goal, distance } = placeStartGoal(tiles, rng);
    return { tiles, start, goal, optimal: distance };
  },

  prompt(item, repr) {
    const question =
      "Find a route from S to G. Moving into a wall is not allowed. " +
      "The score is highest for a shortest route; longer valid routes get partial credit.\n\n" +
      "Give the moves as U (up), D (down), L (left), R (right), separated by spaces, on the final line. For example:\n" +
      "ANSWER: R R D D L";
    if (repr === "adjacency") {
      return {
        system: SYSTEM_ONESHOT,
        user:
          "Here is a maze given as a list of open tiles. Each line is `(row,col)` followed by its open neighbours. " +
          "Row 0 is the top row and column 0 is the left column. Any tile not listed is a wall.\n\n" +
          `<maze>\n${renderAdjacency(item.tiles)}\n</maze>\n\n` +
          `S is at (${item.start.r},${item.start.c}). G is at (${item.goal.r},${item.goal.c}).\n\n${question}`,
      };
    }
    return {
      system: SYSTEM_ONESHOT,
      user:
        `Here is a maze. ${LEGEND} \`S\` is the start and \`G\` is the goal.\n\n` +
        `<maze>\n${renderAscii(item.tiles, [
          { pos: item.start, ch: "S" },
          { pos: item.goal, ch: "G" },
        ])}\n</maze>\n\n${question}`,
    };
  },

  parse: parseMoves,

  score(item, moves) {
    const run = executeMoves(item.tiles, item.start, moves, item.goal);
    const success = run.reachedGoalAt !== null;
    const taken = run.reachedGoalAt ?? moves.length;
    let outcome: "success" | "invalid_move" | "did_not_reach" = "did_not_reach";
    if (success) {
      outcome = "success";
    } else if (run.firstInvalid !== null) {
      outcome = "invalid_move";
    }
    // Primary score is SPL: a wall follower reaches G in most mazes, so success alone
    // does not measure planning. Success is kept as a secondary metric.
    return {
      score: spl(success, item.optimal, taken),
      outcome,
      metrics: {
        success,
        length: moves.length,
        optimal: item.optimal,
        firstInvalid: run.firstInvalid,
      },
      trace: { path: run.positions, firstInvalid: run.firstInvalid },
    };
  },

  baseline(item, kind, rng) {
    if (kind === "oracle") {
      return movesFromPath(shortestPath(item.tiles, item.start, item.goal) ?? [item.start]);
    }
    if (kind === "heuristic") {
      return wallFollower(item.tiles, item.start, item.goal, 4 * item.tiles.length * item.tiles.length);
    }
    // Random legal walk as long as the optimal route.
    const moves: Dir[] = [];
    let cur = item.start;
    for (let i = 0; i < item.optimal; i++) {
      const d = rng.pick(DIRS.filter((x) => isOpen(item.tiles, step(cur, x))));
      moves.push(d);
      cur = step(cur, d);
    }
    return moves;
  },

  view(item) {
    return { tiles: item.tiles, start: item.start, goal: item.goal };
  },
};
