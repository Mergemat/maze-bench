import { describe, expect, test } from "bun:test";
import {
  bfsDistances,
  cellCenters,
  countOpen,
  DIRS,
  generateMaze,
  isOpen,
  openTiles,
  placeStartGoal,
  posKey,
  Rng,
  step,
} from "../src/index.ts";

function edgeCount(tiles: readonly string[]): number {
  let edges = 0;
  for (const p of openTiles(tiles)) {
    for (const d of ["D", "R"] as const) {
      if (isOpen(tiles, step(p, d))) {
        edges++;
      }
    }
  }
  return edges;
}

describe("generateMaze", () => {
  test("same seed gives the same maze", () => {
    const a = generateMaze({ cells: 8, braid: 0.3 }, new Rng(123));
    const b = generateMaze({ cells: 8, braid: 0.3 }, new Rng(123));
    expect(a).toEqual(b);
  });

  test("golden output for a fixed seed", () => {
    // If this changes, the generator changed: bump the suite version and rewrite manifests.
    expect(generateMaze({ cells: 3, braid: 0 }, new Rng(1))).toMatchInlineSnapshot(`
      [
        "#######",
        "#...#.#",
        "###.#.#",
        "#...#.#",
        "#.#.#.#",
        "#.#...#",
        "#######",
      ]
    `);
  });

  for (const cells of [2, 3, 5, 8, 12, 16]) {
    for (const braid of [0, 0.1, 0.5, 1]) {
      test(`cells=${cells} braid=${braid}: shape, border, connectivity`, () => {
        for (let seed = 0; seed < 15; seed++) {
          const tiles = generateMaze({ cells, braid }, new Rng(seed));
          const size = 2 * cells + 1;
          expect(tiles).toHaveLength(size);
          for (const row of tiles) {
            expect(row).toHaveLength(size);
            expect(row).toMatch(/^[#.]+$/);
          }
          expect(tiles[0]).toBe("#".repeat(size));
          expect(tiles[size - 1]).toBe("#".repeat(size));
          for (const row of tiles) {
            expect(row[0]).toBe("#");
            expect(row[size - 1]).toBe("#");
          }
          // Every cell centre is open and every open tile is reachable.
          for (const c of cellCenters(cells)) {
            expect(isOpen(tiles, c)).toBe(true);
          }
          const first = openTiles(tiles)[0];
          expect(first).toBeDefined();
          expect(bfsDistances(tiles, first as { r: number; c: number }).size).toBe(countOpen(tiles));
        }
      });
    }
  }

  test("braid 0 gives a perfect maze (a tree)", () => {
    for (let seed = 0; seed < 20; seed++) {
      const tiles = generateMaze({ cells: 8, braid: 0 }, new Rng(seed));
      expect(countOpen(tiles)).toBe(2 * 64 - 1);
      expect(edgeCount(tiles)).toBe(countOpen(tiles) - 1);
    }
  });

  test("Wilson mazes are bushy: many dead ends and forks", () => {
    let dead = 0;
    let forks = 0;
    let cells = 0;
    for (let seed = 0; seed < 20; seed++) {
      const tiles = generateMaze({ cells: 12, braid: 0 }, new Rng(seed));
      for (const c of cellCenters(12)) {
        const exits = DIRS.filter((d) => isOpen(tiles, step(c, d))).length;
        cells++;
        dead += exits === 1 ? 1 : 0;
        forks += exits >= 3 ? 1 : 0;
      }
    }
    // A depth-first backtracker gives about 10% of each; a uniform spanning tree about 30% and 24%.
    expect(dead / cells).toBeGreaterThan(0.25);
    expect(forks / cells).toBeGreaterThan(0.2);
  });

  test("braiding adds loops", () => {
    let loops = 0;
    for (let seed = 0; seed < 20; seed++) {
      const tiles = generateMaze({ cells: 8, braid: 0.5 }, new Rng(seed));
      loops += edgeCount(tiles) - (countOpen(tiles) - 1);
    }
    expect(loops).toBeGreaterThan(20);
  });

  test("rejects invalid sizes", () => {
    expect(() => generateMaze({ cells: 1, braid: 0 }, new Rng(1))).toThrow();
    expect(() => generateMaze({ cells: 2.5, braid: 0 }, new Rng(1))).toThrow();
  });
});

describe("placeStartGoal", () => {
  test("start and goal are distinct cell centres with the reported distance", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = new Rng(seed);
      const tiles = generateMaze({ cells: 5, braid: 0.1 }, rng);
      const { start, goal, distance } = placeStartGoal(tiles, rng);
      expect(start.r % 2).toBe(1);
      expect(goal.c % 2).toBe(1);
      expect(distance).toBeGreaterThan(0);
      expect(bfsDistances(tiles, start).get(posKey(goal))).toBe(distance);
    }
  });

  test("goal is far from start (at least the 60th percentile)", () => {
    const rng = new Rng(9);
    const tiles = generateMaze({ cells: 8, braid: 0.1 }, rng);
    const { start, distance } = placeStartGoal(tiles, rng);
    const dist = bfsDistances(tiles, start);
    const all = cellCenters(8)
      .map((c) => dist.get(posKey(c)) ?? 0)
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    expect(distance).toBeGreaterThanOrEqual(all[Math.floor(0.6 * all.length)] as number);
  });

  test("DIRS order is fixed", () => {
    expect(DIRS).toEqual(["U", "D", "L", "R"]);
  });
});
