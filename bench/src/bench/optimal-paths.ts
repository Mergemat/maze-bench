#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import type { BenchmarkConfig, Pos } from "./types";

const RESULT_DIR = path.resolve(import.meta.dir, "results");

const DIRECTION_VECTORS = [
  { dx: 0, dy: -1 }, // up
  { dx: 1, dy: 0 }, // right
  { dx: 0, dy: 1 }, // down
  { dx: -1, dy: 0 }, // left
] as const;

interface OptimalPathResult {
  length: number;
  path: Pos[];
  reachable: boolean;
}

interface OptimalPathData {
  seed: number;
  config: BenchmarkConfig;
  result: OptimalPathResult;
}

interface CLIOptions {
  seeds?: number[];
  model?: string;
  all?: boolean;
  output?: "json" | "enhance" | "stats";
  outputFile?: string;
}

interface MazeData {
  config: BenchmarkConfig;
  maze: string[];
  startPos: Pos;
  goalPos: Pos;
  seed: number;
}

function parseCLIArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--seeds":
        if (i + 1 < args.length) {
          const seedsStr = args[i + 1]!;
          options.seeds = seedsStr.split(",").map((s) => {
            const num = Number.parseInt(s.trim(), 10);
            if (Number.isNaN(num)) {
              console.error(`Invalid seed: ${s}`);
              process.exit(1);
            }
            return num;
          });
          i += 1; // Skip next arg
        } else {
          console.error("Missing value for --seeds");
          process.exit(1);
        }
        break;
      case "--model":
        if (i + 1 < args.length) {
          options.model = args[i + 1];
          i += 1;
        } else {
          console.error("Missing value for --model");
          process.exit(1);
        }
        break;
      case "--all":
        options.all = true;
        break;
      case "--output":
        if (i + 1 < args.length) {
          const output = args[i + 1];
          if (output === "json" || output === "enhance" || output === "stats") {
            options.output = output;
          } else {
            console.error(
              `Invalid output format: ${output}. Must be json, enhance, or stats.`
            );
            process.exit(1);
          }
          i += 1;
        } else {
          console.error("Missing value for --output");
          process.exit(1);
        }
        break;
      case "--out":
        if (i + 1 < args.length) {
          options.outputFile = args[i + 1];
          i += 1;
        } else {
          console.error("Missing value for --out");
          process.exit(1);
        }
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        showUsage();
        process.exit(1);
    }
  }

  return options;
}

export function findOptimalPath(
  maze: string[],
  start: Pos,
  goal: Pos
): OptimalPathResult {
  const height = maze.length;
  const width = maze[0]?.length || 0;

  // BFS queue: position + path
  const pathQueue: Array<{ pos: Pos; path: Pos[] }> = [
    { pos: start, path: [start] },
  ];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  const directionVectors = DIRECTION_VECTORS;

  while (pathQueue.length > 0) {
    const current = pathQueue.shift();
    if (!current) {
      break;
    }

    const { pos: currentPos, path: currentPath } = current;

    // Check if we reached the goal
    if (currentPos.x === goal.x && currentPos.y === goal.y) {
      return {
        length: currentPath.length - 1, // number of moves, not positions
        path: currentPath,
        reachable: true,
      };
    }

    // Explore neighbors
    for (const direction of directionVectors) {
      const { dx, dy } = direction;
      const next = { x: currentPos.x + dx, y: currentPos.y + dy };
      const key = `${next.x},${next.y}`;

      // Check bounds and walls
      const inBounds =
        next.x >= 0 && next.x < width && next.y >= 0 && next.y < height;

      const row = maze[next.y];
      if (inBounds && row) {
        const cell = row[next.x];
        const notWall = cell !== "#";

        if (notWall && !visited.has(key)) {
          visited.add(key);
          pathQueue.push({ pos: next, path: [...currentPath, next] });
        }
      }
    }
  }

  // Goal not reachable
  return {
    length: Number.POSITIVE_INFINITY,
    path: [],
    reachable: false,
  };
}

function loadResultFiles(options: CLIOptions): string[] {
  if (!fs.existsSync(RESULT_DIR)) {
    console.error(`Results directory not found: ${RESULT_DIR}`);
    process.exit(1);
  }

  let files: string[];
  try {
    files = fs.readdirSync(RESULT_DIR).filter((file) => file.endsWith(".json"));
  } catch (error) {
    console.error(`Failed to read results directory: ${error}`);
    process.exit(1);
  }

  if (options.model) {
    const filtered = files.filter((file) =>
      file.includes(options.model as string)
    );
    if (filtered.length === 0) {
      console.error(`No result files found for model: ${options.model}`);
      process.exit(1);
    }
    return filtered;
  }

  if (files.length === 0) {
    console.error("No result files found in the directory.");
    process.exit(1);
  }

  return files;
}

function extractMazesFromResults(filePaths: string[]): Map<string, MazeData> {
  const mazes = new Map<string, MazeData>();

  for (const filePath of filePaths) {
    const fullPath = path.join(RESULT_DIR, filePath);
    let content: any;
    try {
      const data = fs.readFileSync(fullPath, "utf-8");
      content = JSON.parse(data);
    } catch (error) {
      console.error(`Failed to read or parse ${filePath}: ${error}`);
      continue;
    }

    if (!(content.results && Array.isArray(content.results))) {
      console.warn(`Invalid results in ${filePath}: expected array of results`);
      continue;
    }

    for (const result of content.results) {
      if (
        result.seed &&
        result.config &&
        result.maze &&
        result.startPos &&
        result.goalPos
      ) {
        const mazeKey = `${result.seed}_${result.config.complexity}_${result.config.observationMode}_${result.config.width}x${result.config.height}`;

        if (!mazes.has(mazeKey)) {
          mazes.set(mazeKey, {
            config: result.config,
            maze: result.maze,
            startPos: result.startPos,
            goalPos: result.goalPos,
            seed: result.seed,
          });
        }
      } else {
        console.warn(
          `Incomplete result in ${filePath}: missing required fields`
        );
      }
    }
  }

  return mazes;
}

function processMazes(
  mazes: Map<string, MazeData>,
  options: CLIOptions
): OptimalPathData[] {
  const results: OptimalPathData[] = [];
  const processedSeeds = new Set<number>();

  for (const [, mazeData] of mazes.entries()) {
    const { config, maze, startPos, goalPos, seed } = mazeData;

    // Filter by seeds if specified
    if (options.seeds && !options.seeds.includes(seed)) {
      continue;
    }

    // Skip if already processed this seed
    if (processedSeeds.has(seed)) {
      continue;
    }

    const optimalResult = findOptimalPath(maze, startPos, goalPos);

    results.push({
      seed,
      config,
      result: optimalResult,
    });

    processedSeeds.add(seed);

    if (optimalResult.reachable) {
      console.log(
        `✓ Seed ${seed}: Optimal path length = ${optimalResult.length}`
      );
    } else {
      console.log(`✗ Seed ${seed}: Goal not reachable`);
    }
  }

  return results;
}

export function generateStats(optimalPaths: OptimalPathData[]): {
  overall: {
    reachableRate: number;
    totalMazes: number;
    totalReachable: number;
  };
  byConfig: Record<
    string,
    { avgOptimalLength: number; reachable: number; total: number }
  >;
} {
  const byConfig: Record<
    string,
    { avgOptimalLength: number; reachable: number; total: number }
  > = {};
  let totalReachable = 0;
  let totalMazes = 0;

  for (const data of optimalPaths) {
    const configKey = `${data.config.complexity}_${data.config.observationMode}_${data.config.width}x${data.config.height}`;

    if (!byConfig[configKey]) {
      byConfig[configKey] = { avgOptimalLength: 0, reachable: 0, total: 0 };
    }

    totalMazes += 1;
    if (data.result.reachable) {
      totalReachable += 1;
      byConfig[configKey].reachable += 1;
      byConfig[configKey].avgOptimalLength += data.result.length;
    }
    byConfig[configKey].total += 1;
  }

  // Calculate averages
  for (const stats of Object.values(byConfig)) {
    if (stats.reachable > 0) {
      stats.avgOptimalLength /= stats.reachable;
    }
  }

  return {
    overall: {
      reachableRate: totalReachable / totalMazes,
      totalMazes,
      totalReachable,
    },
    byConfig,
  };
}

function createOptimalPathMap(
  optimalPaths: OptimalPathData[]
): Map<number, OptimalPathResult> {
  const optimalPathMap = new Map<number, OptimalPathResult>();
  for (const data of optimalPaths) {
    optimalPathMap.set(data.seed, data.result);
  }
  return optimalPathMap;
}

function enhanceSingleFile(
  filePath: string,
  optimalPathMap: Map<number, OptimalPathResult>
): void {
  const fullPath = path.join(RESULT_DIR, filePath);

  try {
    const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

    // Enhance each result
    for (const result of content.results || []) {
      const optimal = optimalPathMap.get(result.seed);
      if (optimal) {
        if (optimal.reachable) {
          result.optimalPathLength = optimal.length;
          result.efficiencyScore = optimal.length / result.totalSteps;
        } else {
          result.optimalPathLength = null;
          result.efficiencyScore = 0;
        }
      }
    }

    // Write enhanced file back to results directory
    fs.writeFileSync(fullPath, JSON.stringify(content, null, 2));
    console.log(`Enhanced: ${fullPath}`);
  } catch (error) {
    console.warn(`Failed to enhance ${filePath}:`, error);
  }
}

function enhanceResultsWithOptimalPaths(optimalPaths: OptimalPathData[]): void {
  const files = fs
    .readdirSync(RESULT_DIR)
    .filter((file) => file.endsWith(".json"));
  const optimalPathMap = createOptimalPathMap(optimalPaths);

  for (const filePath of files) {
    enhanceSingleFile(filePath, optimalPathMap);
  }
}

function showUsage() {
  console.log(`
Usage: bun optimal-paths.ts [options]

Options:
  --seeds NUM1,NUM2,...    Process specific seeds
  --model MODEL            Process results for specific model
  --all                    Process all result files
  --output FORMAT          Output format: json, enhance, stats (default: json)
  --out FILE               Output file path

Examples:
  bun optimal-paths.ts --all --output json > optimal-paths.json
  bun optimal-paths.ts --seeds 12345,12346 --output stats
  bun optimal-paths.ts --model "[google]gemini-2.5-flash" --output enhance
  `);
}

function handleJsonOutput(
  optimalPaths: OptimalPathData[],
  options: CLIOptions
) {
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      totalMazes: optimalPaths.length,
      reachableMazes: optimalPaths.filter((p) => p.result.reachable).length,
    },
    optimalPaths: Object.fromEntries(
      optimalPaths.map((data) => [data.seed.toString(), data])
    ),
  };

  if (options.outputFile) {
    fs.writeFileSync(options.outputFile, JSON.stringify(output, null, 2));
    console.log(`Saved to: ${options.outputFile}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

function handleStatsOutput(optimalPaths: OptimalPathData[]) {
  const stats = generateStats(optimalPaths);
  console.log("\n=== OPTIMAL PATH STATISTICS ===");
  console.log(
    `Overall reachable rate: ${(stats.overall.reachableRate * 100).toFixed(1)}%`
  );
  console.log(`Total mazes: ${stats.overall.totalMazes}`);
  console.log(`Reachable mazes: ${stats.overall.totalReachable}\n`);

  console.log("By configuration:");
  for (const [config, data] of Object.entries(stats.byConfig)) {
    console.log(`  ${config}:`);
    const reachablePercentage = (data.reachable / data.total) * 100;
    console.log(
      `    Reachable: ${data.reachable}/${data.total} (${reachablePercentage.toFixed(1)}%)`
    );
    if (data.reachable > 0) {
      console.log(
        `    Avg optimal length: ${data.avgOptimalLength.toFixed(1)}`
      );
    }
  }
}

function loadAndProcessData(options: CLIOptions): {
  mazes: Map<string, MazeData>;
  optimalPaths: OptimalPathData[];
} {
  console.log("Loading result files...");
  const loadedResultFiles = loadResultFiles(options);
  console.log(`Found ${loadedResultFiles.length} result files`);

  console.log("Extracting unique mazes...");
  const mazes = extractMazesFromResults(loadedResultFiles);
  console.log(`Found ${mazes.size} unique mazes`);

  console.log("Computing optimal paths...");
  const optimalPaths = processMazes(mazes, options);
  console.log(`Processed ${optimalPaths.length} mazes`);

  return { mazes, optimalPaths };
}

function handleOutput(
  optimalPaths: OptimalPathData[],
  options: CLIOptions
): void {
  const outputFormat = options.output || "json";

  switch (outputFormat) {
    case "json":
      handleJsonOutput(optimalPaths, options);
      break;
    case "stats":
      handleStatsOutput(optimalPaths);
      break;
    case "enhance":
      enhanceResultsWithOptimalPaths(optimalPaths);
      break;
    default:
      console.error(`Unknown output format: ${outputFormat}`);
      process.exit(1);
  }
}

function main() {
  const options = parseCLIArgs();

  if (!(options.all || options.model || options.seeds)) {
    showUsage();
    process.exit(0);
  }

  const { optimalPaths } = loadAndProcessData(options);
  handleOutput(optimalPaths, options);
}

if (import.meta.main) {
  main();
}
