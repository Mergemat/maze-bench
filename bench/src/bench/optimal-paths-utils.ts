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

export type OptimalPathResult = {
  length: number;
  path: Pos[];
  reachable: boolean;
};

type OptimalPathData = {
  seed: number;
  config: BenchmarkConfig;
  result: OptimalPathResult;
};

type MazeData = {
  config: BenchmarkConfig;
  maze: string[];
  startPos: Pos;
  goalPos: Pos;
  seed: number;
};

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

    if (!content.results || !Array.isArray(content.results)) {
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
        const mazeKey = `${result.seed}_${result.config.complexity}_${result.config.vision}_${result.config.width}x${result.config.height}`;

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

function processMazes(mazes: Map<string, MazeData>): OptimalPathData[] {
  const results: OptimalPathData[] = [];
  const processedSeeds = new Set<number>();

  for (const [, mazeData] of mazes.entries()) {
    const { config, maze, startPos, goalPos, seed } = mazeData;

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
  }

  return results;
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
  } catch (error) {
    console.warn(`Failed to enhance ${filePath}:`, error);
  }
}

export function enhanceResultsWithOptimalPaths(): void {
  if (!fs.existsSync(RESULT_DIR)) {
    console.error(`Results directory not found: ${RESULT_DIR}`);
    return;
  }

  const files = fs
    .readdirSync(RESULT_DIR)
    .filter((file) => file.endsWith(".json"));

  if (files.length === 0) {
    console.log("No result files found to enhance");
    return;
  }

  console.log("Extracting unique mazes from results...");
  const mazes = extractMazesFromResults(files);
  console.log(`Found ${mazes.size} unique mazes`);

  console.log("Computing optimal paths...");
  const optimalPaths = processMazes(mazes);
  console.log(`Processed ${optimalPaths.length} mazes`);

  const optimalPathMap = createOptimalPathMap(optimalPaths);

  console.log("Enhancing result files...");
  for (const filePath of files) {
    enhanceSingleFile(filePath, optimalPathMap);
  }

  console.log(`Enhanced ${files.length} result files`);
}
