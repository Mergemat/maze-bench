import { join } from "node:path";
import { enumerateItems, type ItemResult, mergeItems, SMOKE_SUITE, type Suite } from "@mazebench/core";
import { loadRuns } from "@mazebench/core/node";
import type { ModelEntry } from "./models.ts";
import type { Price } from "./pricing.ts";
import { RESULTS_DIR } from "./storage.ts";

/** Mean tokens per attempt for one (task, level), from calibration or smoke runs. */
interface TokenProfile {
  input: number;
  output: number;
  /** Mean reported cost per attempt, after any prompt-cache discount. */
  cost: number;
}

type Profiles = Map<string, TokenProfile>;

const cellKey = (task: string, level: number) => `${task}/L${level}`;

/** Token profiles per model id at one effort, from smoke results. */
export function loadProfiles(effort: string): Map<string, Profiles> {
  const runs = loadRuns(join(RESULTS_DIR, `${SMOKE_SUITE.id}@${SMOKE_SUITE.version}`)).filter(
    (r) => r.header.subject.kind === "model",
  );
  const bySubject = new Map<string, ItemResult[]>();
  for (const r of runs) {
    const [id, eff] = r.header.subject.key.split("@");
    if (eff !== effort) {
      continue;
    }
    bySubject.set(id as string, [...(bySubject.get(id as string) ?? []), ...r.items]);
  }
  const out = new Map<string, Profiles>();
  for (const [id, items] of bySubject) {
    const profiles: Profiles = new Map();
    const groups = new Map<string, ItemResult[]>();
    for (const i of mergeItems([{ header: runs[0]?.header as never, items }]).filter((x) => x.status === "scored")) {
      const k = cellKey(i.task, i.level);
      groups.set(k, [...(groups.get(k) ?? []), i]);
    }
    for (const [k, list] of groups) {
      profiles.set(k, {
        input: list.reduce((s, i) => s + i.usage.inputTokens, 0) / list.length,
        output: list.reduce((s, i) => s + i.usage.outputTokens, 0) / list.length,
        cost: list.reduce((s, i) => s + (i.usage.costUsd ?? 0), 0) / list.length,
      });
    }
    out.set(id, profiles);
  }
  return out;
}

export interface Estimate {
  model: ModelEntry;
  price: Price | undefined;
  /** Lowest estimate: calibration token counts with the cache discount the calibration model got. */
  low: number;
  /** Highest estimate: calibration token counts at list price, no cache discount. */
  high: number;
  basis: string;
}

/**
 * Cost of a suite for one target price under one calibration profile.
 * `discount` maps each (task, level) to reported cost / list cost observed in calibration.
 */
function costWith(
  suite: Suite,
  epochs: number,
  profile: Profiles,
  price: Price,
  discount?: Map<string, number>,
): number | null {
  let total = 0;
  for (const ref of enumerateItems(suite)) {
    const cell = cellKey(ref.task, ref.level.level);
    const p = profile.get(cell);
    if (!p) {
      return null;
    }
    const list = p.input * price.input + p.output * price.output;
    total += list * (discount?.get(cell) ?? 1) * epochs;
  }
  return total;
}

function discounts(profile: Profiles, price: Price | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const [cell, p] of profile) {
    const list = price ? p.input * price.input + p.output * price.output : 0;
    out.set(cell, list > 0 ? Math.min(1, Math.max(0.05, p.cost / list)) : 1);
  }
  return out;
}

export function estimate(
  suite: Suite,
  epochs: number,
  models: readonly ModelEntry[],
  prices: Map<string, Price>,
  profiles: Map<string, Profiles>,
  calibrated: (id: string) => ModelEntry | undefined,
): Estimate[] {
  return models.map((model) => {
    const price = prices.get(model.modelId);
    if (!price) {
      return { model, price, low: Number.NaN, high: Number.NaN, basis: "no OpenRouter price" };
    }
    const own = profiles.get(model.id);
    const candidates = own ? [[model.id, own] as const] : [...profiles.entries()];
    const lows: number[] = [];
    const highs: number[] = [];
    for (const [id, profile] of candidates) {
      const calPrice = prices.get(calibrated(id)?.modelId ?? "");
      const list = costWith(suite, epochs, profile, price);
      const cached = costWith(suite, epochs, profile, price, discounts(profile, calPrice));
      if (list !== null && cached !== null) {
        highs.push(list);
        lows.push(cached);
      }
    }
    if (highs.length === 0) {
      return { model, price, low: Number.NaN, high: Number.NaN, basis: "no calibration covering this suite" };
    }
    return {
      model,
      price,
      low: Math.min(...lows),
      high: Math.max(...highs),
      basis: own ? "own calibration" : `token profiles of ${highs.length} calibrated model(s)`,
    };
  });
}
