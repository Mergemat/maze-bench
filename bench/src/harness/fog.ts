import { type AnyInteractiveTask, type Dir, type EpisodeEnd, type Env } from "@mazebench/core";
import { generateText, type LanguageModel, type ModelMessage, tool } from "ai";
import { z } from "zod";
import { classify, withRetry } from "./retry.ts";
import { type Attempt, type CallOptions, clip, errorScored } from "./types.ts";
import { UsageMeter } from "./usage.ts";

/**
 * Interactive episode. We drive the loop one model call at a time instead of using the SDK's
 * multi-step loop so the harness owns the budget, the nudges and the per-call accounting.
 */
export async function runInteractive(
  model: LanguageModel,
  task: AnyInteractiveTask,
  item: unknown,
  opts: CallOptions,
): Promise<Attempt> {
  const meter = new UsageMeter();
  const started = performance.now();
  const env: Env = task.createEnv(item);
  const prompt = task.prompt(item, env);
  // Hard cap on model calls: one per move, plus nudges, plus slack for calls that only produce bad tool input.
  const maxCalls = env.movesLeft + task.maxNudges + 10;
  let toolErrors = 0;
  let nudges = 0;
  let lastText = "";
  let finishReason: string | undefined;

  const tools = {
    move: tool({
      description: task.toolDescription,
      inputSchema: z.object({
        direction: z.enum(["U", "D", "L", "R"]).describe("U = up, D = down, L = left, R = right"),
      }),
      execute: async ({ direction }: { direction: Dir }) =>
        env.done ? { result: "ignored", reason: "The episode is over." } : env.move(direction),
    }),
  };

  const messages: ModelMessage[] = [{ role: "user", content: prompt.user }];

  const finish = (end: EpisodeEnd): Attempt => {
    const scored = task.scoreEpisode(item, env, end);
    scored.metrics.toolErrors = toolErrors;
    scored.metrics.nudges = nudges;
    return {
      status: "scored",
      scored,
      answer: { text: clip(lastText, 1000), parse: "ok", value: null },
      usage: meter.toUsage(),
      calls: meter.calls,
      providers: [...meter.providers],
      latencyMs: Math.round(performance.now() - started),
      ...(finishReason ? { finishReason } : {}),
    };
  };

  try {
    while (true) {
      if (env.reached) {
        return finish("goal");
      }
      if (env.done || meter.calls >= maxCalls) {
        return finish("budget");
      }
      const res = await withRetry(
        () =>
          generateText({
            model,
            system: prompt.system,
            messages,
            tools,
            maxOutputTokens: opts.maxOutputTokens,
            maxRetries: 0,
            timeout: opts.timeoutMs,
          }),
        {
          ...opts.retry,
          onRetry: (e, n, ms) => opts.onRetry?.(`retry ${n} in ${ms}ms: [${e.category}] ${e.message}`),
        },
      );
      for (const s of res.steps) {
        meter.add(s);
      }
      messages.push(...res.response.messages);
      finishReason = res.finishReason;
      if (res.text) {
        lastText = res.text;
      }
      toolErrors += res.content.filter((p) => p.type === "tool-error").length;

      // Invalid tool input already gets an error result the model can react to, so only a reply
      // with no tool call at all counts as stalling. The call cap stops endless invalid calls.
      const calledTool = res.content.some((p) => p.type === "tool-call");
      if (!calledTool && !env.done) {
        nudges++;
        if (nudges > task.maxNudges) {
          return finish(res.finishReason === "length" ? "truncated" : "stalled");
        }
        messages.push({ role: "user", content: task.nudge });
      }
    }
  } catch (raw) {
    const error = classify(raw);
    return {
      status: "error",
      scored: errorScored(),
      usage: meter.toUsage(),
      calls: meter.calls,
      providers: [...meter.providers],
      latencyMs: Math.round(performance.now() - started),
      error: { category: error.category, message: error.message },
    };
  }
}
