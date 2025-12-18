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

export const MODELS = {
  // anthropic
  // "[anthropic]claude-sonnet-4": openrouter(
  //   "anthropic/claude-sonnet-4",
  //   defaultProviderOptions
  // ),
  // "[anthropic]claude-sonnet-4.5": openrouter(
  //   "anthropic/claude-sonnet-4.5",
  //   defaultProviderOptions
  // ),

  // // deepseek
  // "[deepseek]deepseek-v3.1": openrouter(
  //   "deepseek/deepseek-chat-v3.1",
  //   defaultProviderOptions
  // ),
  //
  // // google
  // "[google]gemini-2.5-flash": openrouter(
  //   "google/gemini-2.5-flash",
  //   defaultProviderOptions
  // ),
  //
  // // moonshotai
  // "[moonshotai]kimi-k2-thinking": openrouter(
  //   "moonshotai/kimi-k2-thinking",
  //   defaultProviderOptions
  // ),
  //
  // // openai
  // "[openai]gpt-5-mini": openrouter("openai/gpt-5-mini", defaultProviderOptions),
  // "[openai]gpt-5-default": openrouter("openai/gpt-5", defaultProviderOptions),
  // "[openai]gpt-5-high": openrouter("openai/gpt-5", {
  //   ...defaultProviderOptions,
  //   reasoning: {
  //     effort: "high",
  //   },
  // }),
  // "[openai]gpt-5.2-none": openrouter("openai/gpt-5.2", {
  //   ...defaultProviderOptions,
  //   reasoning: {
  //     effort: "none",
  //   },
  // }),
  // "[openai]gpt-5.2-default": openrouter(
  //   "openai/gpt-5.2",
  //   defaultProviderOptions
  // ),
  //
  // "[openai]gpt-5.2-high": openrouter("openai/gpt-5.2", {
  //   ...defaultProviderOptions,
  //   reasoning: {
  //     effort: "high",
  //   },
  // }),
  // "[openai]gpt-5.2-xhigh": openrouter("openai/gpt-5.2", {
  //   ...defaultProviderOptions,
  //   reasoning: {
  //     effort: "xhigh",
  //   },
  // }),
  // "[openai]gpt-oss-120b": openrouter(
  //   "openai/gpt-oss-120b",
  //   defaultProviderOptions
  // ),
  //
  // // x-ai
  // "[x-ai]grok-4.1-fast": openrouter(
  //   "x-ai/grok-4.1-fast",
  //   defaultProviderOptions
  // ),
  // "[x-ai]grok-code": opencodeZen("grok-code"),
  "[google]functiongemma": lmStudio("openai/gpt-oss-20b"),

  // "[stealth]big-pickle": opencodeZen("big-pickle"),
} as const;

export type ModelKey = keyof typeof MODELS;
