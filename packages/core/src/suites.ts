import { PROMPT_VERSION } from "./meta.ts";
import { contentHash, fnv1a32 } from "./rng.ts";
import { getTask } from "./tasks/index.ts";
import type { LevelSpec, MazeItem, TaskId } from "./tasks/types.ts";

export interface SuiteTask {
  task: TaskId;
  levels: LevelSpec[];
}

export interface Suite {
  id: string;
  version: string;
  description: string;
  /** Default number of attempts per item. */
  epochs: number;
  /** Seeds come from this namespace, so suites can share mazes. */
  seedNamespace: string;
  tasks: SuiteTask[];
}

/** Maze sizes in cells per side; the tile grid is (2n+1) x (2n+1). */
const SIZES: ReadonlyArray<[level: number, cells: number]> = [
  [1, 3],
  [2, 5],
  [3, 8],
  [4, 12],
];

function ladder(items: number, maxLevel = 4, braid = 0.1): LevelSpec[] {
  return SIZES.filter(([level]) => level <= maxLevel).map(([level, cells]) => ({ level, cells, braid, items }));
}

export const CORE_SUITE: Suite = {
  id: "core",
  version: "2.0.0",
  description: "Main leaderboard: three ways of seeing the maze, 7x7 to 25x25 (fog up to 11x11, for cost).",
  epochs: 1,
  seedNamespace: "core@2.0.0",
  tasks: [
    { task: "full", levels: ladder(20) },
    { task: "once", levels: ladder(20) },
    // Fog episodes are long, and every agent step resends the conversation, so fog stops at 11x11.
    { task: "fog", levels: ladder(20, 2) },
  ],
};

export const SMOKE_SUITE: Suite = {
  id: "smoke",
  version: "2.0.0",
  description:
    "One core maze per condition and size. Checks the harness end to end and measures token use for cost estimates.",
  epochs: 1,
  seedNamespace: "core@2.0.0",
  tasks: [
    { task: "full", levels: ladder(1) },
    { task: "once", levels: ladder(1) },
    { task: "fog", levels: ladder(1, 2) },
  ],
};

export const SUITES: Record<string, Suite> = {
  core: CORE_SUITE,
  smoke: SMOKE_SUITE,
};

/** Human label for a level: the maze size in tiles, e.g. "11×11". */
export function sizeLabel(level: LevelSpec | number): string {
  const cells = typeof level === "number" ? (SIZES.find(([l]) => l === level)?.[1] ?? 0) : level.cells;
  const tiles = 2 * cells + 1;
  return `${tiles}×${tiles}`;
}

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
  const maze = item as MazeItem;
  const prompt = task.prompt(maze, task.createEnv(maze));
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
