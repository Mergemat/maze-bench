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
 * The harness only adds what a benchmark needs on top: a move budget, a cap on model calls,
 * a few nudges when the agent stops without reaching the goal, and per-call accounting.
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
  // One move per call is the worst case; slack covers calls that only produce bad tool input.
  const maxSteps = env.movesLeft + task.maxNudges + 10;
  let toolErrors = 0;
  let nudges = 0;
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
  const callCap: StopCondition<typeof tools> = () => meter.calls >= maxSteps;
  const overBudget: StopCondition<typeof tools> = () => opts.guard?.tripped ?? false;

  const agent = new ToolLoopAgent({
    model,
    instructions: prompt.system,
    tools,
    stopWhen: [episodeOver, callCap, overBudget],
    maxOutputTokens: opts.maxOutputTokens,
    maxRetries: opts.retry?.retries ?? 4,
    onStepFinish: (step) => {
      // Record usage first: `guard?.add(meter.add(step))` would skip meter.add when there is no guard.
      const cost = meter.add(step);
      opts.guard?.add(cost);
      toolErrors += step.content.filter((p) => p.type === "tool-error").length;
    },
  });

  let messages: ModelMessage[] = [{ role: "user", content: prompt.user }];

  const finish = (end: EpisodeEnd): Attempt => {
    const scored = task.scoreEpisode(item, env, end);
    scored.metrics.toolErrors = toolErrors;
    scored.metrics.nudges = nudges;
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

  // A task stopped by --max-cost counts as not solved, like one that runs out of moves: every
  // model gets the same tasks and the score is what it solved. The outcome records why.
  const stopped = (): Attempt => {
    const scored = task.scoreEpisode(item, env, "budget");
    return {
      status: "scored",
      scored: { ...scored, score: 0, outcome: "spend_limit" },
      usage: meter.toUsage(opts.price),
      calls: meter.calls,
      providers: [...meter.providers],
      latencyMs: Math.round(performance.now() - started),
    };
  };

  try {
    while (true) {
      if (opts.guard?.tripped) {
        return stopped();
      }
      const res = await agent.generate({ messages, timeout: { stepMs: opts.timeoutMs } });
      messages = [...messages, ...res.response.messages];
      finishReason = res.finishReason;
      if (res.text) {
        lastText = res.text;
      }
      if (env.reached) {
        return finish("goal");
      }
      if (opts.guard?.tripped) {
        return stopped();
      }
      if (env.done || meter.calls >= maxSteps) {
        return finish("budget");
      }
      // The agent stopped on its own: the model replied without calling the tool.
      nudges++;
      if (nudges > task.maxNudges) {
        return finish(res.finishReason === "length" ? "truncated" : "stalled");
      }
      messages = [...messages, { role: "user", content: task.nudge }];
    }
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
