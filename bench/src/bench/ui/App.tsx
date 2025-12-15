import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { Box, Text, render } from "ink";
import type { RunState, MazeData, BenchmarkStats, RunResult } from "../types";
import type { ModelKey } from "../models";
import { MODELS } from "../models";
import { generateSharedMazes } from "../maze";
import { runSingleMaze } from "../runner";
import { computeStats } from "../stats";
import { saveRunResult } from "../save";
import { CONCURRENCY_LIMIT } from "../config";
import {
	Header,
	RunRow,
	ProgressBar,
	StatsDisplay,
	Divider,
	RunningStats,
} from "./components";

type AppState = {
	runs: Map<string, RunState>;
	results: RunResult[];
	completed: number;
	total: number;
	phase: "running" | "done";
	stats: BenchmarkStats | null;
	startTime: number;
	totalCost: number;
};

function BenchmarkApp() {
	const [state, setState] = useState<AppState>({
		runs: new Map(),
		results: [],
		completed: 0,
		total: 0,
		phase: "running",
		stats: null,
		startTime: Date.now(),
		totalCost: 0,
	});

	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		if (state.phase === "done") return;
		const interval = setInterval(() => {
			setElapsed(Date.now() - state.startTime);
		}, 100);
		return () => clearInterval(interval);
	}, [state.phase, state.startTime]);

	useEffect(() => {
		runBenchmark(setState);
	}, []);

	const runsList = Array.from(state.runs.values());

	const active = runsList.filter((r) => r.status === "running" || r.status === "failed");

	return (
		<Box flexDirection="column">
			<Box gap={2}>
				<Header title="Maze Bench" />
				<ProgressBar completed={state.completed} total={state.total} />
				<RunningStats elapsedMs={elapsed} totalCost={state.totalCost} />
			</Box>
			{active.map((run) => (
				<RunRow key={`${run.model}_${run.mazeId}`} run={run} />
			))}
			{state.phase === "done" && state.stats && (
				<Box flexDirection="column">
					<Divider />
					<StatsDisplay stats={state.stats} />
				</Box>
			)}
		</Box>
	);
}

async function runBenchmark(
	setState: Dispatch<SetStateAction<AppState>>,
) {
	const models = Object.keys(MODELS) as ModelKey[];
	const mazes = generateSharedMazes();
	const tasks: Array<{ model: ModelKey; maze: MazeData }> = [];

	for (const model of models) {
		for (const maze of mazes) {
			tasks.push({ model, maze });
		}
	}

	const initialRuns = new Map<string, RunState>();
	for (const { model, maze } of tasks) {
		const key = `${model}_${maze.id}`;
		initialRuns.set(key, {
			model,
			mazeId: maze.id,
			status: "pending",
			currentStep: 0,
		});
	}

	setState((s) => ({ ...s, runs: initialRuns, total: tasks.length }));

	const allResults: RunResult[] = [];
	const resultsByModel = new Map<ModelKey, RunResult[]>();
	const savedModels = new Set<ModelKey>();
	const mazesPerModel = mazes.length;

	await runWithConcurrency(tasks, CONCURRENCY_LIMIT, async ({ model, maze }) => {
		const key = `${model}_${maze.id}`;

		setState((s) => {
			const runs = new Map(s.runs);
			runs.set(key, { ...runs.get(key)!, status: "running" });
			return { ...s, runs };
		});

		const result = await runSingleMaze(model, maze, (step, success) => {
			setState((s) => {
				const runs = new Map(s.runs);
				const run = runs.get(key)!;
				runs.set(key, {
					...run,
					currentStep: step,
					status: success ? "success" : "running",
				});
				return { ...s, runs };
			});
		});

		allResults.push(result);

		if (!resultsByModel.has(model)) {
			resultsByModel.set(model, []);
		}
		resultsByModel.get(model)!.push(result);

		if (!savedModels.has(model) && resultsByModel.get(model)!.length === mazesPerModel) {
			savedModels.add(model);
			const modelResults = resultsByModel.get(model)!;
			const stats = computeStats(modelResults);
			const filename = `${model}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
			saveRunResult(filename, {
				metadata: {
					model,
					date: new Date().toISOString(),
					seeds: mazes.map((m) => m.seed),
				},
				stats,
				results: modelResults,
			});
		}

		setState((s) => {
			const runs = new Map(s.runs);
			runs.set(key, {
				...runs.get(key)!,
				status: result.success ? "success" : "failed",
				error: result.error,
				timeMs: result.totalDurationMs,
				cost: result.cost,
			});
			return { ...s, runs, completed: s.completed + 1, totalCost: s.totalCost + (result.cost ?? 0) };
		});
	});

	const finalStats = computeStats(allResults);
	setState((s) => ({ ...s, phase: "done", stats: finalStats }));
}

async function runWithConcurrency<T>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<void>,
): Promise<void> {
	let index = 0;

	async function worker(): Promise<void> {
		while (index < items.length) {
			const currentIndex = index++;
			await fn(items[currentIndex]!);
		}
	}

	const workers = Array.from(
		{ length: Math.min(limit, items.length) },
		() => worker(),
	);
	await Promise.all(workers);
}

export function startApp() {
	render(<BenchmarkApp />);
}
