import type { LanguageModelV4Content, LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";

export function reply(
  content: LanguageModelV4Content[],
  finish: "stop" | "length" | "tool-calls" = "stop",
): LanguageModelV4GenerateResult {
  return {
    content,
    finishReason: { unified: finish, raw: undefined },
    usage: {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 20, text: 15, reasoning: 5 },
    },
    warnings: [],
    providerMetadata: { openrouter: { provider: "MockCloud", usage: { cost: 0.001 } } },
  };
}

export const text = (t: string) => reply([{ type: "text", text: t }]);

export function toolCall(id: string, ...moves: string[]) {
  return reply(
    [{ type: "tool-call", toolCallId: id, toolName: "move", input: JSON.stringify({ moves }) }],
    "tool-calls",
  );
}

export { MockLanguageModelV4 };
