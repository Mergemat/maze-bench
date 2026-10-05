import { shortestDistance, shortestPath } from "../bfs.ts";
import { cellCenters, generateMaze } from "../generate.ts";
import { type Dir, DIRS, isOpen, movesFromPath, OPPOSITE, type Pos, posKey, samePos, step, type Tiles } from "../grid.ts";
import { executeMoves, freeReduce, parseMoves, reverseMoves } from "../moves.ts";
import { localView, viewTiles } from "../render.ts";
import { Rng } from "../rng.ts";
import { spl } from "./plan.ts";
import { type OneShotTask, SYSTEM_ONESHOT } from "./types.ts";

export interface RecallItem {
  tiles: Tiles;
  /** Where the walk started; the model must return here. */
  start: Pos;
  /** Where the walk ended. */
  end: Pos;
  tour: Dir[];
  /** Shortest return over tiles the walker has seen. */
  optimal: number;
}

/** Positions along the tour, starting at `start`. */
export function tourPositions(item: Pick<RecallItem, "start" | "tour">): Pos[] {
  const out = [item.start];
  let cur = item.start;
  for (const m of item.tour) {
    cur = step(cur, m);
    out.push(cur);
  }
  return out;
}

/** Keys of every tile that appeared in some 3x3 view along the tour. */
export function knownTiles(item: Pick<RecallItem, "start" | "tour">): Set<number> {
  const known = new Set<number>();
  for (const p of tourPositions(item)) {
    for (const t of viewTiles(p)) {
      known.add(posKey(t));
    }
  }
  return known;
}

function knownPassable(tiles: Tiles, known: Set<number>) {
  return (p: Pos) => known.has(posKey(p)) && isOpen(tiles, p);
}

function returnSpl(item: RecallItem, moves: readonly Dir[]): number {
  const run = executeMoves(item.tiles, item.end, moves, item.start);
  return spl(run.reachedGoalAt !== null, item.optimal, run.reachedGoalAt ?? moves.length);
}

export const recallTask: OneShotTask<RecallItem, Dir[]> = {
  id: "recall",
  kind: "oneshot",
  title: "Route recall",
  ability: "memory",
  summary: "Read a walk through an unseen maze, step by local view, then return to the start by the shortest known route.",
  metric: "SPL",

  generate({ level, seed }) {
    const rng = new Rng(seed);
    const tiles = generateMaze({ cells: level.cells, braid: level.braid }, rng);
    const centers = cellCenters(level.cells);
    // A non-reversing random walk only backtracks at dead ends, so it goes around loops.
    // We keep walks where cancelling back-and-forth moves (free reduction) is still at least
    // 1/0.7 times longer than the best known return, so the item needs a spatial map.
    let best: { item: RecallItem; reduction: number } | null = null;
    for (let attempt = 0; attempt < 2000; attempt++) {
      const start = rng.pick(centers);
      const length = Math.round(level.cells * (5 + 4 * rng.next()));
      const tour: Dir[] = [];
      let cur = start;
      let prev: Dir | undefined;
      for (let i = 0; i < length; i++) {
        const legal = DIRS.filter((d) => isOpen(tiles, step(cur, d)));
        const forward = legal.filter((d) => prev === undefined || d !== OPPOSITE[prev]);
        const d = rng.pick(forward.length > 0 ? forward : legal);
        tour.push(d);
        cur = step(cur, d);
        prev = d;
      }
      if (samePos(cur, start)) {
        continue;
      }
      const draft = { tiles, start, end: cur, tour, optimal: 0 };
      const optimal = shortestDistance(tiles, cur, start, knownPassable(tiles, knownTiles(draft)));
      if (optimal === null || optimal < 2) {
        continue;
      }
      const item = { ...draft, optimal };
      const reduction = returnSpl(item, freeReduce(reverseMoves(tour)));
      if (reduction <= 0.7) {
        return item;
      }
      if (!best || reduction < best.reduction) {
        best = { item, reduction };
      }
    }
    if (best) {
      return best.item;
    }
    throw new Error(`recall: could not build a walk for seed ${seed}`);
  },

  prompt(item) {
    const positions = tourPositions(item);
    const view = (p: Pos) =>
      localView(item.tiles, p, [
        { pos: item.start, ch: "S" },
        { pos: p, ch: "@" },
      ]);
    const steps = [`Start:\n${view(item.start)}`];
    item.tour.forEach((m, i) => {
      steps.push(`Move ${i + 1}: ${m}\n${view(positions[i + 1] as Pos)}`);
    });
    return {
      system: SYSTEM_ONESHOT,
      user:
        "You walked through a maze that you cannot see. Before the first move and after every move you saw " +
        "the 3x3 area around you. In each view `#` is a wall, `.` is open floor, `@` is you, and `S` is the tile " +
        "where you started (shown whenever it is in view). The top row of a view is up. " +
        "Moves are U (up), D (down), L (left), R (right).\n\n" +
        `<walk>\n${steps.join("\n\n")}\n</walk>\n\n` +
        "Now walk back to S. Use the shortest route you can be sure of from what you saw. " +
        "Moving into a wall is not allowed.\n\n" +
        "Give the moves separated by spaces on the final line. For example:\nANSWER: L L U",
    };
  },

  parse: parseMoves,

  score(item, moves) {
    const run = executeMoves(item.tiles, item.end, moves, item.start);
    const success = run.reachedGoalAt !== null;
    const known = knownTiles(item);
    const unseen = run.positions.filter((p) => !known.has(posKey(p))).length;
    let outcome: "success" | "invalid_move" | "did_not_reach" = "did_not_reach";
    if (success) {
      outcome = "success";
    } else if (run.firstInvalid !== null) {
      outcome = "invalid_move";
    }
    return {
      score: spl(success, item.optimal, run.reachedGoalAt ?? moves.length),
      outcome,
      metrics: {
        success,
        length: moves.length,
        optimal: item.optimal,
        tour: item.tour.length,
        unseenTiles: unseen,
        reverseSpl: returnSpl(item, reverseMoves(item.tour)),
        reductionSpl: returnSpl(item, freeReduce(reverseMoves(item.tour))),
      },
      trace: { path: run.positions, firstInvalid: run.firstInvalid },
    };
  },

  baseline(item, kind, rng) {
    if (kind === "oracle") {
      const path = shortestPath(item.tiles, item.end, item.start, knownPassable(item.tiles, knownTiles(item)));
      return movesFromPath(path ?? [item.end]);
    }
    if (kind === "heuristic") {
      return freeReduce(reverseMoves(item.tour));
    }
    const moves: Dir[] = [];
    let cur = item.end;
    for (let i = 0; i < item.optimal; i++) {
      const d = rng.pick(DIRS.filter((x) => isOpen(item.tiles, step(cur, x))));
      moves.push(d);
      cur = step(cur, d);
    }
    return moves;
  },

  view(item) {
    return { tiles: item.tiles, start: item.start, agent: item.end };
  },
};
