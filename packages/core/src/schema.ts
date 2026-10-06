import { z } from "zod";
import { SCHEMA_VERSION } from "./meta.ts";
import { TASK_IDS } from "./tasks/types.ts";

export const SubjectSchema = z.object({
  kind: z.enum(["model", "baseline"]),
  key: z.string(),
  displayName: z.string(),
  creator: z.string(),
  provider: z.enum(["openrouter", "openai-compatible", "baseline"]),
  modelId: z.string(),
  reasoningEffort: z.string(),
  openWeights: z.boolean(),
  routing: z.record(z.string(), z.unknown()).optional(),
});

export const RunHeaderSchema = z.object({
  type: z.literal("run"),
  schemaVersion: z.literal(SCHEMA_VERSION),
  runId: z.string(),
  suite: z.object({ id: z.string(), version: z.string(), split: z.enum(["public", "holdout"]) }),
  subject: SubjectSchema,
  settings: z.object({
    epochs: z.number().int().positive(),
    maxOutputTokens: z.number().int().positive(),
    temperature: z.null(),
    concurrency: z.number().int().positive(),
  }),
  /** List prices (USD per token) the run was priced at, for the fixed-price cost. */
  pricing: z
    .object({ input: z.number(), output: z.number(), cacheRead: z.number(), cacheWrite: z.number() })
    .optional(),
  harness: z.object({
    gitSha: z.string(),
    promptVersion: z.string(),
    aiSdkVersion: z.string(),
    runtime: z.string(),
  }),
  startedAt: z.string(),
});

export const UsageSchema = z.object({
  inputTokens: z.number(),
  /** Input tokens served from the provider's prompt cache (a subset of inputTokens). */
  cacheReadTokens: z.number().optional(),
  /** Input tokens written to the prompt cache (a subset of inputTokens). */
  cacheWriteTokens: z.number().optional(),
  outputTokens: z.number(),
  reasoningTokens: z.number(),
  /** What the provider billed, after any cache discount it applied. */
  costUsd: z.number().nullable(),
  /** Token counts priced at the run's list prices: comparable across providers. */
  listCostUsd: z.number().optional(),
});

const MetricValue = z.union([z.number(), z.boolean(), z.null()]);

export const ItemResultSchema = z.object({
  type: z.literal("item"),
  itemId: z.string(),
  itemHash: z.string(),
  task: z.enum(TASK_IDS as [string, ...string[]]),
  level: z.number().int(),
  seed: z.number().int(),
  epoch: z.number().int().nonnegative(),
  status: z.enum(["scored", "error"]),
  score: z.number().min(0).max(1),
  outcome: z.string(),
  metrics: z.record(z.string(), MetricValue),
  answer: z
    .object({
      text: z.string(),
      parse: z.enum(["ok", "fallback", "failed"]),
      value: z.unknown(),
    })
    .optional(),
  trace: z.record(z.string(), z.unknown()).optional(),
  usage: UsageSchema,
  latencyMs: z.number(),
  calls: z.number().int().nonnegative(),
  providers: z.array(z.string()),
  finishReason: z.string().optional(),
  error: z.object({ category: z.string(), message: z.string() }).optional(),
  finishedAt: z.string(),
});

export type Subject = z.infer<typeof SubjectSchema>;
export type RunHeader = z.infer<typeof RunHeaderSchema>;
export type ItemResult = z.infer<typeof ItemResultSchema>;
export type Usage = z.infer<typeof UsageSchema>;

export interface RunFile {
  header: RunHeader;
  items: ItemResult[];
}

/** Parse a JSONL run file. Throws with the line number on the first invalid line. */
export function parseRunJsonl(text: string, source = "run"): RunFile {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const first = lines[0];
  if (!first) {
    throw new Error(`${source}: empty file`);
  }
  const header = RunHeaderSchema.parse(JSON.parse(first));
  const items: ItemResult[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parsed = ItemResultSchema.safeParse(JSON.parse(lines[i] as string));
    if (!parsed.success) {
      throw new Error(`${source}:${i + 1}: ${parsed.error.message}`);
    }
    items.push(parsed.data);
  }
  return { header, items };
}
