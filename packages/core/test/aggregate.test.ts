import { describe, expect, test } from "bun:test";
import {
  aggregate,
  enumerateItems,
  type ItemResult,
  mergeItems,
  pairedComposite,
  parseRunJsonl,
  type RunFile,
  type RunHeader,
  SCHEMA_VERSION,
  SMOKE_SUITE,
} from "../src/index.ts";

function header(key: string, startedAt: string, epochs = 1): RunHeader {
  return {
    type: "run",
    schemaVersion: SCHEMA_VERSION as "2.0.0",
    runId: `${key}-${startedAt}`,
    suite: { id: "smoke", version: "2.0.0", split: "public" },
    subject: {
      kind: "model",
      key,
      displayName: key,
      creator: "test",
      provider: "openrouter",
      modelId: `test/${key}`,
      reasoningEffort: "default",
      openWeights: false,
    },
    settings: { epochs, maxOutputTokens: 1000, temperature: null, concurrency: 1 },
    harness: { gitSha: "abc", promptVersion: "2.0.0", aiSdkVersion: "7", runtime: "bun" },
    startedAt,
  };
}

function item(itemId: string, score: number, epoch = 0, status: "scored" | "error" = "scored"): ItemResult {
  const [task, level] = itemId.split("/");
  return {
    type: "item",
    itemId,
    itemHash: "h",
    task: task as never,
    level: Number(level?.slice(1)),
    seed: 1,
    epoch,
    status,
    score,
    outcome: score === 1 ? "success" : "wrong_answer",
    metrics: { spl: score },
    answer: { text: "x", parse: "ok", value: null },
    usage: { inputTokens: 10, outputTokens: 5, reasoningTokens: 0, costUsd: 0.001 },
    latencyMs: 100,
    calls: 1,
    providers: ["p"],
    finishedAt: "2026-10-05T00:00:00Z",
  };
}

const refs = enumerateItems(SMOKE_SUITE);

describe("aggregate", () => {
  test("perfect and zero subjects", () => {
    const good: RunFile = { header: header("good", "2026-10-01"), items: refs.map((r) => item(r.itemId, 1)) };
    const bad: RunFile = { header: header("bad", "2026-10-01"), items: refs.map((r) => item(r.itemId, 0)) };
    const [first, second] = aggregate([bad, good], SMOKE_SUITE);
    expect(first?.subject.key).toBe("good");
    expect(first?.composite?.mean).toBe(1);
    expect(second?.composite?.mean).toBe(0);
    expect(first?.scored).toBe(refs.length);
    expect(first?.usage.costUsd).toBeCloseTo(0.001 * refs.length);
    expect(first?.tasks.plan?.levels.map((l) => l.level)).toEqual([1, 2]);
  });

  test("composite is null when a task is missing", () => {
    const partial: RunFile = {
      header: header("p", "2026-10-01"),
      items: refs.filter((r) => r.task !== "fog").map((r) => item(r.itemId, 1)),
    };
    expect(aggregate([partial], SMOKE_SUITE)[0]?.composite).toBeNull();
  });

  test("later scored results replace earlier ones, errors only fill gaps", () => {
    const id = refs[0]?.itemId as string;
    const early: RunFile = { header: header("m", "2026-10-01"), items: [item(id, 0)] };
    const late: RunFile = { header: header("m", "2026-10-02"), items: [item(id, 1)] };
    const failed: RunFile = { header: header("m", "2026-10-03"), items: [item(id, 0, 0, "error")] };
    const merged = mergeItems([failed, late, early]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.score).toBe(1);
  });

  test("pass^k with several epochs", () => {
    const items = refs.flatMap((r) => [item(r.itemId, 1, 0), item(r.itemId, r.index === 0 ? 0 : 1, 1)]);
    const s = aggregate([{ header: header("e", "2026-10-01", 2), items }], SMOKE_SUITE)[0];
    expect(s?.tasks.local?.passHat[2]).toBeCloseTo(0.5);
    expect(s?.tasks.local?.passAt[2]).toBe(1);
  });

  test("paired composite difference", () => {
    const a = refs.map((r) => item(r.itemId, 1));
    const b = refs.map((r) => item(r.itemId, 0));
    const d = pairedComposite(a, b, SMOKE_SUITE);
    expect(d.mean).toBe(1);
    expect(d.n).toBe(refs.length);
  });
});

describe("parseRunJsonl", () => {
  test("round-trips and reports bad lines", () => {
    const h = header("x", "2026-10-01");
    const good = [JSON.stringify(h), JSON.stringify(item("plan/L1/0", 1))].join("\n");
    expect(parseRunJsonl(good).items).toHaveLength(1);
    const bad = [JSON.stringify(h), JSON.stringify({ ...item("plan/L1/0", 1), score: 2 })].join("\n");
    expect(() => parseRunJsonl(bad, "f.jsonl")).toThrow(/f\.jsonl:2/);
  });
});
