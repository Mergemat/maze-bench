import { PROMPT_VERSION } from "./meta.ts";
import { contentHash, fnv1a32 } from "./rng.ts";
import { getTask } from "./tasks/index.ts";
import type { LevelSpec, Repr, TaskId } from "./tasks/types.ts";

export interface SuiteTask {
  task: TaskId;
  repr: Repr;
  levels: LevelSpec[];
}

export interface Suite {
  id: string;
  version: string;
  description: string;
  /** Default number of attempts per item. */
  epochs: number;
  /** Seeds come from this namespace, so suites can share items (e.g. the repr ablation reuses core mazes). */
  seedNamespace: string;
  tasks: SuiteTask[];
}

const SIZES: ReadonlyArray<[level: number, cells: number]> = [
  [1, 3],
  [2, 5],
  [3, 8],
  [4, 12],
  [5, 16],
];

function ladder(braid: number, items: number, maxLevel = 5): LevelSpec[] {
  return SIZES.filter(([level]) => level <= maxLevel).map(([level, cells]) => ({ level, cells, braid, items }));
}

export const CORE_SUITE: Suite = {
  id: "core",
  version: "2.0.0",
  description: "Main leaderboard suite: five tasks, five size levels (fog: two, for cost).",
  epochs: 1,
  seedNamespace: "core@2.0.0",
  tasks: [
    { task: "local", repr: "ascii", levels: ladder(0.1, 20) },
    { task: "trace", repr: "ascii", levels: ladder(0.1, 20) },
    { task: "plan", repr: "ascii", levels: ladder(0.1, 20) },
    { task: "recall", repr: "ascii", levels: ladder(0.5, 20) },
    // Fog resends the whole history every step, so input tokens grow with the square of the
    // episode length. Level 3 used 4.75M input tokens per episode in calibration, so core
    // stops at level 2 (see docs/design.md).
    { task: "fog", repr: "ascii", levels: ladder(0.1, 20, 2) },
  ],
};

export const REPR_SUITE: Suite = {
  id: "repr",
  version: "2.0.0",
  description: "Representation ablation: the same core mazes rendered as adjacency lists.",
  epochs: 1,
  seedNamespace: "core@2.0.0",
  tasks: [
    { task: "local", repr: "adjacency", levels: ladder(0.1, 20, 3) },
    { task: "plan", repr: "adjacency", levels: ladder(0.1, 20, 3) },
  ],
};

export const SMOKE_SUITE: Suite = {
  id: "smoke",
  version: "2.0.0",
  description: "Tiny subset of core for checking the harness end to end. Not for the leaderboard.",
  epochs: 1,
  seedNamespace: "core@2.0.0",
  tasks: [
    { task: "local", repr: "ascii", levels: ladder(0.1, 2, 2) },
    { task: "trace", repr: "ascii", levels: ladder(0.1, 2, 2) },
    { task: "plan", repr: "ascii", levels: ladder(0.1, 2, 2) },
    { task: "recall", repr: "ascii", levels: ladder(0.5, 2, 2) },
    { task: "fog", repr: "ascii", levels: ladder(0.1, 2, 1) },
  ],
};

export const CALIB_SUITE: Suite = {
  id: "calib",
  version: "2.0.0",
  description: "One core item per task and level. Measures token usage per level for cost estimates.",
  epochs: 1,
  seedNamespace: "core@2.0.0",
  tasks: [
    { task: "local", repr: "ascii", levels: ladder(0.1, 1) },
    { task: "trace", repr: "ascii", levels: ladder(0.1, 1) },
    { task: "plan", repr: "ascii", levels: ladder(0.1, 1) },
    { task: "recall", repr: "ascii", levels: ladder(0.5, 1) },
    { task: "fog", repr: "ascii", levels: ladder(0.1, 1, 3) },
  ],
};

export const SUITES: Record<string, Suite> = {
  core: CORE_SUITE,
  repr: REPR_SUITE,
  smoke: SMOKE_SUITE,
  calib: CALIB_SUITE,
};

export function suiteKey(suite: Pick<Suite, "id" | "version">): string {
  return `${suite.id}@${suite.version}`;
}

export function getSuite(id: string): Suite {
  const name = id.split("@")[0] ?? id;
  const suite = SUITES[name];
  if (!suite) {
    throw new Error(`Unknown suite "${id}". Known: ${Object.keys(SUITES).join(", ")}`);
  }
  return suite;
}

export interface ItemRef {
  itemId: string;
  task: TaskId;
  repr: Repr;
  level: LevelSpec;
  index: number;
  seed: number;
}

export function itemId(task: TaskId, level: number, index: number): string {
  return `${task}/L${level}/${index}`;
}

/** Every item in a suite, in a stable order. `salt` selects the held-out split. */
export function enumerateItems(suite: Suite, salt = ""): ItemRef[] {
  const out: ItemRef[] = [];
  for (const t of suite.tasks) {
    for (const level of t.levels) {
      for (let index = 0; index < level.items; index++) {
        const id = itemId(t.task, level.level, index);
        out.push({
          itemId: id,
          task: t.task,
          repr: t.repr,
          level,
          index,
          seed: fnv1a32(`${suite.seedNamespace}/${id}${salt}`),
        });
      }
    }
  }
  return out;
}

export function findItem(suite: Suite, id: string, salt = ""): ItemRef | undefined {
  return enumerateItems(suite, salt).find((r) => r.itemId === id);
}

export function buildItem(ref: ItemRef): unknown {
  return getTask(ref.task).generate({ level: ref.level, seed: ref.seed, index: ref.index });
}

/** Hash of the item content and its prompt. Any change to either changes the hash. */
export function itemHash(ref: ItemRef, item: unknown = buildItem(ref)): string {
  const task = getTask(ref.task);
  const prompt = task.kind === "oneshot" ? task.prompt(item, ref.repr) : task.prompt(item, task.createEnv(item));
  return contentHash(`${PROMPT_VERSION}\n${JSON.stringify(item)}\n${prompt.system}\n${prompt.user}`);
}

export interface Manifest {
  suite: string;
  promptVersion: string;
  items: Record<string, string>;
}

export function buildManifest(suite: Suite): Manifest {
  const items: Record<string, string> = {};
  for (const ref of enumerateItems(suite)) {
    items[ref.itemId] = itemHash(ref);
  }
  return { suite: suiteKey(suite), promptVersion: PROMPT_VERSION, items };
}
