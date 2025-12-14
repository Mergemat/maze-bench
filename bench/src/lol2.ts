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

const MAZE_CONFIG = {
	width: 21,
	height: 11,
	complexity: "complex" as MazeComplexity,
	visionMode: "global" as VisionMode,
};

const MAX_STEPS = 200;

/* ============================================================
   TYPES
============================================================ */

type Cell = "#" | " " | "S" | "G";
type Pos = { x: number; y: number };

/* ============================================================
   ANSI / TUI
============================================================ */

const ANSI = {
	reset: "\u001b[0m",
	bold: "\u001b[1m",
	clear: "\u001b[2J\u001b[H",

	wall: "\u001b[38;5;240m",
	agent: "\u001b[38;5;51m",
	goal: "\u001b[38;5;46m",
	path: "\u001b[38;5;250m",
	panel: "\u001b[38;5;220m",
};

function box(title: string, content: string): string {
	const lines = content.split("\n");
	const width = Math.max(title.length, ...lines.map((l) => l.length));
	const top = "┌─ " + title.padEnd(width) + " ─┐";
	const bottom = "└" + "─".repeat(width + 4) + "┘";

	const body = lines.map((l) => "│  " + l.padEnd(width) + "  │").join("\n");

	return [top, body, bottom].join("\n");
}

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

	function exits(x: number, y: number): number {
		let n = 0;
		for (const { dx, dy } of dirs) {
			if (grid[y + dy / 2]?.[x + dx / 2] === " ") n++;
		}
		return n;
	}

	for (let pass = 0; pass < height * dead; pass++) {
		for (let y = 1; y < height - 1; y += 2) {
			for (let x = 1; x < width - 1; x += 2) {
				if (grid[y][x] === " " && exits(x, y) === 1) {
					if (Math.random() < dead) grid[y][x] = "#";
				}
			}
		}
	}

	grid[1][1] = "S";
	grid[height - 2][width - 2] = "G";

	return grid.map((r) => r.join(""));
}

const maze = generateMaze(
	MAZE_CONFIG.width,
	MAZE_CONFIG.height,
	MAZE_CONFIG.complexity,
);

/* ============================================================
   ENV
============================================================ */

const env = {
	pos: { x: 1, y: 1 } as Pos,
	steps: 0,
	done: false,
	visionMode: MAZE_CONFIG.visionMode,
};

function isWall(x: number, y: number): boolean {
	return maze[y]?.[x] === "#";
}

function isGoal(x: number, y: number): boolean {
	return maze[y]?.[x] === "G";
}

/* ============================================================
   VIEWS
============================================================ */

function asciiView5x5(): string {
	const r = 2;
	const out: string[] = [];

	for (let dy = -r; dy <= r; dy++) {
		let row = "";
		for (let dx = -r; dx <= r; dx++) {
			const x = env.pos.x + dx;
			const y = env.pos.y + dy;

			if (x === env.pos.x && y === env.pos.y) row += "A";
			else if (maze[y]?.[x]) row += maze[y][x];
			else row += "#";
		}
		out.push(row);
	}
	return out.join("\n");
}

function fullMazeView(): string {
	return maze
		.map((row, y) =>
			row
				.split("")
				.map((c, x) => (x === env.pos.x && y === env.pos.y ? "A" : c))
				.join(""),
		)
		.join("\n");
}

function observation(): string {
	return env.visionMode === "global" ? fullMazeView() : asciiView5x5();
}

/* ============================================================
   RENDERING
============================================================ */

function renderMaze(): string {
	return maze
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

export function renderUI(view: string) {
	console.log(ANSI.clear);
	console.log(box(" MAZE ", renderMaze()));
	console.log();
	console.log(box(" OBSERVATION ", view));
	console.log();
	console.log(
		box(
			" STATUS ",
			`Steps: ${env.steps}\nVision: ${env.visionMode}\nState: ${
				env.done ? "DONE" : "RUNNING"
			}`,
		),
	);
}

/* ============================================================
   TOOL
============================================================ */

const moveTool = tool({
	description: "Move in the maze",
	inputSchema: z.object({
		direction: z.enum(["up", "down", "left", "right"]),
	}),
	execute: async ({ direction }) => {
		if (env.done || env.steps >= MAX_STEPS) {
			return {
				view: observation(),
				terminated: true,
				success: false,
			};
		}

		env.steps++;

		const d: Record<string, Pos> = {
			up: { x: 0, y: -1 },
			down: { x: 0, y: 1 },
			left: { x: -1, y: 0 },
			right: { x: 1, y: 0 },
		};

		const next = {
			x: env.pos.x + d[direction].x,
			y: env.pos.y + d[direction].y,
		};

		if (!isWall(next.x, next.y)) env.pos = next;
		if (isGoal(env.pos.x, env.pos.y)) env.done = true;

		return {
			view: observation(),
			terminated: env.done,
			success: env.done,
		};
	},
});

const tools = { move: moveTool } satisfies ToolSet;

const stop: StopCondition<typeof tools> = ({ steps }) =>
	steps.some((s) => s.toolResults?.some((r) => r.output?.success));

/* ============================================================
   AGENT
============================================================ */

const model = wrapLanguageModel({
	model: gateway("openai/gpt-5-nano"),
	middleware: devToolsMiddleware(),
});

const agent = new Agent({
	model,
	tools,
	stopWhen: stop,
});

/* ============================================================
   MAIN
============================================================ */

async function main() {
	const initialObservation = observation();
	const stream = streamText({
		model,
		tools,
		stopWhen: stop,

		prompt: `
${initialObservation}
`,

		system: `
You are navigating a maze. Find a way out.

Legend:
# = wall
(space) = empty
A = you
G = goal

Choose one move using the move tool.
`,
	});

	for await (const r of stream.fullStream) {
		if (r.type === "tool-result") {
			renderUI(r.output.view);
		}
	}

	renderUI(observation());
	console.log(
		"\n" +
			ANSI.bold +
			`=== RUN COMPLETE | Steps: ${env.steps} | Success: ${env.done} ===` +
			ANSI.reset,
	);
}

main();
