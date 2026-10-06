import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aggregate, SMOKE_SUITE } from "@mazebench/core";
import { MockLanguageModelV4, text } from "./mock.ts";

const dir = mkdtempSync(join(tmpdir(), "mazebench-"));
process.env.MAZEBENCH_RESULTS_DIR = dir;
const { runModel } = await import("../src/runner.ts");
const { loadRuns } = await import("@mazebench/core/node");
const { getModel } = await import("../src/models.ts");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("runModel", () => {
  test("writes a valid results file and resume skips finished items", async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => text("I give up.") });
    const logs: string[] = [];
    const base = {
      suite: SMOKE_SUITE,
      entry: getModel("gpt-6-luna"),
      effort: "default" as const,
      epochs: 1,
      concurrency: 3,
      maxOutputTokens: 100,
      timeoutMs: 1000,
      tasks: ["full" as const],
      model,
      log: (l: string) => logs.push(l),
    };
    const first = await runModel({ ...base, resume: false });
    expect(first.attempted).toBe(1);
    expect(first.scored).toBe(1);

    const runs = loadRuns(dir);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.header.subject.key).toBe("gpt-6-luna@default");
    expect(runs[0]?.items).toHaveLength(1);

    const again = await runModel({ ...base, resume: true });
    expect(again.attempted).toBe(0);

    const summary = aggregate(loadRuns(dir), SMOKE_SUITE)[0];
    expect(summary?.tasks.full?.n).toBe(1);
    expect(summary?.composite).toBeNull();
  });
});
