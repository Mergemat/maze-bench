import { devToolsMiddleware } from "@ai-sdk/devtools";
import { groq } from "@ai-sdk/groq";
import {
	Experimental_Agent as Agent,
	gateway,
	type StopCondition,
	streamText,
	type ToolSet,
	tool,
	wrapLanguageModel,
} from "ai";
import z from "zod";

/* ============================================================
   CONFIG
============================================================ */

type MazeComplexity = "simple" | "normal" | "complex" | "extreme";
type VisionMode = "local" | "global";

const BENCHMARK_CONFIGS = [
	{ width: 15, height: 9, complexity: "simple", vision: "local" },
	{ width: 15, height: 9, complexity: "complex", vision: "local" },
	{ width: 15, height: 9, complexity: "simple", vision: "global" },
	{ width: 15, height: 9, complexity: "complex", vision: "global" },

	{ width: 41, height: 21, complexity: "simple", vision: "local" },
	{ width: 41, height: 21, complexity: "complex", vision: "local" },
	{ width: 41, height: 21, complexity: "simple", vision: "global" },
	{ width: 41, height: 21, complexity: "complex", vision: "global" },
] as const;

const RUNS_PER_CONFIG = 10;
const MAX_STEPS = 200;

/* ============================================================
   TYPES
============================================================ */

type Cell = "#" | " " | "S" | "G";
type Pos = { x: number; y: number };

type MazeEnv = {
	id: string;
	maze: string[];
	pos: Pos;
	steps: number;
	done: boolean;
	success: boolean;
	visionMode: VisionMode;
};

/* ============================================================
   ANSI
============================================================ */

const ANSI = {
	reset: "\u001b[0m",
	clear: "\u001b[2J\u001b[H",
	wall: "\u001b[38;5;240m",
	agent: "\u001b[38;5;51m",
	goal: "\u001b[38;5;46m",
	path: "\u001b[38;5;250m",
	title: "\u001b[38;5;220m",
};

/* ============================================================
   MAZE GENERATION
============================================================ */

function generateMaze(
	width: number,
	height: number,
	complexity: MazeComplexity,
): string[] {
	if (width % 2 === 0) width++;
	if (height % 2 === 0) height++;

	const presets = {
		simple: { loop: 0, dead: 0 },
		normal: { loop: 0.05, dead: 0.15 },
		complex: { loop: 0.2, dead: 0.4 },
		extreme: { loop: 0.35, dead: 0.65 },
	};

	const { loop, dead } = presets[complexity];

	const grid: Cell[][] = Array.from({ length: height }, () =>
		Array.from({ length: width }, () => "#"),
	);

	const dirs = [
		{ dx: 0, dy: -2 },
		{ dx: 2, dy: 0 },
		{ dx: 0, dy: 2 },
		{ dx: -2, dy: 0 },
	];

	function shuffle<T>(a: T[]): T[] {
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	function carve(x: number, y: number) {
		grid[y][x] = " ";
		for (const { dx, dy } of shuffle([...dirs])) {
			const nx = x + dx;
			const ny = y + dy;
			if (
				nx > 0 &&
				ny > 0 &&
				nx < width - 1 &&
				ny < height - 1 &&
				grid[ny][nx] === "#"
			) {
				grid[y + dy / 2][x + dx / 2] = " ";
				carve(nx, ny);
			}
		}
	}

	carve(1, 1);

	for (let y = 1; y < height - 1; y += 2) {
		for (let x = 1; x < width - 1; x += 2) {
			if (grid[y][x] !== " ") continue;
			if (Math.random() < loop) {
				const { dx, dy } = shuffle([...dirs])[0];
				grid[y + dy / 2][x + dx / 2] = " ";
			}
		}
	}

	grid[1][1] = "S";
	grid[height - 2][width - 2] = "G";

	return grid.map((r) => r.join(""));
}

/* ============================================================
   VIEW HELPERS
============================================================ */

function renderMaze(env: MazeEnv): string {
	return env.maze
		.map((row, y) =>
			row
				.split("")
				.map((c, x) => {
					if (x === env.pos.x && y === env.pos.y)
						return `${ANSI.agent}A${ANSI.reset}`;
					if (c === "#") return `${ANSI.wall}█${ANSI.reset}`;
					if (c === "G") return `${ANSI.goal}G${ANSI.reset}`;
					return `${ANSI.path}·${ANSI.reset}`;
				})
				.join(""),
		)
		.join("\n");
}

function observation(env: MazeEnv): string {
	if (env.visionMode === "global") {
		return env.maze
			.map((row, y) =>
				row
					.split("")
					.map((c, x) => (x === env.pos.x && y === env.pos.y ? "A" : c))
					.join(""),
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

			if (x === env.pos.x && y === env.pos.y) row += "A";
			else row += env.maze[y]?.[x] ?? "#";
		}
		out.push(row);
	}

	return out.join("\n");
}

/* ============================================================
   TOOL FACTORY
============================================================ */

function createMoveTool(env: MazeEnv) {
	return tool({
		description: "Move in the maze",
		inputSchema: z.object({
			direction: z.enum(["up", "down", "left", "right"]),
		}),
		execute: async ({ direction }) => {
			if (env.done || env.steps >= MAX_STEPS) {
				return { view: observation(env), success: false };
			}

			env.steps++;

			const d = {
				up: { x: 0, y: -1 },
				down: { x: 0, y: 1 },
				left: { x: -1, y: 0 },
				right: { x: 1, y: 0 },
			}[direction];

			const next = { x: env.pos.x + d.x, y: env.pos.y + d.y };

			if (env.maze[next.y]?.[next.x] !== "#") env.pos = next;
			if (env.maze[env.pos.y][env.pos.x] === "G") {
				env.done = true;
				env.success = true;
			}

			return {
				view: observation(env),
				success: env.success,
			};
		},
	});
}

/* ============================================================
   AGENT MODEL
============================================================ */

const model = wrapLanguageModel({
	// model: gateway("openai/gpt-5-nano"),
	model: groq("qwen/qwen3-32b"),
	middleware: devToolsMiddleware(),
});

/* ============================================================
   BENCHMARK RUNNER
============================================================ */

async function runMaze(env: MazeEnv) {
	const tools = { move: createMoveTool(env) } satisfies ToolSet;

	const stop: StopCondition<typeof tools> = ({ steps }) =>
		steps.some((s) => s.toolResults?.some((r) => r.output?.success));

	const stream = streamText({
		model,
		tools,
		stopWhen: stop,
		prompt: observation(env),
		system: `Navigate the maze and reach G.`,
	});

	for await (const _ of stream.fullStream) {
		// rendering handled globally
	}
}

/* ============================================================
   MAIN
============================================================ */

async function main() {
	type MazeStatus = "pending" | "running" | "done";

	type EnvGroup = {
		configId: string;
		envs: MazeEnv[];
	};

	// ------------------------------------------------------------
	// Create envs grouped by config
	// ------------------------------------------------------------
	const groups: EnvGroup[] = BENCHMARK_CONFIGS.map((cfg) => {
		const envs: MazeEnv[] = [];

		for (let i = 0; i < RUNS_PER_CONFIG; i++) {
			envs.push({
				id: `${cfg.width}x${cfg.height}-${cfg.complexity}-${cfg.vision}-${i}`,
				maze: generateMaze(cfg.width, cfg.height, cfg.complexity),
				pos: { x: 1, y: 1 },
				steps: 0,
				done: false,
				success: false,
				visionMode: cfg.vision,
				status: "pending" as MazeStatus,
			});
		}

		return {
			configId: `${cfg.width}x${cfg.height}-${cfg.complexity}-${cfg.vision}`,
			envs,
		};
	});

	// Flatten for rendering
	const allEnvs = groups.flatMap((g) => g.envs);

	// ------------------------------------------------------------
	// Renderer
	// ------------------------------------------------------------
	const interval = setInterval(() => {
		console.log(ANSI.clear);

		for (const env of allEnvs) {
      if (env.status === "pending") continue;
			console.log(
				`${ANSI.title}${env.id}${ANSI.reset} | Steps: ${
					env.steps
				} | ${env.status.toUpperCase()}`,
			);
		}
	}, 100);

	// ------------------------------------------------------------
	// Run configs concurrently, runs sequentially per config
	// ------------------------------------------------------------
	await Promise.all(
		groups.map(async (group) => {
			for (const env of group.envs) {
				env.status = "running";
				await runMaze(env);
				env.status = "done";
			}
		}),
	);

	clearInterval(interval);
}

/* ============================================================
   MAZE GENERATION TEST
============================================================ */

function testMazeGeneration() {
	for (const cfg of BENCHMARK_CONFIGS) {
		console.log(ANSI.clear);

		console.log(
			`${ANSI.title}TEST CONFIG${ANSI.reset}\n` +
				`Size: ${cfg.width}x${cfg.height}\n` +
				`Complexity: ${cfg.complexity}\n` +
				`Vision: ${cfg.vision}\n`,
		);

		const maze = generateMaze(cfg.width, cfg.height, cfg.complexity);

		const env: MazeEnv = {
			id: `${cfg.width}x${cfg.height}-${cfg.complexity}-${cfg.vision}`,
			maze,
			pos: { x: 1, y: 1 },
			steps: 0,
			done: false,
			success: false,
			visionMode: cfg.vision,
		};

		console.log(`${ANSI.title}RAW MAZE${ANSI.reset}`);
		console.log(maze.join("\n"));
		console.log();

		console.log(`${ANSI.title}OBSERVATION${ANSI.reset}`);
		console.log(observation(env));
		console.log();

		console.log(`${ANSI.title}RENDERED (ANSI VIEW)${ANSI.reset}`);
		console.log(renderMaze(env));
		console.log();

		console.log(
			`${ANSI.wall}█${ANSI.reset} Wall  ` +
				`${ANSI.agent}A${ANSI.reset} Agent  ` +
				`${ANSI.goal}G${ANSI.reset} Goal  ` +
				`${ANSI.path}·${ANSI.reset} Path`,
		);

		// Pause between configs for readability
		// eslint-disable-next-line no-loop-func
		require("child_process").execSync("read -n 1", {
			stdio: "inherit",
		});
	}
}

const args = Bun.argv;

if (args.includes("test")) {
	testMazeGeneration();
} else {
	main();
}
