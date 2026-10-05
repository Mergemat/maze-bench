import { Rng, fnv1a32 } from "./rng.ts";
import { buildItem, type ItemRef } from "./suites.ts";
import { getTask } from "./tasks/index.ts";
import type { BaselineKind, Scored } from "./tasks/types.ts";

export interface BaselineResult {
  scored: Scored;
  value: unknown;
}

/** Run a deterministic baseline on one item. Same (kind, item, epoch) always gives the same result. */
export function runBaseline(ref: ItemRef, kind: BaselineKind, epoch = 0): BaselineResult {
  const task = getTask(ref.task);
  const item = buildItem(ref);
  const rng = new Rng(fnv1a32(`baseline/${kind}/${ref.itemId}/${ref.seed}/${epoch}`));
  if (task.kind === "oneshot") {
    const value = task.baseline(item, kind, rng);
    return { scored: task.score(item, value), value };
  }
  const env = task.createEnv(item);
  const policy = task.baselinePolicy(kind, item, rng);
  while (!env.done) {
    env.move(policy(env));
  }
  return { scored: task.scoreEpisode(item, env, env.reached ? "goal" : "budget"), value: null };
}
