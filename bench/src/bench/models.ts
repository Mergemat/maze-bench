import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

// Provider configurations
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

// Reasoning effort levels
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

// Provider types
export type Provider =
  | "anthropic"
  | "deepseek"
  | "google"
  | "moonshotai"
  | "openai"
  | "x-ai"
  | "opencode-zen"
  | "lmstudio";

// Model definition interface
export interface ModelDefinition {
  provider: Provider;
  model: string;
  reasoning?: ReasoningEffort;
  displayName: string;
  enabled: boolean;
}

const defaultProviderOptions = {
  usage: {
    include: true,
  },
};

function createOpenRouterModel(
  model: string,
  effort?: ReasoningEffort
): LanguageModel {
  //@ts-expect-error -- waiting for reasoning options fix in openrouter sdk
  return openrouter(model, {
    ...defaultProviderOptions,
    ...(effort && effort !== "none" && { reasoning: { effort } }),
  });
}

// Model definitions - easy to enable/disable and configure
export const MODEL_DEFINITIONS: ModelDefinition[] = [
  // Anthropic
  {
    provider: "anthropic",
    model: "anthropic/claude-sonnet-4",
    displayName: "Claude Sonnet 4",
    enabled: false,
  },
  {
    provider: "anthropic",
    model: "anthropic/claude-sonnet-4.5",
    displayName: "Claude Sonnet 4.5",
    enabled: false,
  },

  // DeepSeek
  {
    provider: "deepseek",
    model: "deepseek/deepseek-chat-v3.1",
    displayName: "DeepSeek V3.1",
    enabled: false,
  },

  // Google
  {
    provider: "google",
    model: "google/gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    enabled: false,
  },
  {
    provider: "google",
    model: "google/gemini-3-flash-preview",
    reasoning: "low",
    displayName: "Gemini 3 Flash (low)",
    enabled: true,
  },
  {
    provider: "google",
    model: "google/gemini-3-flash-preview",
    reasoning: "high",
    displayName: "Gemini 3 Flash (high)",
    enabled: true,
  },
  {
    provider: "google",
    model: "google/gemini-3-pro-preview",
    reasoning: "low",
    displayName: "Gemini 3 Pro (low)",
    enabled: false,
  },
  {
    provider: "google",
    model: "google/gemini-3-pro-preview",
    reasoning: "high",
    displayName: "Gemini 3 Pro (high)",
    enabled: false,
  },

  // Moonshotai
  {
    provider: "moonshotai",
    model: "moonshotai/kimi-k2-thinking",
    displayName: "Kimi K2 Thinking",
    enabled: false,
  },

  // OpenAI
  {
    provider: "openai",
    model: "openai/gpt-5-mini",
    displayName: "GPT-5 Mini",
    enabled: false,
  },
  {
    provider: "openai",
    model: "openai/gpt-5",
    displayName: "GPT-5",
    enabled: false,
  },
  {
    provider: "openai",
    model: "openai/gpt-5",
    reasoning: "high",
    displayName: "GPT-5 (high)",
    enabled: false,
  },
  {
    provider: "openai",
    model: "openai/gpt-5.2",
    reasoning: "none",
    displayName: "GPT-5.2 (none)",
    enabled: false,
  },
  {
    provider: "openai",
    model: "openai/gpt-5.2",
    displayName: "GPT-5.2",
    enabled: false,
  },
  {
    provider: "openai",
    model: "openai/gpt-5.2",
    reasoning: "high",
    displayName: "GPT-5.2 (high)",
    enabled: false,
  },
  {
    provider: "openai",
    model: "openai/gpt-5.2",
    reasoning: "xhigh",
    displayName: "GPT-5.2 (xhigh)",
    enabled: false,
  },
  {
    provider: "openai",
    model: "openai/gpt-oss-120b",
    displayName: "GPT OSS 120B",
    enabled: false,
  },

  // X-AI
  {
    provider: "x-ai",
    model: "x-ai/grok-4.1-fast",
    displayName: "Grok 4.1 Fast",
    enabled: false,
  },

  // OpenCode Zen
  {
    provider: "opencode-zen",
    model: "glm-4.7-free",
    displayName: "GLM 4.7 Free",
    enabled: false,
  },
];

// Generate model key from definition
export function getModelKey(def: ModelDefinition): string {
  const reasoningSuffix = def.reasoning ? `-${def.reasoning}` : "";
  return `[${def.provider}]${def.model.split("/").pop()}${reasoningSuffix}`;
}

// Create language model instance from definition
export function createModelInstance(def: ModelDefinition): LanguageModel {
  switch (def.provider) {
    case "opencode-zen":
      return opencodeZen(def.model) as LanguageModel;
    case "lmstudio":
      return lmStudio(def.model) as LanguageModel;
    default:
      return createOpenRouterModel(def.model, def.reasoning);
  }
}

// Build MODELS object from enabled definitions
function buildModels(): Record<string, LanguageModel> {
  const models: Record<string, LanguageModel> = {};
  for (const def of MODEL_DEFINITIONS.filter((d) => d.enabled)) {
    const key = getModelKey(def);
    models[key] = createModelInstance(def);
  }
  return models;
}

export const MODELS = buildModels();
export type ModelKey = keyof typeof MODELS;

// Get enabled model definitions
export function getEnabledModels(): ModelDefinition[] {
  return MODEL_DEFINITIONS.filter((d) => d.enabled);
}

// Get all model definitions (for UI model selection)
export function getAllModels(): ModelDefinition[] {
  return MODEL_DEFINITIONS;
}

// Enable/disable models dynamically
export function setModelEnabled(modelKey: string, enabled: boolean): void {
  const def = MODEL_DEFINITIONS.find((d) => getModelKey(d) === modelKey);
  if (def) {
    def.enabled = enabled;
  }
}

// Get model definition by key
export function getModelDefinition(
  modelKey: string
): ModelDefinition | undefined {
  return MODEL_DEFINITIONS.find((d) => getModelKey(d) === modelKey);
}
