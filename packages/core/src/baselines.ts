import { fnv1a32, Rng } from "./rng.ts";
import { buildItem, type ItemRef } from "./suites.ts";
import { getTask } from "./tasks/index.ts";
import type { BaselineKind, MazeItem, Scored } from "./tasks/types.ts";

/** Run a deterministic baseline on one item. Same (kind, item, epoch) always gives the same result. */
export function runBaseline(ref: ItemRef, kind: BaselineKind, epoch = 0): Scored {
  const task = getTask(ref.task);
  const item = buildItem(ref) as MazeItem;
  const rng = new Rng(fnv1a32(`baseline/${kind}/${ref.itemId}/${ref.seed}/${epoch}`));
  const env = task.createEnv(item);
  const policy = task.baselinePolicy(kind, item, rng);
  // No move limit: every baseline here keeps moving until it reaches the exit, which in a
  // connected maze it always does. They differ in how many moves that takes.
  while (!env.done) {
    env.move(policy(env));
  }
  return task.scoreEpisode(item, env, "success");
}
