import type { Usage } from "@mazebench/core";
import type { LanguageModelUsage, ProviderMetadata } from "ai";

interface StepLike {
  usage: LanguageModelUsage;
  providerMetadata?: ProviderMetadata | undefined;
}

export class UsageMeter {
  inputTokens = 0;
  outputTokens = 0;
  reasoningTokens = 0;
  cost = 0;
  costMissing = false;
  calls = 0;
  readonly providers = new Set<string>();

  /** Add one model call. OpenRouter reports cost and the serving provider in provider metadata. */
  add(step: StepLike): void {
    this.calls++;
    this.inputTokens += step.usage.inputTokens ?? 0;
    this.outputTokens += step.usage.outputTokens ?? 0;
    this.reasoningTokens += step.usage.outputTokenDetails?.reasoningTokens ?? 0;
    const meta = step.providerMetadata?.openrouter as
      | { provider?: string; usage?: { cost?: number } }
      | undefined;
    if (meta?.provider) {
      this.providers.add(meta.provider);
    }
    if (typeof meta?.usage?.cost === "number") {
      this.cost += meta.usage.cost;
    } else {
      this.costMissing = true;
    }
  }

  toUsage(): Usage {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      reasoningTokens: this.reasoningTokens,
      costUsd: this.calls === 0 ? 0 : this.costMissing ? null : this.cost,
    };
  }
}
