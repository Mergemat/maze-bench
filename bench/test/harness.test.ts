import { describe, expect, test } from "bun:test";
import {
  type AnyInteractiveTask,
  type AnyOneShotTask,
  buildItem,
  CORE_SUITE,
  enumerateItems,
  type FogItem,
  fogTask,
  getTask,
  movesFromPath,
  type PlanItem,
  planTask,
  shortestPath,
} from "@mazebench/core";
import { APICallError } from "ai";
import { runInteractive } from "../src/harness/fog.ts";
import { runOneShot } from "../src/harness/oneshot.ts";
import type { CallOptions } from "../src/harness/types.ts";
import { MockLanguageModelV4, text, toolCall } from "./mock.ts";

const opts: CallOptions = { maxOutputTokens: 1000, timeoutMs: 10_000, retry: { retries: 1, sleep: async () => {} } };
const planRef = enumerateItems(CORE_SUITE).find((r) => r.itemId === "plan/L2/0");
const planItem = buildItem(planRef as never) as PlanItem;
const plan = getTask("plan") as AnyOneShotTask;
const oracleMoves = planTask.baseline(planItem, "oracle", null as never);

describe("one-shot harness", () => {
  test("scores a correct answer and records usage and provider", async () => {
    const model = new MockLanguageModelV4({ doGenerate: text(`Let me think.\nANSWER: ${oracleMoves.join(" ")}`) });
    const a = await runOneShot(model, plan, planItem, "ascii", opts);
    expect(a.status).toBe("scored");
    expect(a.scored).toMatchObject({ score: 1, outcome: "success" });
    expect(a.answer?.parse).toBe("ok");
    expect(a.usage).toEqual({ inputTokens: 100, outputTokens: 20, reasoningTokens: 5, costUsd: 0.001 });
    expect(a.providers).toEqual(["MockCloud"]);
    expect(a.calls).toBe(1);
    // The prompt reaches the model.
    const call = model.doGenerateCalls[0];
    expect(JSON.stringify(call?.prompt)).toContain("Find a route from S to G");
  });

  test("an unparseable answer is a scored parse failure, not an error", async () => {
    const model = new MockLanguageModelV4({ doGenerate: text("ANSWER: go to the goal") });
    const a = await runOneShot(model, plan, planItem, "ascii", opts);
    expect(a.status).toBe("scored");
    expect(a.scored.outcome).toBe("parse_failed");
    expect(a.answer?.parse).toBe("failed");
  });

  test("hitting the token limit without an answer is labelled truncated", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: { ...text("Thinking about row 3..."), finishReason: { unified: "length", raw: undefined } },
    });
    const a = await runOneShot(model, plan, planItem, "ascii", opts);
    expect(a.scored.outcome).toBe("truncated");
  });

  test("a missing ANSWER line falls back to the last line", async () => {
    const model = new MockLanguageModelV4({ doGenerate: text(`The route:\n${oracleMoves.join(" ")}`) });
    const a = await runOneShot(model, plan, planItem, "ascii", opts);
    expect(a.scored.score).toBe(1);
    expect(a.answer?.parse).toBe("fallback");
  });

  test("API failures become errors after retries and are not scored", async () => {
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
    const a = await runOneShot(model, plan, planItem, "ascii", opts);
    expect(a.status).toBe("error");
    expect(a.error?.category).toBe("server");
    expect(calls).toBe(2);
  });
});

describe("interactive harness", () => {
  const fogRef = enumerateItems(CORE_SUITE).find((r) => r.itemId === "fog/L2/0");
  const fogItem = buildItem(fogRef as never) as FogItem;
  const fog = fogTask as unknown as AnyInteractiveTask;
  const route = movesFromPath(shortestPath(fogItem.tiles, fogItem.start, fogItem.goal) ?? []);

  test("follows tool calls to the goal and stops", async () => {
    let i = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => toolCall(`c${i}`, route[i++] as string),
    });
    const a = await runInteractive(model, fog, fogItem, opts);
    expect(a.scored).toMatchObject({ score: 1, outcome: "success" });
    expect(a.calls).toBe(route.length);
    expect(a.scored.metrics.moves).toBe(route.length);
    expect(a.scored.metrics.spl).toBe(1);
    expect(a.scored.trace?.moves).toBe(route.join(""));
    // Each later call sees the tool results of earlier calls.
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain("moves_left");
  });

  test("stalls after repeated replies without a tool call", async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => text("I am thinking.") });
    const a = await runInteractive(model, fog, fogItem, opts);
    expect(a.scored.outcome).toBe("stalled");
    expect(a.calls).toBe(fog.maxNudges + 1);
    expect(a.scored.metrics.nudges).toBe(fog.maxNudges + 1);
  });

  test("invalid tool input is counted and does not use a move", async () => {
    let i = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => (i++ === 0 ? toolCall("bad", "north") : toolCall(`c${i}`, route[i - 2] as string)),
    });
    const a = await runInteractive(model, fog, fogItem, opts);
    expect(a.scored.outcome).toBe("success");
    expect(a.scored.metrics.toolErrors).toBe(1);
    expect(a.scored.metrics.moves).toBe(route.length);
  });
});
