import { groq } from "@ai-sdk/groq";
import { openrouter } from "@openrouter/ai-sdk-provider";

export const MODELS = {
	// "groq-qwen3-32b": groq("qwen/qwen3-32b"),
	"deepseek-v3.1": openrouter("deepseek/deepseek-chat-v3.1"),
	"kimi-k2-thinking": openrouter("moonshotai/kimi-k2-thinking"),
	"gpt-5-mini": openrouter("openai/gpt-5-nano"),
	"grok-4.1-fast": openrouter("x-ai/grok-4.1-fast"),
	"gemini-2.5-flash": openrouter("google/gemini-2.5-flash"),
	"gpt-oss-120b": openrouter("openai/gpt-oss-120b"),
};

export type ModelKey = keyof typeof MODELS;
