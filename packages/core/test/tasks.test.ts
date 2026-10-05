import { describe, expect, test } from "bun:test";
import {
  BASELINE_KINDS,
  buildItem,
  CORE_SUITE,
  enumerateItems,
  getTask,
  type MazeItem,
  openDirs,
  replayLog,
  runBaseline,
  TASK_IDS,
} from "../src/index.ts";

const refs = enumerateItems(CORE_SUITE);
const byTask = (task: string) => refs.filter((r) => r.task === task);
const firstItem = (task: string) => buildItem(byTask(task)[0] as never) as MazeItem;
const wallDir = (item: MazeItem) =>
  (["U", "D", "L", "R"] as const).find((d) => !openDirs(item.tiles, item.start).includes(d)) as "U";

describe("baselines", () => {
  for (const task of TASK_IDS) {
    test(`oracle reaches the exit on every ${task} maze`, () => {
      for (const ref of byTask(task)) {
        expect({ id: ref.itemId, score: runBaseline(ref, "oracle").score }).toEqual({ id: ref.itemId, score: 1 });
      }
    });
  }

  test("are deterministic", () => {
    for (const ref of refs.filter((_, i) => i % 13 === 0)) {
      for (const kind of BASELINE_KINDS) {
        expect(runBaseline(ref, kind)).toEqual(runBaseline(ref, kind));
      }
    }
  });

  test("random walk rarely finishes the larger mazes", () => {
    const big = refs.filter((r) => r.task === "full" && r.level.level >= 3);
    const rate = big.filter((r) => runBaseline(r, "random").score === 1).length / big.length;
    expect(rate).toBeLessThan(0.35);
  });
});

describe("maze environment", () => {
  test("a batch runs in order and stops at the first blocked move", () => {
    const item = firstItem("fog");
    const env = getTask("fog").createEnv(item);
    const open = openDirs(item.tiles, item.start)[0] as "U";
    const r = env.moveBatch([wallDir(item), open, open]);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]?.result).toBe("blocked");
    expect(r.skipped).toBe(2);
    expect(env.moves).toBe(1);
    expect(r.moves_left).toBe(item.budget - 1);
  });

  test("what each condition reports back", () => {
    const item = firstItem("full");
    const open = openDirs(item.tiles, item.start)[0] as "U";
    const full = getTask("full").createEnv(item).moveBatch([open]);
    const once = getTask("once").createEnv(item).moveBatch([open]);
    const fog = getTask("fog").createEnv(item).moveBatch([open]);
    expect(full.map?.split("\n")).toHaveLength(item.tiles.length);
    expect(full.steps[0]?.view).toBeUndefined();
    expect(once.map).toBeUndefined();
    expect(once.steps[0]?.view).toBeUndefined();
    expect(fog.map).toBeUndefined();
    expect(fog.steps[0]?.view?.split("\n")).toHaveLength(3);
  });

  test("counts revisits and stops at the budget", () => {
    const item = firstItem("fog");
    const env = getTask("fog").createEnv(item);
    const there = openDirs(item.tiles, item.start)[0] as "U";
    const back = ({ U: "D", D: "U", L: "R", R: "L" } as const)[there];
    env.move(there);
    env.move(back);
    expect(env.revisits).toBe(1);
    while (!env.done) {
      env.move(wallDir(item));
    }
    const scored = getTask("fog").scoreEpisode(item, env, "budget");
    expect(scored).toMatchObject({ score: 0, outcome: "budget_exhausted" });
    expect(env.moves).toBe(item.budget);
  });

  test("the replay log reproduces the oracle path", () => {
    const ref = byTask("once")[5];
    const item = buildItem(ref as never) as MazeItem;
    const r = runBaseline(ref as never, "oracle");
    const { positions } = replayLog(item, String(r.trace?.moves).split("") as never);
    expect(positions.at(-1)).toEqual(item.goal);
    expect(r.metrics.spl).toBe(1);
  });
});

describe("prompts", () => {
  test("full and once show the map; fog shows a 3x3 view", () => {
    const item = firstItem("full");
    for (const id of TASK_IDS) {
      const task = getTask(id);
      const p = task.prompt(item, task.createEnv(item));
      expect(p.system).toContain("`move` tool");
      expect(p.system).toContain(`You have ${item.budget} moves`);
      if (id === "fog") {
        expect(p.user.split("\n").filter((l) => /^[#.@G]{3}$/.test(l))).toHaveLength(3);
      } else {
        expect(p.user).toContain(item.tiles[0] as string);
      }
    }
  });
});
