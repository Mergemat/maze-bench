import { describe, expect, test } from "bun:test";
import {
  buildItem,
  CORE_SUITE,
  enumerateItems,
  getTask,
  type MazeItem,
  movesFromPath,
  openDirs,
  shortestPath,
} from "@mazebench/core";
import { APICallError } from "ai";
import { runAgent } from "../src/harness/agent.ts";
import type { CallOptions } from "../src/harness/types.ts";
import { MockLanguageModelV4, text, toolCall } from "./mock.ts";

const opts: CallOptions = { maxOutputTokens: 1000, timeoutMs: 10_000, retry: { retries: 1, sleep: async () => {} } };
const ref = enumerateItems(CORE_SUITE).find((r) => r.itemId === "full/L2/0");
const item = buildItem(ref as never) as MazeItem;
const route = movesFromPath(shortestPath(item.tiles, item.start, item.goal) ?? []);

describe("agent harness", () => {
  test("a whole route in one batch solves the maze in one step", async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => toolCall("all", ...route) });
    const a = await runAgent(model, getTask("full"), item, opts);
    expect(a.status).toBe("scored");
    expect(a.scored).toMatchObject({ score: 1, outcome: "success" });
    expect(a.calls).toBe(1);
    expect(a.scored.metrics.moves).toBe(route.length);
    expect(a.scored.metrics.spl).toBe(1);
    expect(a.scored.metrics.movesPerCall).toBe(route.length);
    expect(a.usage).toEqual({ inputTokens: 100, outputTokens: 20, reasoningTokens: 5, costUsd: 0.001 });
    expect(a.providers).toEqual(["MockCloud"]);
  });

  test("one move per step: each later step sees the earlier tool results", async () => {
    let i = 0;
    const model = new MockLanguageModelV4({ doGenerate: async () => toolCall(`c${i}`, route[i++] as string) });
    const a = await runAgent(model, getTask("fog"), item, opts);
    expect(a.scored.outcome).toBe("success");
    expect(a.calls).toBe(route.length);
    expect(a.scored.trace?.moves).toBe(route.join(""));
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain("moves_left");
  });

  test("full mode returns the map after a batch; once mode does not", async () => {
    for (const [id, expectMap] of [
      ["full", true],
      ["once", false],
    ] as const) {
      let i = 0;
      const model = new MockLanguageModelV4({ doGenerate: async () => toolCall(`c${i}`, route[i++] as string) });
      await runAgent(model, getTask(id), item, opts);
      const second = JSON.stringify(model.doGenerateCalls[1]?.prompt);
      expect(second.includes('\\"map\\"') || second.includes('"map"')).toBe(expectMap);
    }
  });

  test("a batch stops at the first blocked move", async () => {
    const wall = (["U", "D", "L", "R"] as const).find((d) => !openDirs(item.tiles, item.start).includes(d)) as string;
    let i = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => (i++ === 0 ? toolCall("w", wall, ...route) : toolCall("r", ...route)),
    });
    const a = await runAgent(model, getTask("once"), item, opts);
    expect(a.scored.outcome).toBe("success");
    expect(a.scored.metrics.moves).toBe(route.length + 1);
    expect(a.calls).toBe(2);
  });

  test("stalls after repeated replies without a tool call", async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => text("I am thinking.") });
    const task = getTask("fog");
    const a = await runAgent(model, task, item, opts);
    expect(a.scored.outcome).toBe("stalled");
    expect(a.calls).toBe(task.maxNudges + 1);
  });

  test("invalid tool input is counted and does not use a move", async () => {
    let i = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => (i++ === 0 ? toolCall("bad", "north") : toolCall("ok", ...route)),
    });
    const a = await runAgent(model, getTask("full"), item, opts);
    expect(a.scored.outcome).toBe("success");
    expect(a.scored.metrics.toolErrors).toBe(1);
    expect(a.scored.metrics.moves).toBe(route.length);
  });

  test("API failures become errors and are not scored", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls++;
        throw new APICallError({
          message: "upstream",
          url: "x",
          requestBodyValues: {},
          statusCode: 502,
          isRetryable: true,
        });
      },
    });
    const a = await runAgent(model, getTask("full"), item, opts);
    expect(a.status).toBe("error");
    expect(a.error?.category).toBe("server");
    expect(calls).toBe(2);
  });
});
