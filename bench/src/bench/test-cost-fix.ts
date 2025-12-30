import { generateMaze } from "./maze";
import { getModelKey, MODEL_DEFINITIONS, type ModelKey } from "./models";
import { findOptimalPath } from "./optimal-paths-utils";
import { runSingleMaze } from "./runner";
import type { BenchmarkConfig, MazeData } from "./types";

// Test the cost fix with a real maze run
async function testCostFix() {
  // Use a simple 5x5 maze for quick testing
  const cfg: BenchmarkConfig = {
    width: 5,
    height: 5,
    complexity: "simple",
    observationMode: "continuous",
  };

  const seed = 12_345;
  const maze = generateMaze(cfg.width, cfg.height, cfg.complexity, seed);

  // Compute optimal path
  const startPos = { x: 1, y: 1 };
  const goalPos = { x: cfg.width - 2, y: cfg.height - 2 };
  const optimalResult = findOptimalPath(maze, startPos, goalPos);
  const optimalPathLength = optimalResult.reachable
    ? optimalResult.length
    : Number.POSITIVE_INFINITY;

  const mazeData: MazeData = {
    id: "test-maze",
    cfg,
    maze,
    seed,
    optimalPathLength,
  };

  console.log("=== MAZE ===");
  console.log(mazeData.maze.join("\n"));
  console.log(`Optimal path length: ${optimalPathLength}`);
  console.log("");

  // Find an enabled model or use first one
  const modelDef =
    MODEL_DEFINITIONS.find((d) => d.enabled) ?? MODEL_DEFINITIONS[0];
  if (!modelDef) {
    console.error("No models available");
    return;
  }

  const modelKey = getModelKey(modelDef) as ModelKey;
  console.log(`Using model: ${modelKey}`);
  console.log("");

  console.log("Running maze...");
  const result = await runSingleMaze(modelKey, mazeData, (step, success) => {
    console.log(`  Step ${step}: success=${success}`);
  });

  console.log("\n=== RESULT ===");
  console.log(`Success: ${result.success}`);
  console.log(`Steps: ${result.totalSteps}`);
  console.log(`Duration: ${result.totalDurationMs.toFixed(0)}ms`);
  console.log(
    `Cost: ${result.cost !== undefined ? `$${result.cost.toFixed(7)}` : "undefined"}`
  );

  if (result.error) {
    console.log(`Error: ${result.error}`);
  }

  console.log("\n=== STEP TRACE ===");
  for (const step of result.stepsTrace) {
    console.log(
      `  ${step.step}: ${step.action} (${step.posBefore.x},${step.posBefore.y}) -> (${step.posAfter.x},${step.posAfter.y})`
    );
  }
}

testCostFix().catch(console.error);
