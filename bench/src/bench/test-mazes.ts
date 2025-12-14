#!/usr/bin/env bun
import { generateSharedMazes } from "./maze";

const ANSI = {
	reset: "\u001b[0m",
	title: "\u001b[38;5;220m",
	wall: "\u001b[38;5;240m",
	goal: "\u001b[38;5;46m",
	start: "\u001b[38;5;51m",
	path: "\u001b[38;5;250m",
};

function renderMaze(maze: string[]) {
	return maze
		.map((row) =>
			row
				.split("")
				.map((c) => {
					if (c === "#") return `${ANSI.wall}█${ANSI.reset}`;
					if (c === "S") return `${ANSI.start}S${ANSI.reset}`;
					if (c === "G") return `${ANSI.goal}G${ANSI.reset}`;
					return `${ANSI.path}·${ANSI.reset}`;
				})
				.join(""),
		)
		.join("\n");
}

export async function testSharedMazes() {
	const mazes = generateSharedMazes();

	console.log(
		`${ANSI.title}Benchmark Maze Set (${mazes.length} mazes total)${ANSI.reset}\n`,
	);

	for (const { id, cfg, seed, maze } of mazes) {
		console.log(`${ANSI.title}${id}${ANSI.reset}`);
		console.log(
			`Config: ${cfg.width}x${cfg.height}, complexity=${cfg.complexity}, vision=${cfg.vision}, seed=${seed}`,
		);
		console.log(renderMaze(maze));
		console.log();
	}

	console.log(`${ANSI.title}Done.${ANSI.reset}`);
}

if (import.meta.main) {
	await testSharedMazes();
}
