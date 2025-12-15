import { openrouter } from "@openrouter/ai-sdk-provider";

export const MODELS = {
  "[deepseek]deepseek-v3.1": openrouter("deepseek/deepseek-chat-v3.1"),

  "[moonshotai]kimi-k2-thinking": openrouter("moonshotai/kimi-k2-thinking"),

  "[openai]gpt-5.2": openrouter("openai/gpt-5.2"),
  "[openai]gpt-5": openrouter("openai/gpt-5"),
  "[openai]gpt-5-mini": openrouter("openai/gpt-5-mini"),
  "[openai]gpt-oss-120b": openrouter("openai/gpt-oss-120b"),

  "[x-ai]grok-4.1-fast": openrouter("x-ai/grok-4.1-fast"),

  "[google]gemini-2.5-flash": openrouter("google/gemini-2.5-flash"),

  // "[anthropic]claude-sonnet-4.5": openrouter("anthropic/claude-sonnet-4.5"),
  // "[anthropic]claude-sonnet-4": openrouter("anthropic/claude-sonnet-4"),
};

export type ModelKey = keyof typeof MODELS;
