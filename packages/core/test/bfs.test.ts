import { describe, expect, test } from "bun:test";
import { bfsDistances, executeMoves, movesFromPath, posKey, shortestDistance, shortestPath } from "../src/index.ts";

// S at (1,1), G at (1,5). The direct route is blocked at (1,3); the detour goes through row 3.
const TILES = ["#######", "#..#..#", "#.##..#", "#.....#", "#######"];
const S = { r: 1, c: 1 };
const G = { r: 1, c: 5 };

describe("shortestPath", () => {
  test("finds the detour", () => {
    const path = shortestPath(TILES, S, G);
    expect(path).not.toBeNull();
    expect(path?.length).toBe(9);
    const moves = movesFromPath(path ?? []);
    expect(moves.join("")).toBe("DDRRRUUR");
    const run = executeMoves(TILES, S, moves, G);
    expect(run.reachedGoalAt).toBe(8);
  });

  test("distance matches path length", () => {
    expect(shortestDistance(TILES, S, G)).toBe(8);
    expect(bfsDistances(TILES, S).get(posKey(G))).toBe(8);
  });

  test("same start and goal is length 0", () => {
    expect(shortestDistance(TILES, S, S)).toBe(0);
  });

  test("respects a passable filter", () => {
    const blockRow3 = (p: { r: number; c: number }) => p.r !== 3 && TILES[p.r]?.[p.c] === ".";
    expect(shortestPath(TILES, S, G, blockRow3)).toBeNull();
  });

  test("unreachable goal returns null", () => {
    const sealed = ["#####", "#.#.#", "#####"];
    expect(shortestPath(sealed, { r: 1, c: 1 }, { r: 1, c: 3 })).toBeNull();
  });
});

describe("movesFromPath", () => {
  test("rejects non-adjacent steps", () => {
    expect(() =>
      movesFromPath([
        { r: 1, c: 1 },
        { r: 1, c: 3 },
      ]),
    ).toThrow();
  });
});
