/**
 * Model registry. One entry per model; reasoning effort is chosen per run, and each
 * (model, effort) pair is its own leaderboard entry with key `${id}@${effort}`.
 *
 * IDs are exact OpenRouter slugs, checked against https://openrouter.ai/api/v1/models on 2026-10-05.
 * Prefer dated slugs (e.g. `-0813`) over moving aliases.
 */

export const EFFORTS = ["default", "none", "minimal", "low", "medium", "high", "xhigh"] as const;
export type Effort = (typeof EFFORTS)[number];

export interface OpenRouterRouting {
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
  quantizations?: Array<"int4" | "int8" | "fp4" | "fp6" | "fp8" | "fp16" | "bf16" | "fp32" | "unknown">;
}

export interface ModelEntry {
  id: string;
  displayName: string;
  creator: string;
  provider: "openrouter" | "openai-compatible";
  modelId: string;
  openWeights: boolean;
  /** Included in the default sweep (`--sweep`). */
  sweep: boolean;
  routing?: OpenRouterRouting;
  /** Only for openai-compatible models. */
  baseURL?: string;
}

const or = (
  id: string,
  displayName: string,
  creator: string,
  modelId: string,
  extra: Partial<ModelEntry> = {},
): ModelEntry => ({
  id,
  displayName,
  creator,
  provider: "openrouter",
  modelId,
  openWeights: false,
  sweep: true,
  ...extra,
});

// Open-weight models are served by many hosts with different quantizations. Requiring the
// provider to honour every parameter avoids silently dropping the reasoning setting, and
// the served provider is recorded per call either way.
const OPEN: Partial<ModelEntry> = { openWeights: true, routing: { require_parameters: true } };

export const MODELS: readonly ModelEntry[] = [
  // OpenAI
  or("gpt-6-astra", "GPT-6 Astra", "openai", "openai/gpt-6-astra"),
  or("gpt-6.1-sol", "GPT-6.1 Sol", "openai", "openai/gpt-6.1-sol"),
  or("gpt-6-luna", "GPT-6 Luna", "openai", "openai/gpt-6-luna"),
  or("gpt-oss-120b", "gpt-oss-120b", "openai", "openai/gpt-oss-120b", OPEN),
  // Anthropic
  or("claude-fable-5.1", "Claude Fable 5.1", "anthropic", "anthropic/claude-fable-5.1"),
  or("claude-opus-5.5", "Claude Opus 5.5", "anthropic", "anthropic/claude-opus-5.5"),
  or("claude-sonnet-5.5", "Claude Sonnet 5.5", "anthropic", "anthropic/claude-sonnet-5.5"),
  or("claude-haiku-4.5", "Claude Haiku 4.5", "anthropic", "anthropic/claude-haiku-4.5"),
  // Google
  or("gemini-3.1-pro", "Gemini 3.1 Pro", "google", "google/gemini-3.1-pro-preview"),
  or("gemini-3.8-flash", "Gemini 3.8 Flash", "google", "google/gemini-3.8-flash"),
  or("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite", "google", "google/gemini-3.5-flash-lite", { sweep: false }),
  // xAI
  or("grok-4.7", "Grok 4.7", "x-ai", "x-ai/grok-4.7"),
  // DeepSeek
  or("deepseek-v4-pro", "DeepSeek V4 Pro (0813)", "deepseek", "deepseek/deepseek-v4-pro-0813", OPEN),
  or("deepseek-v4.1-flash", "DeepSeek V4.1 Flash", "deepseek", "deepseek/deepseek-v4.1-flash", OPEN),
  // Qwen
  or("qwen3.8-max", "Qwen3.8 Max (0902)", "qwen", "qwen/qwen3.8-max-0902"),
  or("qwen3.8-27b", "Qwen3.8 27B", "qwen", "qwen/qwen3.8-27b", { ...OPEN, sweep: false }),
  // Moonshot, Zhipu, MiniMax
  or("kimi-k3", "Kimi K3", "moonshotai", "moonshotai/kimi-k3", OPEN),
  or("glm-5.3", "GLM-5.3", "z-ai", "z-ai/glm-5.3", OPEN),
  or("glm-5.3-flash", "GLM-5.3 Flash", "z-ai", "z-ai/glm-5.3-flash", { ...OPEN, sweep: false }),
  or("minimax-m3", "MiniMax M3", "minimax", "minimax/minimax-m3", { ...OPEN, sweep: false }),
  // Local model through LM Studio (or any OpenAI-compatible server).
  {
    id: "local",
    displayName: `Local: ${process.env.LOCAL_MODEL ?? "openai/gpt-oss-20b"}`,
    creator: "local",
    provider: "openai-compatible",
    modelId: process.env.LOCAL_MODEL ?? "openai/gpt-oss-20b",
    baseURL: process.env.LOCAL_BASE_URL ?? "http://localhost:1234/v1",
    openWeights: true,
    sweep: false,
  },
];

export function getModel(id: string): ModelEntry {
  const entry = MODELS.find((m) => m.id === id);
  if (!entry) {
    throw new Error(`Unknown model "${id}". Run \`bun run bench models\` to list them.`);
  }
  return entry;
}

export function subjectKey(entry: ModelEntry, effort: Effort): string {
  return `${entry.id}@${effort}`;
}
