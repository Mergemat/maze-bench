import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { Effort, ModelEntry } from "./models.ts";

let openrouter: ReturnType<typeof createOpenRouter> | undefined;

/**
 * fetch that retries when the connection itself fails (TLS handshake, reset, DNS), i.e. when no
 * response came back and the request never reached the model, so nothing was billed. HTTP error
 * responses are returned as-is for the AI SDK's own retry logic.
 */
export const connectionRetryFetch: typeof fetch = Object.assign(
  async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetch(input, init);
      } catch (error) {
        if (init?.signal?.aborted || attempt >= 5) {
          throw error;
        }
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt + Math.random() * 300));
      }
    }
  },
  { preconnect: fetch.preconnect },
);

function getOpenRouter() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set. Put it in bench/.env or export it.");
  }
  openrouter ??= createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: { "HTTP-Referer": "https://github.com/Mergemat/maze-bench", "X-Title": "MazeBench" },
    fetch: connectionRetryFetch,
  });
  return openrouter;
}

export function createModel(entry: ModelEntry, effort: Effort): LanguageModel {
  if (entry.provider === "openai-compatible") {
    const provider = createOpenAICompatible({
      name: "local",
      baseURL: entry.baseURL ?? "http://localhost:1234/v1",
      includeUsage: true,
      fetch: connectionRetryFetch,
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
