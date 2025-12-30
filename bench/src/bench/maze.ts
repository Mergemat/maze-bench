import { BENCHMARK_CONFIGS, RUNS_PER_CONFIG } from "./config";
import { findOptimalPath } from "./optimal-paths-utils";
import type { MazeComplexity, MazeData, MazeEnv, Pos } from "./types";

type Cell = "#" | " " | "S" | "G";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d_2b_79_f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// Complexity affects how easy it is to get lost:
// - loopDensity: MORE loops = EASIER (alternative paths, can recover from mistakes)
// - deadEndFillRatio: how many dead ends to REMOVE (higher = easier, fewer traps)
function getComplexityConfig(complexity: MazeComplexity) {
  switch (complexity) {
    case "simple":
      // Forgiving: many loops, remove most dead ends
      return { loopDensity: 0.02, deadEndFillRatio: 0.7 };
    case "normal":
      // Moderate: some loops, remove some dead ends
      return { loopDensity: 0.008, deadEndFillRatio: 0.3 };
    case "complex":
      // Challenging: few loops, keep most dead ends
      return { loopDensity: 0.002, deadEndFillRatio: 0.1 };
    case "extreme":
      // Punishing: NO loops (perfect maze), keep ALL dead ends
      return { loopDensity: 0, deadEndFillRatio: 0 };
  }
}

export function generateMaze(
  width: number,
  height: number,
  complexity: MazeComplexity,
  seed = Date.now()
): string[] {
  if (width % 2 === 0) {
    width++;
  }
  if (height % 2 === 0) {
    height++;
  }

  const rand = mulberry32(seed);
  const { loopDensity, deadEndFillRatio } = getComplexityConfig(complexity);

  const grid: Cell[][] = Array.from({ length: height }, () =>
    new Array(width).fill("#")
  );

  const dirs = [
    { dx: 0, dy: -2 },
    { dx: 2, dy: 0 },
    { dx: 0, dy: 2 },
    { dx: -2, dy: 0 },
  ];

  function shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  // Standard recursive backtracking to create a perfect maze
  function carve(startX: number, startY: number) {
    const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
    grid[startY]![startX] = " ";

    while (stack.length > 0) {
      const { x, y } = stack.at(-1)!;

      const unvisitedNeighbors = shuffle([...dirs]).filter((d) => {
        const nx = x + d.dx;
        const ny = y + d.dy;
        return (
          nx > 0 &&
          ny > 0 &&
          nx < width - 1 &&
          ny < height - 1 &&
          grid[ny]?.[nx] === "#"
        );
      });

      if (unvisitedNeighbors.length === 0) {
        stack.pop();
        continue;
      }

      const { dx, dy } = unvisitedNeighbors[0]!;
      grid[y + dy / 2]![x + dx / 2] = " ";
      grid[y + dy]![x + dx] = " ";
      stack.push({ x: x + dx, y: y + dy });
    }
  }

  // Fill in dead ends to make the maze easier (removes traps)
  function fillDeadEnds() {
    if (deadEndFillRatio <= 0) {
      return;
    }

    let changed = true;
    let fillCount = 0;
    const maxFills = Math.floor(width * height * deadEndFillRatio * 0.1);

    while (changed && fillCount < maxFills) {
      changed = false;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (grid[y]?.[x] !== " ") {
            continue;
          }
          if (x === 1 && y === 1) {
            continue; // Don't fill start
          }
          if (x === width - 2 && y === height - 2) {
            continue; // Don't fill goal
          }

          // Count open neighbors
          let openNeighbors = 0;
          for (const [dx, dy] of [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ] as const) {
            if (grid[y + dy]?.[x + dx] === " ") {
              openNeighbors++;
            }
          }

          // Dead end - fill it with some probability
          if (openNeighbors === 1 && rand() < deadEndFillRatio) {
            grid[y]![x] = "#";
            changed = true;
            fillCount++;
          }
        }
      }
    }
  }
  // Adds additional loops / holes to make it less tree-like
  function addLoops(loopCount: number) {
    for (let i = 0; i < loopCount; i++) {
      const x = Math.floor(rand() * ((width - 1) / 2)) * 2 + 1;
      const y = Math.floor(rand() * ((height - 1) / 2)) * 2 + 1;

      const { dx, dy } = dirs[Math.floor(rand() * dirs.length)]!;
      const wx = x + dx / 2;
      const wy = y + dy / 2;

      // Don't break outer boundary walls
      if (wx <= 0 || wx >= width - 1 || wy <= 0 || wy >= height - 1) {
        continue;
      }

      if (grid[wy]?.[wx] === "#") {
        grid[wy][wx] = " ";
      }
    }
  }

  carve(1, 1);
  fillDeadEnds();
  addLoops(Math.floor(width * height * loopDensity));

  grid[1]![1] = "S";
  grid[height - 2]![width - 2] = "G";

  return grid.map((r) => r.join(""));
}

export function getObservation(env: MazeEnv): string {
  // Always return global view with player position marked
  const width = env.maze[0]?.length;
  const mazeStr = env.maze.join("\n");
  const playerIdx = env.pos.y * (width + 1) + env.pos.x;
  return `${mazeStr.substring(0, playerIdx)}A${mazeStr.substring(playerIdx + 1)}`;
}

export function createMazeEnv(mazeData: MazeData): MazeEnv {
  return {
    id: mazeData.id,
    maze: mazeData.maze,
    pos: { x: 1, y: 1 },
    steps: 0,
    done: false,
    success: false,
    observationMode: mazeData.cfg.observationMode,
  };
}

export function generateSharedMazes(): MazeData[] {
  const mazes: MazeData[] = [];
  let idCounter = 0;

  for (const cfg of BENCHMARK_CONFIGS) {
    for (let i = 0; i < RUNS_PER_CONFIG; i++) {
      const seed = idCounter + 12_345;
      const id = `maze_${idCounter}_${cfg.width}x${cfg.height}_${cfg.complexity}_${cfg.observationMode}_seed${seed}`;
      const maze = generateMaze(cfg.width, cfg.height, cfg.complexity, seed);

      // Pre-compute optimal path at maze generation time
      const startPos = { x: 1, y: 1 };
      const goalPos = { x: cfg.width - 2, y: cfg.height - 2 };
      const optimalResult = findOptimalPath(maze, startPos, goalPos);
      const optimalPathLength = optimalResult.reachable
        ? optimalResult.length
        : Number.POSITIVE_INFINITY;

      mazes.push({ id, cfg, maze, seed, optimalPathLength });
      idCounter++;
    }
  }

  return mazes;
}

const d: Record<string, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function moveInMaze(
  env: MazeEnv,
  direction: "up" | "down" | "left" | "right"
): { view: string; success: boolean } {
  if (env.done) {
    return { view: getObservation(env), success: false };
  }

  env.steps++;

  const delta = d[direction]!;
  const next = { x: env.pos.x + delta.x, y: env.pos.y + delta.y };
  if (env.maze[next.y]?.[next.x] !== "#") {
    env.pos = next;
  }

  if (env.maze[env.pos.y]?.[env.pos.x] === "G") {
    env.done = true;
    env.success = true;
  }

  return { view: getObservation(env), success: env.success };
}
