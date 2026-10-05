/** 32-bit FNV-1a hash of a string. Used to turn item keys into seeds. */
export function fnv1a32(input: string): number {
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return hash >>> 0;
}

/** cyrb53 hash as a 14-char hex string. Used for item content hashes. */
export function contentHash(input: string, seed = 0): string {
  let h1 = 0xde_ad_be_ef ^ seed;
  let h2 = 0x41_c6_ce_57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2_654_435_761);
    h2 = Math.imul(h2 ^ ch, 1_597_334_677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909);
  const value = 4_294_967_296 * (2_097_151 & h2) + (h1 >>> 0);
  return value.toString(16).padStart(14, "0");
}

/** Seeded PRNG (mulberry32). Every random choice in core goes through this. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d_2b_79_f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      throw new Error(`Rng.int: maxExclusive must be positive, got ${maxExclusive}`);
    }
    return Math.floor(this.next() * maxExclusive);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(items.length)];
    if (item === undefined) {
      throw new Error("Rng.pick: empty array");
    }
    return item;
  }

  /** Fisher-Yates shuffle of a copy. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const a = out[i] as T;
      out[i] = out[j] as T;
      out[j] = a;
    }
    return out;
  }
}
