import { bfsDistances } from "./bfs.ts";
import { DELTA, DIRS, OPEN, type Pos, posKey, type Tiles, WALL } from "./grid.ts";
import type { Rng } from "./rng.ts";

export interface MazeSpec {
  /** Cells per side. The tile grid is (2n+1) x (2n+1). */
  cells: number;
  /** Probability of opening each dead end into a neighbour, adding loops. 0 = perfect maze. */
  braid: number;
}

function cellCenters(cells: number): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      out.push({ r: 2 * r + 1, c: 2 * c + 1 });
    }
  }
  return out;
}

function isCenter(size: number, p: Pos): boolean {
  return p.r % 2 === 1 && p.c % 2 === 1 && p.r > 0 && p.c > 0 && p.r < size - 1 && p.c < size - 1;
}

/**
 * Seeded Wilson maze (uniform random spanning tree) with optional braiding.
 * Returns tiles where `#` is wall and `.` is open. Every open tile is reachable.
 */
export function generateMaze(spec: MazeSpec, rng: Rng): string[] {
  const { cells, braid } = spec;
  if (!Number.isInteger(cells) || cells < 2) {
    throw new Error(`generateMaze: cells must be an integer >= 2, got ${cells}`);
  }
  const size = 2 * cells + 1;
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(WALL));
  const set = (p: Pos) => {
    (grid[p.r] as string[])[p.c] = OPEN;
  };
  const get = (p: Pos) => grid[p.r]?.[p.c];

  // Wilson's algorithm: a uniform random spanning tree over the cells, built from loop-erased
  // random walks. Unlike a depth-first backtracker (long corridors, few forks) every perfect
  // maze is equally likely, which gives about three times as many forks and dead ends.
  const centers = cellCenters(cells);
  const key = (p: Pos) => p.r * size + p.c;
  const inTree = new Set<number>();
  const first = rng.pick(centers);
  inTree.add(key(first));
  set(first);
  for (const startCell of rng.shuffle(centers)) {
    if (inTree.has(key(startCell))) {
      continue;
    }
    // Random walk until it hits the tree, remembering only the last exit from each cell,
    // which erases loops implicitly.
    const exit = new Map<number, Pos>();
    let cur = startCell;
    while (!inTree.has(key(cur))) {
      const options = DIRS.map((d) => ({ r: cur.r + 2 * DELTA[d].dr, c: cur.c + 2 * DELTA[d].dc })).filter((n) =>
        isCenter(size, n),
      );
      const next = rng.pick(options);
      exit.set(key(cur), next);
      cur = next;
    }
    // Carve the loop-erased path into the tree.
    cur = startCell;
    while (!inTree.has(key(cur))) {
      const next = exit.get(key(cur)) as Pos;
      set(cur);
      set({ r: (cur.r + next.r) / 2, c: (cur.c + next.c) / 2 });
      inTree.add(key(cur));
      cur = next;
    }
  }

  // Braid: open some dead ends into a walled neighbour cell.
  if (braid > 0) {
    for (const cell of rng.shuffle(cellCenters(cells))) {
      const exits = DIRS.filter((d) => get({ r: cell.r + DELTA[d].dr, c: cell.c + DELTA[d].dc }) === OPEN);
      if (exits.length !== 1 || !rng.chance(braid)) {
        continue;
      }
      const candidates = DIRS.filter((d) => {
        const wall = { r: cell.r + DELTA[d].dr, c: cell.c + DELTA[d].dc };
        const next = { r: cell.r + 2 * DELTA[d].dr, c: cell.c + 2 * DELTA[d].dc };
        return get(wall) === WALL && isCenter(size, next);
      });
      if (candidates.length > 0) {
        const d = rng.pick(candidates);
        set({ r: cell.r + DELTA[d].dr, c: cell.c + DELTA[d].dc });
      }
    }
  }

  return grid.map((row) => row.join(""));
}

/**
 * Pick a start cell uniformly, then a goal cell whose BFS distance from the start
 * is at or above the given percentile of all cell distances.
 */
export function placeStartGoal(tiles: Tiles, rng: Rng, percentile = 0.6): { start: Pos; goal: Pos; distance: number } {
  const size = tiles.length;
  const cells = (size - 1) / 2;
  const centers = cellCenters(cells);
  const start = rng.pick(centers);
  const dist = bfsDistances(tiles, start);
  const withDist = centers
    .map((p) => ({ p, d: dist.get(posKey(p)) ?? -1 }))
    .filter((x) => x.d > 0)
    .sort((a, b) => a.d - b.d);
  const threshold = withDist[Math.min(withDist.length - 1, Math.floor(percentile * withDist.length))]?.d ?? 1;
  const far = withDist.filter((x) => x.d >= threshold);
  const goal = rng.pick(far);
  return { start, goal: goal.p, distance: goal.d };
}

export { cellCenters };
