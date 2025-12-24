import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { openrouter } from "@openrouter/ai-sdk-provider";

const opencodeZen = createOpenAICompatible({
  name: "opencode-zen",
  apiKey: process.env.OPENCODEZEN_API_KEY,
  baseURL: "https://opencode.ai/zen/v1",
  includeUsage: true,
});

const lmStudio = createOpenAICompatible({
  name: "lmstudio",
  baseURL: "http://localhost:1234/v1",
  includeUsage: true,
});

const defaultProviderOptions = {
  usage: {
    include: true,
  },
};

const withReasoning = (
  model: string,
  effort?: "none" | "low" | "medium" | "high" | "xhigh"
) => {
  //@ts-expect-error -- i left a pr for new reasoning options. waiting for fixes
  return openrouter(model, {
    ...defaultProviderOptions,
    ...(effort && { reasoning: { effort } }),
  });
};

export const MODELS = {
  // // anthropic
  // "[anthropic]claude-sonnet-4": withReasoning("anthropic/claude-sonnet-4"),
  // "[anthropic]claude-sonnet-4.5": withReasoning("anthropic/claude-sonnet-4.5"),
  //
  // // deepseek
  // "[deepseek]deepseek-v3.1": withReasoning("deepseek/deepseek-chat-v3.1"),
  //
  // // google
  // "[google]gemini-2.5-flash": withReasoning("google/gemini-2.5-flash"),
  //
  // // moonshotai
  // "[moonshotai]kimi-k2-thinking": withReasoning("moonshotai/kimi-k2-thinking"),
  //
  // // openai
  // "[openai]gpt-5-mini": withReasoning("openai/gpt-5-mini"),
  // "[openai]gpt-5-default": withReasoning("openai/gpt-5"),
  // "[openai]gpt-5-high": withReasoning("openai/gpt-5", "high"),
  // "[openai]gpt-5.2-none": withReasoning("openai/gpt-5.2", "none"),
  // "[openai]gpt-5.2-default": withReasoning("openai/gpt-5.2"),
  // "[openai]gpt-5.2-high": withReasoning("openai/gpt-5.2", "high"),
  // "[openai]gpt-5.2-xhigh": withReasoning("openai/gpt-5.2", "xhigh"),
  // "[openai]gpt-oss-120b": withReasoning("openai/gpt-oss-120b"),
  //
  // // x-ai
  // "[x-ai]grok-4.1-fast": withReasoning("x-ai/grok-4.1-fast"),

  "[z-ai]glm-4.7-free": opencodeZen("glm-4.7-free"),
} as const;

export type ModelKey = keyof typeof MODELS;
