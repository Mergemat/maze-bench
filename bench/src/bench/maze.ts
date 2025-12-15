import { BENCHMARK_CONFIGS, RUNS_PER_CONFIG } from "./config";
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

// Define bias parameters and loop density depending on complexity
function getComplexityConfig(
  complexity: MazeComplexity,
  width: number,
  height: number
) {
  const _area = width * height;

  switch (complexity) {
    case "simple":
      return { loopDensity: 0.001, straightBias: 0.85 };
    case "normal":
      return { loopDensity: 0.003, straightBias: 0.65 };
    case "complex":
      return { loopDensity: 0.006, straightBias: 0.45 };
    case "extreme":
      return { loopDensity: 0.012, straightBias: 0.25 };
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
  const { loopDensity, straightBias } = getComplexityConfig(
    complexity,
    width,
    height
  );

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

  function carve(x: number, y: number, prevDir?: { dx: number; dy: number }) {
    grid[y]![x] = " ";

    const possibleDirs = [...dirs];

    // Add bias towards continuing in the same direction
    if (prevDir && rand() < straightBias) {
      possibleDirs.unshift(prevDir);
    }

    // Randomize order to create unpredictability
    for (const { dx, dy } of shuffle(possibleDirs)) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        nx > 0 &&
        ny > 0 &&
        nx < width - 1 &&
        ny < height - 1 &&
        grid[ny]?.[nx] === "#"
      ) {
        grid[y + dy / 2]![x + dx / 2] = " ";
        carve(nx, ny, { dx, dy });
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

      if (grid[wy]?.[wx] === "#") {
        grid[wy][wx] = " ";
      }
    }
  }

  carve(1, 1);
  addLoops(Math.floor(width * height * loopDensity));

  grid[1]![1] = "S";
  grid[height - 2]![width - 2] = "G";

  return grid.map((r) => r.join(""));
}

export function getObservation(env: MazeEnv): string {
  if (env.visionMode === "global") {
    return env.maze
      .map((row, y) =>
        row
          .split("")
          .map((c, x) => (x === env.pos.x && y === env.pos.y ? "A" : c))
          .join("")
      )
      .join("\n");
  }

  const r = 2;
  const out: string[] = [];

  for (let dy = -r; dy <= r; dy++) {
    let row = "";
    for (let dx = -r; dx <= r; dx++) {
      const x = env.pos.x + dx;
      const y = env.pos.y + dy;
      if (x === env.pos.x && y === env.pos.y) {
        row += "A";
      } else {
        row += env.maze[y]?.[x] ?? "#";
      }
    }
    out.push(row);
  }

  return out.join("\n");
}

export function createMazeEnv(mazeData: MazeData): MazeEnv {
  return {
    id: mazeData.id,
    maze: mazeData.maze,
    pos: { x: 1, y: 1 },
    steps: 0,
    done: false,
    success: false,
    visionMode: mazeData.cfg.vision,
  };
}

export function generateSharedMazes(): MazeData[] {
  const mazes: MazeData[] = [];
  let idCounter = 0;

  for (const cfg of BENCHMARK_CONFIGS) {
    for (let i = 0; i < RUNS_PER_CONFIG; i++) {
      const seed = idCounter + 12_345;
      const id = `maze_${idCounter}_${cfg.width}x${cfg.height}_${cfg.complexity}_${cfg.vision}_seed${seed}`;
      const maze = generateMaze(cfg.width, cfg.height, cfg.complexity, seed);
      mazes.push({ id, cfg, maze, seed });
      idCounter++;
    }
  }

  return mazes;
}

export function moveInMaze(
  env: MazeEnv,
  direction: "up" | "down" | "left" | "right",
  _maxSteps: number
): { view: string; success: boolean } {
  if (env.done) {
    return { view: getObservation(env), success: false };
  }

  env.steps++;

  const d: Record<string, Pos> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

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
