import { describe, expect, test } from "bun:test";
import { UsageMeter } from "../src/harness/usage.ts";

const step = (input: number, cacheRead: number, cacheWrite: number, output: number, cost: number) => ({
  usage: {
    inputTokens: input,
    inputTokenDetails: { noCacheTokens: input - cacheRead, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite },
    outputTokens: output,
    outputTokenDetails: { textTokens: output, reasoningTokens: 0 },
    totalTokens: input + output,
  },
  providerMetadata: { openrouter: { provider: "P", usage: { cost } } },
});

describe("UsageMeter", () => {
  test("splits cached input and prices it at list rates", () => {
    const m = new UsageMeter();
    // First call writes 2,800 tokens to the cache; the second reads them back.
    m.add(step(2821, 0, 2818, 5, 0.000355) as never);
    m.add(step(2821, 2810, 8, 5, 0.0000319) as never);
    const price = { input: 1e-7, output: 5e-7, cacheRead: 1e-8, cacheWrite: 1.25e-7 };
    const u = m.toUsage(price);
    expect(u).toMatchObject({ inputTokens: 5642, cacheReadTokens: 2810, cacheWriteTokens: 2826, outputTokens: 10 });
    // uncached 6 × 1e-7 + reads 2810 × 1e-8 + writes 2826 × 1.25e-7 + output 10 × 5e-7
    expect(u.listCostUsd).toBeCloseTo(6e-7 + 2.81e-5 + 3.5325e-4 + 5e-6, 10);
    expect(u.costUsd).toBeCloseTo(0.0003869, 7);
  });

  test("without prices there is no list cost", () => {
    const m = new UsageMeter();
    m.add(step(100, 0, 0, 20, 0.001) as never);
    expect(m.toUsage().listCostUsd).toBeUndefined();
  });
});
