import { type AnyOneShotTask, extractAnswer, type Repr } from "@mazebench/core";
import { generateText, type LanguageModel } from "ai";
import { classify, withRetry } from "./retry.ts";
import { type Attempt, type CallOptions, clip, errorScored } from "./types.ts";
import { UsageMeter } from "./usage.ts";

/** One model call, one answer. Format failures are scored as 0 and labelled; API failures are errors. */
export async function runOneShot(
  model: LanguageModel,
  task: AnyOneShotTask,
  item: unknown,
  repr: Repr,
  opts: CallOptions,
): Promise<Attempt> {
  const meter = new UsageMeter();
  const started = performance.now();
  const prompt = task.prompt(item, repr);
  const done = (a: Omit<Attempt, "usage" | "calls" | "providers" | "latencyMs">): Attempt => ({
    ...a,
    usage: meter.toUsage(),
    calls: meter.calls,
    providers: [...meter.providers],
    latencyMs: Math.round(performance.now() - started),
  });

  try {
    const res = await withRetry(
      () =>
        generateText({
          model,
          system: prompt.system,
          prompt: prompt.user,
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

    const text = res.text;
    const extracted = extractAnswer(text);
    const value = extracted ? task.parse(extracted.content) : null;
    if (value === null) {
      const truncated = res.finishReason === "length";
      return done({
        status: "scored",
        scored: {
          score: 0,
          outcome: truncated ? "truncated" : "parse_failed",
          metrics: {},
        },
        answer: { text: clip(text), parse: "failed", value: null },
        finishReason: res.finishReason,
      });
    }
    return done({
      status: "scored",
      scored: task.score(item, value),
      answer: { text: clip(text), parse: extracted?.status ?? "failed", value },
      finishReason: res.finishReason,
    });
  } catch (raw) {
    const error = classify(raw);
    return done({
      status: "error",
      scored: errorScored(),
      error: { category: error.category, message: error.message },
    });
  }
}
