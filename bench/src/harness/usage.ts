import type { Usage } from "@mazebench/core";

/** USD per token. */
export interface ListPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

import type { LanguageModelUsage, ProviderMetadata } from "ai";

interface StepLike {
  usage: LanguageModelUsage;
  providerMetadata?: ProviderMetadata | undefined;
}

export class UsageMeter {
  inputTokens = 0;
  cacheReadTokens = 0;
  cacheWriteTokens = 0;
  outputTokens = 0;
  reasoningTokens = 0;
  cost = 0;
  costMissing = false;
  calls = 0;
  /** Largest single-call input: the biggest context the model was given. */
  peakInputTokens = 0;
  readonly providers = new Set<string>();

  /** Add one model call and return its reported cost. OpenRouter reports cost and provider in metadata. */
  add(step: StepLike): number {
    this.calls++;
    this.inputTokens += step.usage.inputTokens ?? 0;
    this.cacheReadTokens += step.usage.inputTokenDetails?.cacheReadTokens ?? 0;
    this.cacheWriteTokens += step.usage.inputTokenDetails?.cacheWriteTokens ?? 0;
    this.peakInputTokens = Math.max(this.peakInputTokens, step.usage.inputTokens ?? 0);
    this.outputTokens += step.usage.outputTokens ?? 0;
    this.reasoningTokens += step.usage.outputTokenDetails?.reasoningTokens ?? 0;
    const meta = step.providerMetadata?.openrouter as { provider?: string; usage?: { cost?: number } } | undefined;
    if (meta?.provider) {
      this.providers.add(meta.provider);
    }
    if (typeof meta?.usage?.cost === "number") {
      this.cost += meta.usage.cost;
      return meta.usage.cost;
    }
    this.costMissing = true;
    return 0;
  }

  /**
   * Token counts priced at fixed list prices. Cache reads and writes are subsets of input; the
   * rest of the input is priced as uncached. Long-context price tiers are not applied.
   */
  listCost(price: ListPrice): number {
    const uncached = Math.max(0, this.inputTokens - this.cacheReadTokens - this.cacheWriteTokens);
    return (
      uncached * price.input +
      this.cacheReadTokens * price.cacheRead +
      this.cacheWriteTokens * price.cacheWrite +
      this.outputTokens * price.output
    );
  }

  toUsage(price?: ListPrice): Usage {
    return {
      inputTokens: this.inputTokens,
      cacheReadTokens: this.cacheReadTokens,
      cacheWriteTokens: this.cacheWriteTokens,
      ...(price ? { listCostUsd: this.listCost(price) } : {}),
      outputTokens: this.outputTokens,
      reasoningTokens: this.reasoningTokens,
      costUsd: this.calls === 0 ? 0 : this.costMissing ? null : this.cost,
    };
  }
}
