#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { findItem, getSuite, itemHash, suiteKey, TASK_IDS, type TaskId } from "@mazebench/core";
import { loadRuns } from "@mazebench/core/node";
import { writeBaselines } from "./baselines.ts";
import { loadDotEnv } from "./env.ts";
import { estimate, loadProfiles } from "./estimate.ts";
import { SpendGuard } from "./harness/guard.ts";
import { EFFORTS, type Effort, getModel, MODELS } from "./models.ts";
import { effortsFor, fetchCatalog, fetchPrices } from "./pricing.ts";
import { markdownLeaderboard } from "./report.ts";
import { runModel } from "./runner.ts";
import { HOLDOUT_DIR, RESULTS_DIR } from "./storage.ts";

/**
 * Cost per maze relative to medium effort, from GPT-6 Luna smoke runs (low $0.0009,
 * medium $0.0011, high $0.0017). xhigh is extrapolated by the same step. Rough on purpose.
 */
const EFFORT_COST: Record<string, number> = {
  none: 0.8,
  minimal: 0.8,
  low: 0.8,
  default: 1,
  medium: 1,
  high: 1.55,
  xhigh: 2.4,
};

const HELP = `MazeBench runner

Usage: bun run bench <command> [options]

Commands:
  run         Run models on a suite.
                --model <id>[,<id>...]  models from \`models\` (or --sweep for the default lineup)
                --effort <e>            ${EFFORTS.join(" | ")} (default: default)
                --efforts <e,...>       several efforts; each model runs the ones it supports on OpenRouter
                --suite <id>            core | smoke (default: core)
                --tasks <t,...>         subset of ${TASK_IDS.join(",")}
                --levels <n,...>        subset of sizes: 1=7x7 2=11x11 3=17x17 4=25x25
                --limit <n>             first n items per task and level
                --epochs <n>            attempts per item (default: suite setting)
                --concurrency <n>       cap on parallel mazes per run (default: no cap; everything runs at once)
                --max-output-tokens <n> per call (default: 32000)
                --timeout <sec>         per call (default: 600)
                --resume                skip items already scored for this model
                --max-cost <usd>        stop everything once reported spend reaches this many dollars
                --holdout               use the held-out split (needs MAZEBENCH_HOLDOUT_SALT)
  baselines   Write oracle/random/heuristic results for a suite (--suite).
  models      List registered models with live OpenRouter prices.
  estimate    Estimate sweep cost from calibration runs (--suite, --model|--sweep, --epochs, --effort).
  report      Print the leaderboard as a markdown table (--suite).
  validate    Check every results file against the schema and current item hashes.
`;

function list(value: string | undefined): string[] | undefined {
  return value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function int(value: string | undefined, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return n;
}

async function main(): Promise<void> {
  loadDotEnv();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      model: { type: "string" },
      sweep: { type: "boolean" },
      effort: { type: "string" },
      efforts: { type: "string" },
      suite: { type: "string" },
      tasks: { type: "string" },
      levels: { type: "string" },
      limit: { type: "string" },
      epochs: { type: "string" },
      concurrency: { type: "string" },
      "max-output-tokens": { type: "string" },
      timeout: { type: "string" },
      resume: { type: "boolean" },
      "max-cost": { type: "string" },
      holdout: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const command = positionals[0];
  if (!command || values.help) {
    console.log(HELP);
    return;
  }
  const suite = getSuite(values.suite ?? "core");
  const effort = (values.effort ?? "default") as Effort;
  if (!EFFORTS.includes(effort)) {
    throw new Error(`Unknown effort "${effort}"`);
  }
  const models = values.sweep ? MODELS.filter((m) => m.sweep) : (list(values.model) ?? []).map(getModel);

  switch (command) {
    case "run": {
      if (models.length === 0) {
        throw new Error("Pass --model <id> or --sweep.");
      }
      const tasks = list(values.tasks) as TaskId[] | undefined;
      for (const t of tasks ?? []) {
        if (!TASK_IDS.includes(t)) {
          throw new Error(`Unknown task "${t}"`);
        }
      }
      const salt = values.holdout ? process.env.MAZEBENCH_HOLDOUT_SALT : undefined;
      if (values.holdout && !salt) {
        throw new Error("--holdout needs MAZEBENCH_HOLDOUT_SALT in the environment.");
      }
      const requested = list(values.efforts);
      for (const e of requested ?? []) {
        if (!EFFORTS.includes(e as Effort)) {
          throw new Error(`Unknown effort "${e}"`);
        }
      }
      const catalog = requested ? await fetchCatalog() : undefined;
      const plan = models.flatMap((entry) =>
        (requested ? effortsFor(requested, catalog?.get(entry.modelId)) : [effort]).map((e) => ({
          entry,
          effort: e as Effort,
        })),
      );
      if (requested) {
        console.log(plan.map((p) => `${p.entry.id}@${p.effort}`).join("\n"));
      }
      const maxCost = values["max-cost"] ? Number(values["max-cost"]) : undefined;
      if (maxCost !== undefined && !(maxCost > 0)) {
        throw new Error("--max-cost must be a positive number of dollars");
      }
      const guard = maxCost === undefined ? undefined : new SpendGuard(maxCost);
      // Every (model, effort) run starts at once, and inside each run every maze starts at once.
      // Transient API errors are retried with backoff, so rate limits slow a run down rather than fail it.
      const summaries = await Promise.all(
        plan.map(({ entry, effort }) =>
          runModel({
            suite,
            entry,
            effort,
            epochs: int(values.epochs, "epochs") ?? suite.epochs,
            concurrency: int(values.concurrency, "concurrency") ?? Number.POSITIVE_INFINITY,
            maxOutputTokens: int(values["max-output-tokens"], "max-output-tokens") ?? 32_000,
            timeoutMs: (int(values.timeout, "timeout") ?? 600) * 1000,
            ...(tasks ? { tasks } : {}),
            ...(values.levels ? { levels: (list(values.levels) ?? []).map(Number) } : {}),
            ...(values.limit ? { limit: int(values.limit, "limit") as number } : {}),
            resume: values.resume ?? false,
            ...(salt ? { holdoutSalt: salt } : {}),
            ...(guard ? { guard } : {}),
            log: (line) => console.log(line),
          }),
        ),
      );
      const total = summaries.reduce((sum, r) => sum + r.costUsd, 0);
      console.log(`Total reported cost: $${total.toFixed(4)}`);
      return;
    }
    case "baselines":
      writeBaselines(suite, (line) => console.log(line));
      return;
    case "models": {
      const prices = await fetchPrices().catch(() => new Map());
      for (const m of MODELS) {
        const p = prices.get(m.modelId);
        const price = p ? `$${(p.input * 1e6).toFixed(2)} / $${(p.output * 1e6).toFixed(2)} per M` : "no price";
        console.log(
          `${m.id.padEnd(22)} ${m.modelId.padEnd(36)} ${price.padEnd(28)} ${m.openWeights ? "open " : "     "}${m.sweep ? "sweep" : ""}`,
        );
      }
      return;
    }
    case "estimate": {
      const targets = models.length > 0 ? models : MODELS.filter((m) => m.sweep);
      const epochs = int(values.epochs, "epochs") ?? suite.epochs;
      const catalog = await fetchCatalog();
      const requested = list(values.efforts) ?? [effort];
      // Calibration ran at each model's default effort (medium for the calibration model).
      const rows = estimate(suite, epochs, targets, await fetchPrices(), loadProfiles("default"), (id) =>
        MODELS.find((m) => m.id === id),
      );
      let low = 0;
      let high = 0;
      for (const r of rows) {
        const efforts = values.efforts ? effortsFor(requested, catalog.get(r.model.modelId)) : [effort];
        const k = efforts.reduce((sum, e) => sum + (EFFORT_COST[e] ?? 1), 0);
        const lo = r.low * k;
        const hi = r.high * k;
        console.log(
          `${r.model.id.padEnd(22)} ${`$${lo.toFixed(0)} – $${hi.toFixed(0)}`.padEnd(18)} ${efforts.join(",")}`,
        );
        if (Number.isFinite(lo)) {
          low += lo;
          high += hi;
        }
      }
      console.log(`\n${suiteKey(suite)} x${epochs} epoch(s): total $${low.toFixed(0)} – $${high.toFixed(0)}`);
      console.log(
        "Low: calibration tokens with the cache discount the calibration model got. High: same tokens at list price.",
      );
      console.log(
        "Effort scaling is from GPT-6 Luna smoke runs (cost per maze relative to medium); xhigh is extrapolated.",
      );
      return;
    }
    case "report":
      console.log(markdownLeaderboard(loadRuns(RESULTS_DIR), suite));
      return;
    case "validate": {
      let files = 0;
      let mismatches = 0;
      for (const dir of [RESULTS_DIR, HOLDOUT_DIR]) {
        for (const run of loadRuns(dir)) {
          files++;
          if (run.header.suite.split !== "public") {
            continue;
          }
          const s = getSuite(run.header.suite.id);
          if (s.version !== run.header.suite.version) {
            continue;
          }
          for (const item of run.items) {
            const ref = findItem(s, item.itemId);
            if (!ref || itemHash(ref) !== item.itemHash) {
              mismatches++;
              console.log(`hash mismatch: ${run.header.runId} ${item.itemId}`);
            }
          }
        }
      }
      console.log(`${files} run file(s) parsed, ${mismatches} item hash mismatch(es).`);
      if (mismatches > 0) {
        process.exitCode = 1;
      }
      return;
    }
    default:
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
