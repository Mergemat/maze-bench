import {
  BASELINE_KINDS,
  buildItem,
  enumerateItems,
  type ItemResult,
  itemHash,
  PROMPT_VERSION,
  runBaseline,
  SCHEMA_VERSION,
  type Suite,
  suiteKey,
} from "@mazebench/core";
import { gitSha } from "./env.ts";
import { RunWriter, runPath } from "./storage.ts";

const NAMES = {
  oracle: "Oracle (BFS)",
  random: "Random",
  heuristic: "Heuristic",
} as const;

/** Write one results file per baseline. Baselines are deterministic, so files are overwritten in place. */
export function writeBaselines(suite: Suite, log: (s: string) => void): void {
  const refs = enumerateItems(suite);
  for (const kind of BASELINE_KINDS) {
    const key = `baseline-${kind}`;
    const writer = new RunWriter(runPath("public", suiteKey(suite), key, "baseline.jsonl"), {
      type: "run",
      schemaVersion: SCHEMA_VERSION as "2.0.0",
      runId: `${key}_${suite.id}@${suite.version}`,
      suite: { id: suite.id, version: suite.version, split: "public" },
      subject: {
        kind: "baseline",
        key,
        displayName: NAMES[kind],
        creator: "baseline",
        provider: "baseline",
        modelId: kind,
        reasoningEffort: "default",
        openWeights: true,
      },
      settings: { epochs: 1, maxOutputTokens: 1, temperature: null, concurrency: 1 },
      harness: { gitSha: gitSha().replace(/-dirty$/, ""), promptVersion: PROMPT_VERSION, aiSdkVersion: "n/a", runtime: "baseline" },
      // Fixed so regenerating an unchanged suite gives a byte-identical file.
      startedAt: "2026-01-01T00:00:00.000Z",
    });
    let total = 0;
    for (const ref of refs) {
      const item = buildItem(ref);
      const { scored, value } = runBaseline(ref, kind);
      const result: ItemResult = {
        type: "item",
        itemId: ref.itemId,
        itemHash: itemHash(ref, item),
        task: ref.task,
        level: ref.level.level,
        seed: ref.seed,
        epoch: 0,
        status: "scored",
        score: scored.score,
        outcome: scored.outcome,
        metrics: scored.metrics,
        ...(value === null ? {} : { answer: { text: JSON.stringify(value), parse: "ok" as const, value } }),
        ...(scored.trace ? { trace: scored.trace } : {}),
        usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, costUsd: 0 },
        latencyMs: 0,
        calls: 0,
        providers: [],
        finishedAt: "2026-01-01T00:00:00.000Z",
      };
      writer.append(result);
      total += scored.score;
    }
    log(`${key}: ${refs.length} items, mean ${(total / refs.length).toFixed(3)} -> ${writer.path}`);
  }
}
