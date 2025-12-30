import {
  generateText,
  tool,
  type LanguageModel,
  type StopCondition,
  type ToolSet,
} from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import z from "zod";

// Simple test to check usage/cost reporting with tool calls
async function testUsageReporting() {
  const model = openrouter("google/gemini-2.5-flash", {
    usage: { include: true },
  }) as LanguageModel;

  // Simple counter tool
  let counter = 0;
  const tools = {
    increment: tool({
      description:
        "Increment the counter by 1. Call this tool to increase the counter value.",
      inputSchema: z.object({}),
      execute: () => {
        counter++;
        console.log(`  [Tool executed] counter = ${counter}`);
        return {
          counter,
          done: counter >= 3,
        };
      },
    }),
  } satisfies ToolSet;

  // Stop when counter reaches 3
  const stop: StopCondition<typeof tools> = ({ steps }) =>
    steps.some((s) =>
      s.toolResults?.some((r) => {
        const output = r.output as { done?: boolean } | undefined;
        return output?.done === true;
      })
    );

  console.log("Starting test with tool calls...\n");

  const result = await generateText({
    model,
    tools,
    stopWhen: stop,
    system:
      "You are a helpful assistant. Use the increment tool to increase the counter. Keep calling until done is true.",
    prompt: "Please increment the counter until it reaches 3.",
    temperature: 0,
  });

  console.log("\n=== RESULT SUMMARY ===");
  console.log(`Total steps: ${result.steps.length}`);
  console.log(`Final counter: ${counter}`);
  console.log("");

  console.log("=== TOP-LEVEL PROVIDER METADATA ===");
  console.log(JSON.stringify(result.providerMetadata, null, 2));
  console.log("");

  console.log("=== TOP-LEVEL USAGE ===");
  console.log(JSON.stringify(result.usage, null, 2));
  console.log("");

  console.log("=== STEP-LEVEL DETAILS ===");
  for (let i = 0; i < result.steps.length; i++) {
    const step = result.steps[i];
    if (!step) {
      continue;
    }
    console.log(`\n--- Step ${i + 1} ---`);
    console.log(`Tool calls: ${step.toolCalls?.length ?? 0}`);
    console.log(`Tool results: ${step.toolResults?.length ?? 0}`);

    // Check for step-level usage
    console.log("Step usage:", JSON.stringify(step.usage, null, 2));

    // Check for provider metadata at step level - cast to any to explore structure
    const stepAny = step as unknown as Record<string, unknown>;
    const stepProviderMeta =
      stepAny.experimental_providerMetadata ?? stepAny.providerMetadata;
    if (stepProviderMeta) {
      console.log(
        "Step providerMetadata:",
        JSON.stringify(stepProviderMeta, null, 2)
      );
    }
  }

  console.log("\n=== COST EXTRACTION ===");

  // Method 1: Top-level
  const topLevelCost = (
    result.providerMetadata?.openrouter as Record<string, unknown> | undefined
  )?.usage;
  console.log(`Top-level openrouter.usage: ${JSON.stringify(topLevelCost)}`);

  // Method 2: Sum from steps
  let stepCostSum = 0;
  for (const step of result.steps) {
    const stepAny = step as unknown as Record<string, unknown>;
    const stepMeta =
      (
        stepAny.experimental_providerMetadata as
          | Record<string, unknown>
          | undefined
      )?.openrouter ??
      (stepAny.providerMetadata as Record<string, unknown> | undefined)
        ?.openrouter;
    const usage = (stepMeta as Record<string, unknown> | undefined)?.usage as
      | Record<string, unknown>
      | undefined;
    const stepCost = (usage?.cost as number) ?? 0;
    stepCostSum += stepCost;
  }
  console.log(`Sum of step costs: ${stepCostSum}`);

  // Method 3: Check response metadata
  console.log("\n=== RESPONSE METADATA ===");
  console.log(
    "response.headers:",
    result.response?.headers ? "present" : "absent"
  );
  console.log("response.id:", result.response?.id);
}

testUsageReporting().catch(console.error);
