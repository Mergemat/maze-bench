// Fake results for working on the dashboard before real sweeps exist. Every model walks the real
// core mazes with a noisy shortest-path policy, so scores, costs and replays all look plausible.
//
//   bun run mock      # writes .mock-results/
//   bun run dev:mock  # next dev against it
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildItem,
  CORE_SUITE,
  DIRS,
  type Dir,
  enumerateItems,
  fnv1a32,
  type ItemResult,
  isOpen,
  itemHash,
  MazeEnv,
  type MazeItem,
  PROMPT_VERSION,
  Rng,
  type RunHeader,
  SCHEMA_VERSION,
  samePos,
  shortestPath,
  step,
  suiteKey,
} from "@mazebench/core";

const OUT = fileURLToPath(new URL("../.mock-results", import.meta.url));
const REAL = fileURLToPath(new URL("../../results", import.meta.url));

interface MockModel {
  id: string;
  name: string;
  creator: string;
  open?: boolean;
  /** USD per million input / output tokens. */
  price: [number, number];
  /** Effort -> skill (0-1). One leaderboard entry per effort. */
  efforts: Record<string, number>;
}

const MODELS: MockModel[] = [
  {
    id: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    creator: "openai",
    price: [2.5, 15],
    efforts: { low: 0.62, medium: 0.78, high: 0.88, xhigh: 0.92 },
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    creator: "openai",
    price: [0.4, 2.4],
    efforts: { low: 0.38, medium: 0.55, high: 0.66 },
  },
  {
    id: "gpt-oss-120b",
    name: "gpt-oss-120b",
    creator: "openai",
    open: true,
    price: [0.1, 0.5],
    efforts: { low: 0.2, high: 0.41 },
  },
  {
    id: "claude-fable-5.1",
    name: "Claude Fable 5.1",
    creator: "anthropic",
    price: [5, 25],
    efforts: { low: 0.74, medium: 0.86, high: 0.94 },
  },
  {
    id: "claude-opus-5.5",
    name: "Claude Opus 5.5",
    creator: "anthropic",
    price: [5, 25],
    efforts: { low: 0.7, high: 0.89 },
  },
  {
    id: "claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    creator: "anthropic",
    price: [3, 15],
    efforts: { low: 0.58, high: 0.8 },
  },
  { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", creator: "anthropic", price: [1, 5], efforts: { default: 0.33 } },
  {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    creator: "google",
    price: [2, 12],
    efforts: { low: 0.64, high: 0.85 },
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    creator: "google",
    price: [0.3, 2.5],
    efforts: { minimal: 0.3, medium: 0.52, high: 0.63 },
  },
  { id: "grok-4.7", name: "Grok 4.7", creator: "x-ai", price: [3, 15], efforts: { low: 0.5, high: 0.76 } },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro (0813)",
    creator: "deepseek",
    open: true,
    price: [0.55, 2.2],
    efforts: { default: 0.6, high: 0.71 },
  },
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    creator: "deepseek",
    open: true,
    price: [0.15, 0.6],
    efforts: { default: 0.36 },
  },
  { id: "qwen3.8-max", name: "Qwen3.8 Max (0902)", creator: "qwen", price: [1.2, 6], efforts: { default: 0.57 } },
  {
    id: "qwen3.8-27b",
    name: "Qwen3.8 27B",
    creator: "qwen",
    open: true,
    price: [0.1, 0.4],
    efforts: { default: 0.18 },
  },
  {
    id: "kimi-k3",
    name: "Kimi K3",
    creator: "moonshotai",
    open: true,
    price: [0.6, 2.5],
    efforts: { default: 0.54, high: 0.67 },
  },
  { id: "glm-5.3", name: "GLM-5.3", creator: "z-ai", open: true, price: [0.6, 2.2], efforts: { default: 0.5 } },
  {
    id: "minimax-m3",
    name: "MiniMax M3",
    creator: "minimax",
    open: true,
    price: [0.3, 1.2],
    efforts: { default: 0.42 },
  },
];

// How much each effort multiplies the reasoning spend, relative to "default".
const EFFORT_TOKENS: Record<string, number> = {
  none: 0.3,
  minimal: 0.4,
  low: 0.6,
  default: 1,
  medium: 1.3,
  high: 2.2,
  xhigh: 3.5,
};
// Harder conditions lower the success chance: fog hides the map, bigger levels are longer.
const TASK_PENALTY: Record<string, number> = { full: 0.05, once: -0.08, fog: -0.05 };
const LEVEL_PENALTY: Record<number, number> = { 1: 0.12, 2: 0, 3: -0.15 };

const clamp = (x: number, lo = 0.02, hi = 0.98) => Math.min(hi, Math.max(lo, x));

/** Walk the maze: mostly shortest-path steps, with wrong turns and the odd wall bump. */
function walk(item: MazeItem, env: MazeEnv, rng: Rng, skill: number, solve: boolean): void {
  const noise = 0.04 + (1 - skill) * 0.3;
  const limit = solve ? Number.POSITIVE_INFINITY : Math.max(6, Math.round(item.optimal * (0.3 + rng.next() * 1.4)));
  const cap = item.optimal * 6 + 50;
  while (!env.done && env.moves < limit) {
    let dir: Dir;
    if (env.moves > cap || !rng.chance(noise)) {
      const next = shortestPath(item.tiles, env.pos, item.goal)?.[1];
      dir = DIRS.find((d) => next && samePos(step(env.pos, d), next)) ?? "U";
    } else if (rng.chance(0.15)) {
      dir = rng.pick(DIRS);
    } else {
      dir = rng.pick(DIRS.filter((d) => isOpen(item.tiles, step(env.pos, d))));
    }
    env.move(dir);
  }
}

function header(model: MockModel, effort: string): RunHeader {
  const key = `${model.id}@${effort}`;
  return {
    type: "run",
    schemaVersion: SCHEMA_VERSION as "2.0.0",
    runId: `${key}_mock`,
    suite: { id: CORE_SUITE.id, version: CORE_SUITE.version, split: "public" },
    subject: {
      kind: "model",
      key,
      displayName: effort === "default" ? model.name : `${model.name} (${effort})`,
      creator: model.creator,
      provider: "openrouter",
      modelId: `${model.creator}/${model.id}`,
      reasoningEffort: effort,
      openWeights: model.open ?? false,
    },
    settings: { epochs: 1, maxOutputTokens: 32000, temperature: null, concurrency: 16 },
    harness: { gitSha: "mock", promptVersion: PROMPT_VERSION, aiSdkVersion: "mock", runtime: "mock" },
    startedAt: "2026-10-01T00:00:00.000Z",
  };
}

const refs = enumerateItems(CORE_SUITE);
const items = refs.map((ref) => ({ ref, item: buildItem(ref) as MazeItem, hash: itemHash(ref) }));
const dir = join(OUT, suiteKey(CORE_SUITE));
rmSync(OUT, { recursive: true, force: true });

let files = 0;
for (const model of MODELS) {
  for (const [effort, skill] of Object.entries(model.efforts)) {
    const lines: string[] = [JSON.stringify(header(model, effort))];
    for (const { ref, item, hash } of items) {
      const rng = new Rng(fnv1a32(`mock/${model.id}/${effort}/${ref.itemId}`));
      const solve = rng.chance(clamp(skill + (TASK_PENALTY[ref.task] ?? 0) + (LEVEL_PENALTY[ref.level.level] ?? 0)));
      const env = new MazeEnv(item, ref.task);
      walk(item, env, rng, skill, solve);
      const moved = env.moves - env.blocked;
      const movesPerCall = ref.task === "fog" ? 2 + rng.int(6) : 8 + rng.int(40);
      const calls = Math.max(1, Math.ceil(env.moves / movesPerCall));
      const reasoning = Math.round(calls * 900 * (EFFORT_TOKENS[effort] ?? 1) * (0.6 + rng.next()));
      const output = reasoning + calls * 60;
      const input = calls * (ref.task === "fog" ? 900 : 4200) + Math.round((calls * calls * 350) / 2);
      const cacheRead = Math.round(input * 0.55);
      const [pIn, pOut] = model.price;
      const listCost = (input * pIn + output * pOut) / 1e6;
      const cost = ((input - cacheRead) * pIn + cacheRead * pIn * 0.1 + output * pOut) / 1e6;
      const outcome = env.reached
        ? "success"
        : rng.chance(0.15)
          ? "spend_limit"
          : rng.chance(0.4)
            ? "truncated"
            : "gave_up";
      const result: ItemResult = {
        type: "item",
        itemId: ref.itemId,
        itemHash: hash,
        task: ref.task,
        level: ref.level.level,
        seed: ref.seed,
        epoch: 0,
        status: "scored",
        score: env.reached ? 1 : 0,
        outcome,
        metrics: {
          moves: env.moves,
          optimal: item.optimal,
          spl: env.reached ? item.optimal / Math.max(moved, item.optimal) : 0,
          invalidRate: env.moves === 0 ? 0 : env.blocked / env.moves,
          revisitRate: moved === 0 ? 0 : env.revisits / moved,
          toolErrors: 0,
          nudges: 0,
          movesPerCall: env.moves / calls,
        },
        answer: { text: "", parse: "ok", value: null },
        trace: { moves: env.log.join("") },
        usage: {
          inputTokens: input,
          cacheReadTokens: cacheRead,
          cacheWriteTokens: 0,
          outputTokens: output,
          reasoningTokens: reasoning,
          costUsd: cost,
          listCostUsd: listCost,
        },
        latencyMs: calls * (2000 + rng.int(8000)),
        calls,
        providers: ["Mock"],
        finishReason: "tool-calls",
        finishedAt: "2026-10-01T00:00:00.000Z",
      };
      lines.push(JSON.stringify(result));
    }
    const out = join(dir, `${model.id}@${effort}`);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "mock.jsonl"), `${lines.join("\n")}\n`);
    files++;
  }
}

// Baselines are deterministic and already in results/; reuse them.
for (const kind of ["oracle", "random", "heuristic"]) {
  const from = join(REAL, suiteKey(CORE_SUITE), `baseline-${kind}`);
  if (existsSync(from)) {
    cpSync(from, join(dir, `baseline-${kind}`), { recursive: true });
  }
}

console.log(`${files} mock runs, ${items.length} mazes each -> ${OUT}`);
