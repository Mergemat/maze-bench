import { describe, expect, test } from "bun:test";
import {
  BASELINE_KINDS,
  buildItem,
  CORE_SUITE,
  enumerateItems,
  executeMoves,
  type FogEnv,
  type FogItem,
  fogTask,
  freeReduce,
  getTask,
  type LocalItem,
  localTask,
  openDirs,
  type PlanItem,
  planTask,
  type RecallItem,
  recallTask,
  replayFog,
  reverseMoves,
  runBaseline,
  type TraceItem,
  traceTask,
} from "../src/index.ts";

const refs = enumerateItems(CORE_SUITE);
const byTask = (task: string) => refs.filter((r) => r.task === task);

describe("oracle solves every item", () => {
  for (const task of ["local", "trace", "plan", "recall", "fog"] as const) {
    test(task, () => {
      for (const ref of byTask(task)) {
        const r = runBaseline(ref, "oracle");
        expect({ id: ref.itemId, score: r.scored.score }).toEqual({ id: ref.itemId, score: 1 });
      }
    });
  }
});

describe("baselines are deterministic", () => {
  test("same kind and item give the same result", () => {
    for (const ref of refs.filter((_, i) => i % 17 === 0)) {
      for (const kind of BASELINE_KINDS) {
        expect(runBaseline(ref, kind)).toEqual(runBaseline(ref, kind));
      }
    }
  });
});

describe("trivial baselines stay near the floor", () => {
  const avg = (task: string, kind: "random" | "heuristic") => {
    const scores = byTask(task).map((r) => runBaseline(r, kind).scored.score);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };
  test("random", () => {
    expect(avg("local", "random")).toBeLessThan(0.25);
    expect(avg("trace", "random")).toBeLessThan(0.1);
    expect(avg("plan", "random")).toBeLessThan(0.1);
    expect(avg("recall", "random")).toBeLessThan(0.1);
  });
  test("constant answers cannot win the one-shot tasks", () => {
    expect(avg("local", "heuristic")).toBeLessThan(0.3);
    expect(avg("trace", "heuristic")).toBeCloseTo(0.25, 2);
    expect(avg("recall", "heuristic")).toBeLessThan(0.6);
  });
});

describe("local", () => {
  const items = byTask("local").map((r) => ({ ref: r, item: buildItem(r) as LocalItem }));

  test("expected answer is the set of open directions", () => {
    for (const { item } of items) {
      expect(item.expected).toEqual(openDirs(item.tiles, item.pos));
    }
  });

  test("positions are stratified across degree classes", () => {
    const counts: Record<string, number> = {};
    for (const { item } of items) {
      counts[item.degreeClass] = (counts[item.degreeClass] ?? 0) + 1;
    }
    expect(counts.dead_end).toBeGreaterThan(25);
    expect(counts.corridor).toBeGreaterThan(25);
    expect(counts.junction).toBeGreaterThan(25);
  });

  test("parse and score", () => {
    const item = items[0]?.item as LocalItem;
    expect(localTask.parse("U, R")).toEqual(["U", "R"]);
    expect(localTask.parse("right and up")).toBeNull();
    expect(localTask.parse("up, right")).toEqual(["U", "R"]);
    expect(localTask.parse("")).toBeNull();
    expect(localTask.score(item, item.expected).score).toBe(1);
    const wrong = localTask.score(item, ["U", "D", "L", "R"].filter((d) => !item.expected.includes(d as never)) as never);
    expect(wrong.score).toBe(0);
  });
});

describe("trace", () => {
  const items = byTask("trace").map((r) => buildItem(r) as TraceItem);

  test("expected index is the first wall hit", () => {
    for (const item of items) {
      const run = executeMoves(item.tiles, item.start, item.moves);
      expect(run.firstInvalid ?? 0).toBe(item.expected);
    }
  });

  test("a quarter of items are fully legal", () => {
    expect(items.filter((i) => i.expected === 0).length).toBe(25);
  });

  test("move count scales with level", () => {
    const ref = byTask("trace").find((r) => r.level.level === 5);
    const item = buildItem(ref as never) as TraceItem;
    expect(item.moves).toHaveLength(64);
  });

  test("parse", () => {
    expect(traceTask.parse("7")).toBe(7);
    expect(traceTask.parse("move 12")).toBe(12);
    expect(traceTask.parse("none")).toBe(0);
    expect(traceTask.parse("no idea")).toBeNull();
  });
});

describe("plan", () => {
  const item = buildItem(byTask("plan")[10] as never) as PlanItem;

  test("score is SPL with success and invalid moves reported", () => {
    const oracle = planTask.baseline(item, "oracle", null as never);
    expect(oracle).toHaveLength(item.optimal);
    expect(planTask.score(item, oracle)).toMatchObject({ score: 1, outcome: "success" });

    const detour = [...oracle.slice(0, 1), ...reverseMoves(oracle.slice(0, 1)), ...oracle];
    const scored = planTask.score(item, detour);
    expect(scored.outcome).toBe("success");
    expect(scored.score).toBeCloseTo(item.optimal / (item.optimal + 2));

    expect(planTask.score(item, []).outcome).toBe("did_not_reach");
    expect(planTask.score(item, []).score).toBe(0);
  });

  test("walking into a wall is an invalid move", () => {
    const wallDir = (["U", "D", "L", "R"] as const).find((d) => !openDirs(item.tiles, item.start).includes(d));
    const scored = planTask.score(item, [wallDir as never]);
    expect(scored.outcome).toBe("invalid_move");
    expect(scored.metrics.firstInvalid).toBe(1);
  });
});

describe("recall", () => {
  const items = byTask("recall").map((r) => buildItem(r) as RecallItem);

  test("tours are real walks that end away from the start", () => {
    for (const item of items) {
      const run = executeMoves(item.tiles, item.start, item.tour);
      expect(run.firstInvalid).toBeNull();
      expect(run.end).toEqual(item.end);
      expect(item.optimal).toBeGreaterThanOrEqual(2);
    }
  });

  test("most items need more than string reduction", () => {
    let hard = 0;
    for (const item of items) {
      const s = recallTask.score(item, freeReduce(reverseMoves(item.tour)));
      expect(s.outcome).toBe("success");
      if (s.score <= 0.7) {
        hard++;
      }
    }
    expect(hard / items.length).toBeGreaterThan(0.9);
  });

  test("prompt shows one view per move plus the start", () => {
    const item = items[0] as RecallItem;
    const prompt = recallTask.prompt(item, "ascii").user;
    expect(prompt.match(/^Move \d+:/gm)).toHaveLength(item.tour.length);
    expect(prompt).toContain("Start:\n");
  });
});

describe("fog", () => {
  const item = buildItem(byTask("fog")[0] as never) as FogItem;

  test("env counts blocked moves and revisits", () => {
    const env = fogTask.createEnv(item) as FogEnv;
    const open = openDirs(item.tiles, item.start);
    const wall = (["U", "D", "L", "R"] as const).find((d) => !open.includes(d));
    const first = env.move(wall as never);
    expect(first.result).toBe("blocked");
    expect(env.blocked).toBe(1);
    const there = open[0] as never;
    env.move(there);
    const back = { U: "D", D: "U", L: "R", R: "L" }[there as "U"] as never;
    env.move(back);
    expect(env.revisits).toBe(1);
    expect(env.moves).toBe(3);
    expect(env.movesLeft).toBe(item.budget - 3);
  });

  test("view shows the agent and hides a distant goal", () => {
    const env = fogTask.createEnv(item) as FogEnv;
    const view = env.currentView();
    expect(view.split("\n")).toHaveLength(3);
    expect(view.split("\n")[1]?.[1]).toBe("@");
    expect(view).not.toContain("G");
  });

  test("episode ends at the budget", () => {
    const env = fogTask.createEnv(item) as FogEnv;
    const wall = (["U", "D", "L", "R"] as const).find((d) => !openDirs(item.tiles, item.start).includes(d));
    while (!env.done) {
      env.move(wall as never);
    }
    const scored = fogTask.scoreEpisode(item, env, "budget");
    expect(scored).toMatchObject({ score: 0, outcome: "budget_exhausted" });
    expect(scored.metrics.invalidRate).toBe(1);
  });

  test("replay reproduces the oracle path", () => {
    const ref = byTask("fog")[3];
    const r = runBaseline(ref as never, "oracle");
    const fogItem = buildItem(ref as never) as FogItem;
    const { positions } = replayFog(fogItem.tiles, fogItem.start, String(r.scored.trace?.moves).split("") as never);
    expect(positions.at(-1)).toEqual(fogItem.goal);
  });
});

describe("prompts", () => {
  test("one-shot prompts ask for the ANSWER line", () => {
    for (const ref of refs.filter((r) => r.task !== "fog" && r.index === 0)) {
      const task = getTask(ref.task);
      if (task.kind === "oneshot") {
        const p = task.prompt(buildItem(ref), ref.repr);
        expect(p.system).toContain("ANSWER:");
        expect(p.user).toContain("ANSWER:");
      }
    }
  });
});
