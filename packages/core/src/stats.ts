import { Rng } from "./rng.ts";

export interface Interval {
  mean: number;
  lo: number;
  hi: number;
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) {
    return Number.NaN;
  }
  let s = 0;
  for (const x of xs) {
    s += x;
  }
  return s / xs.length;
}

/** Wilson score interval for a binomial proportion. */
export function wilson(successes: number, n: number, z = 1.96): Interval {
  if (n === 0) {
    return { mean: Number.NaN, lo: 0, hi: 1 };
  }
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { mean: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/** Linear-interpolated quantile of a sorted array. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) {
    return Number.NaN;
  }
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}

export interface BootstrapOptions {
  resamples?: number;
  seed?: number;
  /** Two-sided level, default 0.95. */
  level?: number;
}

function percentileInterval(estimate: number, samples: number[], level: number): Interval {
  samples.sort((a, b) => a - b);
  const alpha = (1 - level) / 2;
  return { mean: estimate, lo: quantile(samples, alpha), hi: quantile(samples, 1 - alpha) };
}

/**
 * Percentile cluster bootstrap of the mean. Each cluster is one item with all its epochs;
 * a cluster's value is the mean of its scores, and clusters are resampled with replacement.
 */
export function bootstrapMean(clusters: readonly (readonly number[])[], opts: BootstrapOptions = {}): Interval {
  const values = clusters.filter((c) => c.length > 0).map((c) => mean(c));
  return bootstrapValues(values, opts);
}

export function bootstrapValues(values: readonly number[], opts: BootstrapOptions = {}): Interval {
  const { resamples = 2000, seed = 1, level = 0.95 } = opts;
  if (values.length === 0) {
    return { mean: Number.NaN, lo: Number.NaN, hi: Number.NaN };
  }
  const rng = new Rng(seed);
  const n = values.length;
  const samples: number[] = [];
  for (let b = 0; b < resamples; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      s += values[rng.int(n)] as number;
    }
    samples.push(s / n);
  }
  return percentileInterval(mean(values), samples, level);
}

/**
 * Stratified bootstrap of an equal-weight mean over strata (tasks).
 * Each stratum is a list of per-item values; items are resampled within their stratum.
 */
export function bootstrapStratified(strata: readonly (readonly number[])[], opts: BootstrapOptions = {}): Interval {
  const { resamples = 2000, seed = 1, level = 0.95 } = opts;
  const groups = strata.filter((s) => s.length > 0);
  if (groups.length === 0) {
    return { mean: Number.NaN, lo: Number.NaN, hi: Number.NaN };
  }
  const rng = new Rng(seed);
  const samples: number[] = [];
  for (let b = 0; b < resamples; b++) {
    let total = 0;
    for (const g of groups) {
      let s = 0;
      for (let i = 0; i < g.length; i++) {
        s += g[rng.int(g.length)] as number;
      }
      total += s / g.length;
    }
    samples.push(total / groups.length);
  }
  return percentileInterval(mean(groups.map((g) => mean(g))), samples, level);
}

/** Product form of C(a, k) / C(b, k), stable for large inputs. */
function combRatio(a: number, b: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) {
    r *= (a - i) / (b - i);
  }
  return Math.max(0, r);
}

/** Unbiased pass@k for one item with n attempts and c successes (Chen et al. 2021). */
export function passAtK(n: number, c: number, k: number): number | null {
  if (n < k) {
    return null;
  }
  if (n - c < k) {
    return 1;
  }
  return 1 - combRatio(n - c, n, k);
}

/** Unbiased pass^k (all k succeed) for one item (Yao et al. 2024). */
export function passHatK(n: number, c: number, k: number): number | null {
  if (n < k) {
    return null;
  }
  return c < k ? 0 : combRatio(c, n, k);
}
