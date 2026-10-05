import { describe, expect, test } from "bun:test";
import { executeMoves, extractAnswer, freeReduce, parseMoves, reverseMoves } from "../src/index.ts";

const TILES = ["#####", "#...#", "#.#.#", "#...#", "#####"];

describe("executeMoves", () => {
  test("stops at the first wall and reports its 1-based index", () => {
    const run = executeMoves(TILES, { r: 1, c: 1 }, ["R", "R", "R", "D"]);
    expect(run.firstInvalid).toBe(3);
    expect(run.end).toEqual({ r: 1, c: 3 });
    expect(run.positions).toHaveLength(3);
  });

  test("stops at the goal and ignores later moves", () => {
    const run = executeMoves(TILES, { r: 1, c: 1 }, ["R", "R", "U", "U"], { r: 1, c: 3 });
    expect(run.reachedGoalAt).toBe(2);
    expect(run.firstInvalid).toBeNull();
  });

  test("goal on the start is reached at 0", () => {
    expect(executeMoves(TILES, { r: 1, c: 1 }, [], { r: 1, c: 1 }).reachedGoalAt).toBe(0);
  });
});

describe("parseMoves", () => {
  test.each([
    ["R R D", ["R", "R", "D"]],
    ["right, right, down", ["R", "R", "D"]],
    ["[R, R, D]", ["R", "R", "D"]],
    ["RRD", ["R", "R", "D"]],
    ["U-D-L-R.", ["U", "D", "L", "R"]],
    ["up up LEFT", ["U", "U", "L"]],
    ["north east", ["U", "R"]],
    ["none", []],
    ["NO ROUTE", []],
    ["no valid path", []],
    ["unreachable", []],
  ])("%p", (text, expected) => {
    expect(parseMoves(text)).toEqual(expected as never);
  });

  test("rejects unknown tokens", () => {
    expect(parseMoves("R R jump")).toBeNull();
    expect(parseMoves("R2")).toBeNull();
  });
});

describe("freeReduce and reverseMoves", () => {
  test("cancels back-and-forth moves", () => {
    expect(freeReduce(["R", "U", "D", "R", "L", "L"])).toEqual([]);
    expect(freeReduce(["R", "U", "U", "D", "R"])).toEqual(["R", "U", "R"]);
  });

  test("reverse undoes a walk", () => {
    expect(reverseMoves(["R", "R", "D"])).toEqual(["U", "L", "L"]);
    const run = executeMoves(TILES, { r: 1, c: 1 }, ["R", "R", "D", ...reverseMoves(["R", "R", "D"])]);
    expect(run.end).toEqual({ r: 1, c: 1 });
  });
});

describe("extractAnswer", () => {
  test("takes the last ANSWER line", () => {
    expect(extractAnswer("ANSWER: U\nthinking...\nANSWER: L, R")).toEqual({ content: "L, R", status: "ok" });
  });

  test("tolerates markdown and case", () => {
    expect(extractAnswer("**Answer:** `R R D`")).toEqual({ content: "R R D", status: "ok" });
    expect(extractAnswer("final answer = 3")).toEqual({ content: "3", status: "ok" });
  });

  test("falls back to the last non-empty line", () => {
    expect(extractAnswer("The route is:\nR R D\n\n")).toEqual({ content: "R R D", status: "fallback" });
  });

  test("empty text gives null", () => {
    expect(extractAnswer("  \n ")).toBeNull();
  });
});
