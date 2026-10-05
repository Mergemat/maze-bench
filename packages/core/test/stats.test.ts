import { describe, expect, test } from "bun:test";
import {
  bootstrapMean,
  bootstrapStratified,
  bootstrapValues,
  mean,
  passAtK,
  passHatK,
  quantile,
  spl,
  wilson,
} from "../src/index.ts";

function choose(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  let r = 1;
  for (let i = 1; i <= k; i++) {
    r = (r * (n - k + i)) / i;
  }
  return r;
}

describe("basic statistics", () => {
  test("mean and quantile", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(Number.isNaN(mean([]))).toBe(true);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
    expect(quantile([1, 2, 3], 0.5)).toBe(2);
  });

  test("wilson matches a reference value", () => {
    // 8/10 at 95%: [0.4902, 0.9433] (standard Wilson interval)
    const w = wilson(8, 10);
    expect(w.mean).toBe(0.8);
    expect(w.lo).toBeCloseTo(0.4902, 3);
    expect(w.hi).toBeCloseTo(0.9433, 3);
  });

  test("wilson stays inside [0, 1] at the edges", () => {
    expect(wilson(0, 20).lo).toBe(0);
    expect(wilson(20, 20).hi).toBe(1);
  });
});

describe("pass@k and pass^k", () => {
  test("match the combinatorial definitions", () => {
    for (let n = 1; n <= 8; n++) {
      for (let c = 0; c <= n; c++) {
        for (let k = 1; k <= n; k++) {
          expect(passAtK(n, c, k)).toBeCloseTo(1 - choose(n - c, k) / choose(n, k), 10);
          expect(passHatK(n, c, k)).toBeCloseTo(choose(c, k) / choose(n, k), 10);
        }
      }
    }
  });

  test("k = 1 both equal c/n", () => {
    expect(passAtK(4, 3, 1)).toBeCloseTo(0.75);
    expect(passHatK(4, 3, 1)).toBeCloseTo(0.75);
  });

  test("not enough samples gives null", () => {
    expect(passAtK(2, 1, 3)).toBeNull();
    expect(passHatK(2, 1, 3)).toBeNull();
  });
});

describe("bootstrap", () => {
  test("is deterministic for a fixed seed", () => {
    const xs = [0, 1, 1, 0, 1, 1, 1, 0, 1, 1];
    expect(bootstrapValues(xs, { seed: 3 })).toEqual(bootstrapValues(xs, { seed: 3 }));
  });

  test("interval contains the mean and has sensible width", () => {
    const xs = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 1 : 0));
    const ci = bootstrapValues(xs);
    expect(ci.mean).toBe(0.5);
    expect(ci.lo).toBeLessThan(0.5);
    expect(ci.hi).toBeGreaterThan(0.5);
    // Normal approximation half-width is 1.96 * 0.05 = 0.098.
    expect(ci.hi - ci.lo).toBeGreaterThan(0.16);
    expect(ci.hi - ci.lo).toBeLessThan(0.24);
  });

  test("constant data gives a zero-width interval", () => {
    const ci = bootstrapValues([1, 1, 1, 1]);
    expect(ci).toEqual({ mean: 1, lo: 1, hi: 1 });
  });

  test("cluster bootstrap averages epochs within an item first", () => {
    const ci = bootstrapMean([[1, 0], [1, 1], [0, 0]]);
    expect(ci.mean).toBeCloseTo(0.5);
  });

  test("stratified composite is the mean of stratum means", () => {
    const ci = bootstrapStratified([[1, 1, 1, 1], [0, 0], [0.5]]);
    expect(ci.mean).toBeCloseTo(0.5);
  });

  test("empty input gives NaN", () => {
    expect(Number.isNaN(bootstrapValues([]).mean)).toBe(true);
  });
});

describe("spl", () => {
  test("is optimal/taken on success and 0 on failure", () => {
    expect(spl(true, 10, 10)).toBe(1);
    expect(spl(true, 10, 20)).toBe(0.5);
    expect(spl(false, 10, 10)).toBe(0);
    // A lucky shortcut through unseen tiles cannot score above 1.
    expect(spl(true, 10, 8)).toBe(1);
  });
});
