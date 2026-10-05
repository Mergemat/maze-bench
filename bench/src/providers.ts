import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { Effort, ModelEntry } from "./models.ts";

let openrouter: ReturnType<typeof createOpenRouter> | undefined;

function getOpenRouter() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set. Put it in bench/.env or export it.");
  }
  openrouter ??= createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: { "HTTP-Referer": "https://github.com/Mergemat/maze-bench", "X-Title": "MazeBench" },
  });
  return openrouter;
}

export function createModel(entry: ModelEntry, effort: Effort): LanguageModel {
  if (entry.provider === "openai-compatible") {
    const provider = createOpenAICompatible({
      name: "local",
      baseURL: entry.baseURL ?? "http://localhost:1234/v1",
      includeUsage: true,
    });
    return provider(entry.modelId);
  }
  return getOpenRouter()(entry.modelId, {
    usage: { include: true },
    ...(effort === "default" ? {} : { reasoning: { effort } }),
    ...(entry.routing ? { provider: entry.routing } : {}),
    // Anthropic only caches prompts when asked. Fog episodes resend a growing history every
    // step, so without this they cost several times more. Other providers cache automatically.
    ...(entry.creator === "anthropic" ? { cache_control: { type: "ephemeral" as const } } : {}),
  });
}
