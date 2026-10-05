import { join } from "node:path";
import { CALIB_SUITE, enumerateItems, type ItemResult, mergeItems, type Suite } from "@mazebench/core";
import { loadRuns } from "@mazebench/core/node";
import type { ModelEntry } from "./models.ts";
import type { Price } from "./pricing.ts";
import { RESULTS_DIR } from "./storage.ts";

/** Mean tokens per attempt for one (task, level), from calibration or smoke runs. */
interface TokenProfile {
  input: number;
  output: number;
}

type Profiles = Map<string, TokenProfile>;

const cellKey = (task: string, level: number) => `${task}/L${level}`;

/** Token profiles per model id (effort ignored unless it matches), from calib results. */
export function loadProfiles(effort: string): Map<string, Profiles> {
  const runs = loadRuns(join(RESULTS_DIR, `${CALIB_SUITE.id}@${CALIB_SUITE.version}`)).filter(
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
      });
    }
    out.set(id, profiles);
  }
  return out;
}

export interface Estimate {
  model: ModelEntry;
  price: Price | undefined;
  /** Point estimate when the model has its own calibration, else a range over calibrated models. */
  low: number;
  high: number;
  basis: string;
}

function costWith(suite: Suite, epochs: number, profiles: Profiles, price: Price): number | null {
  let total = 0;
  for (const ref of enumerateItems(suite)) {
    const p = profiles.get(cellKey(ref.task, ref.level.level));
    if (!p) {
      return null;
    }
    total += (p.input * price.input + p.output * price.output) * epochs;
  }
  return total;
}

export function estimate(
  suite: Suite,
  epochs: number,
  models: readonly ModelEntry[],
  prices: Map<string, Price>,
  profiles: Map<string, Profiles>,
): Estimate[] {
  return models.map((model) => {
    const price = prices.get(model.modelId);
    if (!price) {
      return { model, price, low: Number.NaN, high: Number.NaN, basis: "no OpenRouter price" };
    }
    const own = profiles.get(model.id);
    const ownCost = own ? costWith(suite, epochs, own, price) : null;
    if (ownCost !== null) {
      return { model, price, low: ownCost, high: ownCost, basis: "own calibration" };
    }
    // Apply every calibrated model's token profile to this model's prices.
    const costs = [...profiles.values()]
      .map((p) => costWith(suite, epochs, p, price))
      .filter((c): c is number => c !== null);
    if (costs.length === 0) {
      return { model, price, low: Number.NaN, high: Number.NaN, basis: "no calibration data" };
    }
    return {
      model,
      price,
      low: Math.min(...costs),
      high: Math.max(...costs),
      basis: `token range of ${costs.length} calibrated model(s)`,
    };
  });
}
