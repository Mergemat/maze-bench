import { describe, expect, test } from "bun:test";
import { contentHash, fnv1a32, Rng } from "../src/index.ts";

describe("fnv1a32", () => {
  test("matches reference vectors", () => {
    expect(fnv1a32("")).toBe(0x81_1c_9d_c5);
    expect(fnv1a32("a")).toBe(0xe4_0c_29_2c);
    expect(fnv1a32("foobar")).toBe(0xbf_9c_f9_68);
  });
});

describe("Rng", () => {
  test("same seed gives the same sequence", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(Array.from({ length: 10 }, () => b.next()));
  });

  test("different seeds diverge", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  test("int stays in range and covers it", () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const x = rng.int(5);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(5);
      seen.add(x);
    }
    expect(seen.size).toBe(5);
  });

  test("shuffle returns a permutation and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = new Rng(3).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  test("int rejects non-positive bounds", () => {
    expect(() => new Rng(1).int(0)).toThrow();
  });
});

describe("contentHash", () => {
  test("is stable and sensitive to input", () => {
    expect(contentHash("maze")).toBe(contentHash("maze"));
    expect(contentHash("maze")).not.toBe(contentHash("maze "));
    expect(contentHash("maze")).toHaveLength(14);
  });
});
