import type { Dir, EpisodeEnd, MazeItem, MazeTask } from "@mazebench/core";
import { type LanguageModel, type ModelMessage, type StopCondition, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { classify } from "./retry.ts";
import { type Attempt, type CallOptions, clip, errorScored } from "./types.ts";
import { UsageMeter } from "./usage.ts";

/**
 * One maze, run as a standard AI SDK agent: a `ToolLoopAgent` with one `move` tool that takes a
 * batch of moves, and the full conversation (reasoning included) in context. The task decides
 * what the agent sees (full map, map once, or a 3x3 fog view).
 * Success is reaching the exit. If the agent stops calling the tool before that, it gave up.
 * There is no move or step limit; the only outside stop is the shared --max-cost guard.
 */
export async function runAgent(
  model: LanguageModel,
  task: MazeTask,
  item: MazeItem,
  opts: CallOptions,
): Promise<Attempt> {
  const meter = new UsageMeter();
  const started = performance.now();
  const env = task.createEnv(item);
  const prompt = task.prompt(item, env);
  let toolErrors = 0;
  let lastText = "";
  let finishReason: string | undefined;

  const tools = {
    move: tool({
      description: task.toolDescription,
      inputSchema: z.object({
        moves: z
          .array(z.enum(["U", "D", "L", "R"]))
          .min(1)
          .describe("Moves, run in order."),
      }),
      execute: async ({ moves }: { moves: Dir[] }) =>
        env.done ? { result: "ignored", reason: "The episode is over." } : env.moveBatch(moves),
    }),
  };

  const episodeOver: StopCondition<typeof tools> = () => env.done;
  const overBudget: StopCondition<typeof tools> = () => opts.guard?.tripped ?? false;

  const agent = new ToolLoopAgent({
    model,
    instructions: prompt.system,
    tools,
    // These replace the SDK's default step limit: the loop runs until the exit, the agent stops
    // calling the tool, or the spending guard trips.
    stopWhen: [episodeOver, overBudget],
    maxOutputTokens: opts.maxOutputTokens,
    maxRetries: opts.retry?.retries ?? 4,
    onStepFinish: (step) => {
      // Record usage first: `guard?.add(meter.add(step))` would skip meter.add when there is no guard.
      const cost = meter.add(step);
      opts.guard?.add(cost);
      toolErrors += step.content.filter((p) => p.type === "tool-error").length;
    },
  });

  const finish = (end: EpisodeEnd): Attempt => {
    const scored = task.scoreEpisode(item, env, end);
    scored.metrics.toolErrors = toolErrors;
    scored.metrics.movesPerCall = meter.calls === 0 ? 0 : Number(scored.metrics.moves ?? 0) / meter.calls;
    scored.metrics.peakContext = meter.peakInputTokens;
    return {
      status: "scored",
      scored,
      answer: { text: clip(lastText, 1000), parse: "ok", value: null },
      usage: meter.toUsage(opts.price),
      calls: meter.calls,
      providers: [...meter.providers],
      latencyMs: Math.round(performance.now() - started),
      ...(finishReason ? { finishReason } : {}),
    };
  };

  try {
    if (opts.guard?.tripped) {
      // A task stopped by --max-cost counts as not solved; the outcome records why.
      return finish("spend_limit");
    }
    const messages: ModelMessage[] = [{ role: "user", content: prompt.user }];
    const res = await agent.generate({ messages, timeout: { stepMs: opts.timeoutMs } });
    finishReason = res.finishReason;
    lastText = res.text;
    if (env.reached) {
      return finish("success");
    }
    if (opts.guard?.tripped) {
      return finish("spend_limit");
    }
    // The agent stopped calling the tool without reaching the exit.
    return finish(res.finishReason === "length" ? "truncated" : "gave_up");
  } catch (raw) {
    const error = classify(raw);
    return {
      status: "error",
      scored: errorScored(),
      usage: meter.toUsage(opts.price),
      calls: meter.calls,
      providers: [...meter.providers],
      latencyMs: Math.round(performance.now() - started),
      error: { category: error.category, message: error.message },
    };
  }
}
