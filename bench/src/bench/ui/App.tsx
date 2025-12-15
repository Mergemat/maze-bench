import { Box, render, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import { CONCURRENCY_LIMIT } from "../config";
import { generateSharedMazes } from "../maze";
import type { ModelKey } from "../models";
import { MODELS } from "../models";
import { runSingleMaze } from "../runner";
import { saveRunResult } from "../save";
import { computeStats } from "../stats";
import type { BenchmarkStats, MazeData, RunResult } from "../types";

type Phase = "pickSuite" | "version" | "running" | "done";

type SuiteChoice = {
	id: string;
	name: string;
	description?: string;
	// Put whatever you need here to generate mazes/config
	// e.g. mazeCount, difficulty, seedSet, etc.
};

type ModelStats = {
	total: number;

	executedStarted: number;
	executedDone: number;
	executedErrors: number;

	durationSumMs: number;
	maxDurationMs: number;

	correctCount: number;
	incorrectCount: number;

	costSum: number;
	completionTokensSum: number;
};

function formatDefaultVersion() {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function pctColor(p: number) {
	if (p >= 80) return "green" as const;
	if (p >= 50) return "yellow" as const;
	return "red" as const;
}

function pad(str: string, width: number) {
	if (str.length === width) return str;
	if (str.length < width) return str.padEnd(width, " ");
	if (width <= 1) return str.slice(0, width);
	return str.slice(0, Math.max(0, width - 1)) + "…";
}

function padLeft(str: string, width: number) {
	if (str.length === width) return str;
	if (str.length < width) return str.padStart(width, " ");
	return str.slice(-width);
}

function ProgressBar({
	completed,
	total,
}: {
	completed: number;
	total: number;
}) {
	const width =
		typeof (process.stdout as any).columns === "number"
			? Math.max(20, Math.min(60, (process.stdout as any).columns - 30))
			: 40;

	const ratio = total > 0 ? completed / total : 0;
	const filled = Math.round(width * ratio);
	const empty = width - filled;
	const percent = total > 0 ? Math.floor(ratio * 100) : 0;

	return (
		<Text>
			[<Text color="green">{"█".repeat(filled)}</Text>
			<Text color="gray">{"░".repeat(empty)}</Text>]{" "}
			<Text color="cyan">{percent}%</Text> (
			<Text color="green">{completed}</Text>/<Text color="white">{total}</Text>)
		</Text>
	);
}

/**
 * TODO: Replace this with whatever “suites” mean for you:
 * - different maze counts
 * - different generators
 * - different seed lists
 * - etc.
 */
function getSuites(): SuiteChoice[] {
	return [
		{
			id: "default",
			name: "Default mazes",
			description: "Shared mazes from generateSharedMazes()",
		},
		// { id: "hard", name: "Hard set", description: "More steps / bigger mazes" },
	];
}

/**
 * TODO: If suite affects maze generation, implement it here.
 */
function generateMazesForSuite(_suite: SuiteChoice): MazeData[] {
	return generateSharedMazes();
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

	const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
		worker(),
	);
	await Promise.all(workers);
}

const App: React.FC = () => {
	const { exit } = useApp();

	const suites = useMemo(() => getSuites(), []);
	const models = useMemo(() => Object.keys(MODELS) as ModelKey[], []);

	const [phase, setPhase] = useState<Phase>("pickSuite");
	const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
	const [version, setVersion] = useState(formatDefaultVersion());

	const [modelOrder, setModelOrder] = useState<string[]>(models);
	const [stats, setStats] = useState<Record<string, ModelStats>>({});
	const [total, setTotal] = useState(0);

	const [completed, setCompleted] = useState(0);
	const [errors, setErrors] = useState(0);
	const [runningCount, setRunningCount] = useState(0);
	const [totalCost, setTotalCost] = useState(0);

	const [finalStats, setFinalStats] = useState<BenchmarkStats | null>(null);

	useEffect(() => {
		if (phase !== "running") return;
		if (!selectedSuiteId) return;

		const suite = suites.find((s) => s.id === selectedSuiteId);
		if (!suite) return;

		let cancelled = false;

		(async () => {
			const mazes = generateMazesForSuite(suite);

			const tasks: Array<{ model: ModelKey; maze: MazeData }> = [];
			for (const model of models) {
				for (const maze of mazes) {
					tasks.push({ model, maze });
				}
			}

			if (cancelled) return;

			setModelOrder(models);
			setTotal(tasks.length);
			setCompleted(0);
			setErrors(0);
			setRunningCount(0);
			setTotalCost(0);
			setFinalStats(null);

			// init per-model stats
			setStats(
				models.reduce(
					(acc, name) => {
						acc[name] = {
							total: mazes.length,
							executedStarted: 0,
							executedDone: 0,
							executedErrors: 0,
							durationSumMs: 0,
							maxDurationMs: 0,
							correctCount: 0,
							incorrectCount: 0,
							costSum: 0,
							completionTokensSum: 0,
						};
						return acc;
					},
					{} as Record<string, ModelStats>,
				),
			);

			const allResults: RunResult[] = [];

			// for per-model save
			const resultsByModel = new Map<ModelKey, RunResult[]>();
			const savedModels = new Set<ModelKey>();
			const mazesPerModel = mazes.length;

			await runWithConcurrency(
				tasks,
				CONCURRENCY_LIMIT,
				async ({ model, maze }) => {
					const startedAt = Date.now();

					setStats((prev) => ({
						...prev,
						[model]: {
							...prev[model],
							executedStarted: prev[model].executedStarted + 1,
						},
					}));
					setRunningCount((r) => r + 1);

					let result: RunResult;
					try {
						result = await runSingleMaze(model, maze, () => {
							// you can still wire per-step UI separately if you want
						});
					} catch (e) {
						// If runSingleMaze throws instead of returning { success:false }
						result = {
							model,
							mazeId: maze.id,
							success: false,
							error: (e as Error).message,
							totalDurationMs: Date.now() - startedAt,
							cost: undefined,
						} as RunResult;
					}

					allResults.push(result);

					if (!resultsByModel.has(model)) resultsByModel.set(model, []);
					resultsByModel.get(model)!.push(result);

					// update per-model aggregates
					if (result.success) {
						setStats((prev) => ({
							...prev,
							[model]: {
								...prev[model],
								executedDone: prev[model].executedDone + 1,
								durationSumMs:
									prev[model].durationSumMs + (result.totalDurationMs ?? 0),
								maxDurationMs: Math.max(
									prev[model].maxDurationMs,
									result.totalDurationMs ?? 0,
								),
								correctCount: prev[model].correctCount + 1,
								costSum: prev[model].costSum + (result.cost ?? 0),
								completionTokensSum:
									prev[model].completionTokensSum +
									// if you have tokens on result, wire it here; else leave 0
									((result as any).completionTokens ?? 0),
							},
						}));
					} else {
						setStats((prev) => ({
							...prev,
							[model]: {
								...prev[model],
								executedErrors: prev[model].executedErrors + 1,
								durationSumMs:
									prev[model].durationSumMs + (result.totalDurationMs ?? 0),
								maxDurationMs: Math.max(
									prev[model].maxDurationMs,
									result.totalDurationMs ?? 0,
								),
								incorrectCount: prev[model].incorrectCount + 1,
							},
						}));

						setErrors((e) => e + 1);
					}

					// global counters
					setCompleted((c) => c + 1);
					setRunningCount((r) => Math.max(0, r - 1));
					setTotalCost((c) => c + (result.cost ?? 0));

					// save per-model once complete
					if (
						!savedModels.has(model) &&
						resultsByModel.get(model)!.length === mazesPerModel
					) {
						savedModels.add(model);
						const modelResults = resultsByModel.get(model)!;
						const modelStats = computeStats(modelResults);

						const filename = `${model}_${version}_${new Date()
							.toISOString()
							.replace(/[:.]/g, "-")}.json`;

						saveRunResult(filename, {
							metadata: {
								model,
								date: new Date().toISOString(),
								version,
								suite: suite.id,
								seeds: mazes.map((m) => m.seed),
							},
							stats: modelStats,
							results: modelResults,
						});
					}
				},
			);

			if (cancelled) return;

			setFinalStats(computeStats(allResults));
			setPhase("done");

			// if you want it to “stay open”, remove this:
			exit();
		})();

		return () => {
			cancelled = true;
		};
	}, [phase, selectedSuiteId, version, suites, models, exit]);

	if (phase === "pickSuite") {
		return (
			<Box flexDirection="column">
				<Text>Select a suite:</Text>
				<SelectInput
					items={suites.map((s) => ({
						key: s.id,
						label: `${s.name}${s.description ? ` — ${s.description}` : ""}`,
						value: s.id,
					}))}
					onSelect={(item: any) => {
						setSelectedSuiteId(item.value as string);
						setPhase("version");
					}}
				/>
			</Box>
		);
	}

	if (phase === "version") {
		return (
			<Box flexDirection="column">
				<Text>Version label (press Enter to start):</Text>
				<Box marginTop={1}>
					<TextInput
						value={version}
						onChange={setVersion}
						onSubmit={() => setPhase("running")}
					/>
				</Box>
			</Box>
		);
	}

	// running + done share same table view
	const header = [
		"Model",
		"Tests",
		"% Right",
		"Errors",
		"Running",
		"Avg Cost",
		"Avg Tokens",
		"Avg Duration",
		"Slowest",
	];

	const rows = modelOrder.map((name) => {
		const s = stats[name];
		const denom = s?.total ?? 0;

		const done = s ? s.executedDone : 0;
		const err = s ? s.executedErrors : 0;
		const started = s ? s.executedStarted : 0;
		const running = Math.max(0, started - done - err);

		const answered = s ? s.correctCount + s.incorrectCount : 0;
		const pct =
			answered > 0 ? Math.round((s!.correctCount / answered) * 100) : null;

		const avgCount = done + err;
		const avgSec = avgCount > 0 ? s!.durationSumMs / avgCount / 1000 : null;
		const slowSec = s && s.maxDurationMs > 0 ? s.maxDurationMs / 1000 : null;

		const costDenom = done; // only for successful (or “cost recorded”) runs
		const avgCost = costDenom > 0 ? s!.costSum / costDenom : null;

		const tokensDenom = done;
		const avgTokens =
			tokensDenom > 0 ? Math.round(s!.completionTokensSum / tokensDenom) : null;

		return {
			model: name,
			tests: `${done + err}/${denom}`,
			correct: pct == null ? "-" : `${pct}%`,
			err: err === 0 ? "-" : String(err),
			running: running === 0 ? "-" : String(running),
			avgCost: avgCost == null ? "-" : `$${avgCost.toFixed(4)}`,
			avgTokens: avgTokens == null ? "-" : avgTokens.toLocaleString(),
			avg: avgSec == null ? "-" : `${avgSec.toFixed(2)}s`,
			slow: slowSec == null ? "-" : `${slowSec.toFixed(2)}s`,
			pct,
		};
	});

	const widths = {
		model: Math.max(header[0].length, ...rows.map((r) => r.model.length)),
		tests: Math.max(header[1].length, ...rows.map((r) => r.tests.length)),
		correct: Math.max(header[2].length, ...rows.map((r) => r.correct.length)),
		err: Math.max(header[3].length, ...rows.map((r) => r.err.length)),
		running: Math.max(header[4].length, ...rows.map((r) => r.running.length)),
		avgCost: Math.max(header[5].length, ...rows.map((r) => r.avgCost.length)),
		avgTokens: Math.max(
			header[6].length,
			...rows.map((r) => r.avgTokens.length),
		),
		avg: Math.max(header[7].length, ...rows.map((r) => r.avg.length)),
		slow: Math.max(header[8].length, ...rows.map((r) => r.slow.length)),
	};

	const overallAnswered = modelOrder.reduce((acc, m) => {
		const s = stats[m];
		return acc + (s ? s.correctCount + s.incorrectCount : 0);
	}, 0);

	const overallCorrect = modelOrder.reduce((acc, m) => {
		const s = stats[m];
		return acc + (s ? s.correctCount : 0);
	}, 0);

	const overallPct =
		overallAnswered > 0
			? Math.round((overallCorrect / overallAnswered) * 100)
			: null;

	const overallAvgSec = (() => {
		let sum = 0;
		let denom = 0;
		for (const m of modelOrder) {
			const s = stats[m];
			if (!s) continue;
			const c = s.executedDone + s.executedErrors;
			sum += s.durationSumMs;
			denom += c;
		}
		return denom > 0 ? sum / denom / 1000 : null;
	})();

	return (
		<Box flexDirection="column">
			<Text>
				{phase === "running" ? "Running" : "Done"} suite{" "}
				<Text color="magentaBright">{selectedSuiteId}</Text> @ version{" "}
				<Text color="cyan">{version}</Text>
			</Text>

			<Box flexDirection="column" marginTop={1}>
				<Text>
					<Text underline color="whiteBright">
						{pad(header[0], widths.model)}
					</Text>
					{"  "}
					<Text underline color="whiteBright">
						{pad(header[1], widths.tests)}
					</Text>
					{"  "}
					<Text underline color="whiteBright">
						{pad(header[2], widths.correct)}
					</Text>
					{"  "}
					<Text underline color="whiteBright">
						{pad(header[3], widths.err)}
					</Text>
					{"  "}
					<Text underline color="whiteBright">
						{pad(header[4], widths.running)}
					</Text>
					{"  "}
					<Text underline color="whiteBright">
						{pad(header[5], widths.avgCost)}
					</Text>
					{"  "}
					<Text underline color="whiteBright">
						{pad(header[6], widths.avgTokens)}
					</Text>
					{"  "}
					<Text underline color="whiteBright">
						{pad(header[7], widths.avg)}
					</Text>
					{"  "}
					<Text underline color="whiteBright">
						{pad(header[8], widths.slow)}
					</Text>
				</Text>

				{rows.map((r) => (
					<Text key={r.model}>
						<Text color="whiteBright">{pad(r.model, widths.model)}</Text>
						{"  "}
						<Text color="white">{padLeft(r.tests, widths.tests)}</Text>
						{"  "}
						<Text color={r.pct == null ? "gray" : pctColor(r.pct)}>
							{padLeft(r.correct, widths.correct)}
						</Text>
						{"  "}
						<Text color={r.err === "-" ? "gray" : "red"}>
							{padLeft(r.err, widths.err)}
						</Text>
						{"  "}
						<Text color={r.running === "-" ? "gray" : "yellow"}>
							{padLeft(r.running, widths.running)}
						</Text>
						{"  "}
						<Text color={r.avgCost === "-" ? "gray" : "green"}>
							{padLeft(r.avgCost, widths.avgCost)}
						</Text>
						{"  "}
						<Text color={r.avgTokens === "-" ? "gray" : "blue"}>
							{padLeft(r.avgTokens, widths.avgTokens)}
						</Text>
						{"  "}
						<Text color={r.avg === "-" ? "gray" : "cyan"}>
							{padLeft(r.avg, widths.avg)}
						</Text>
						{"  "}
						<Text color={r.slow === "-" ? "gray" : "magenta"}>
							{padLeft(r.slow, widths.slow)}
						</Text>
					</Text>
				))}
			</Box>

			<Box marginTop={1}>
				<ProgressBar completed={completed} total={total} />
			</Box>

			<Box marginTop={1}>
				<Text>
					Overall: <Text color="green">{completed}</Text>/
					<Text color="white">{total}</Text> done •{" "}
					<Text color={overallPct == null ? "gray" : pctColor(overallPct)}>
						{overallPct == null ? "-" : `${overallPct}%`}
					</Text>{" "}
					correct • <Text color="red">{errors || "-"}</Text> errors •{" "}
					<Text color="yellow">{runningCount || "-"}</Text> running •{" "}
					<Text color={overallAvgSec == null ? "gray" : "cyan"}>
						{overallAvgSec == null ? "-" : `${overallAvgSec.toFixed(2)}s`}
					</Text>{" "}
					avg duration • <Text color="green">${totalCost.toFixed(4)}</Text>{" "}
					total cost
				</Text>
			</Box>

			{phase === "done" && finalStats && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="gray">
						Final stats computed (hook your StatsDisplay here).
					</Text>
					{/* If you want, render your existing <StatsDisplay stats={finalStats} /> */}
				</Box>
			)}
		</Box>
	);
};

export function startApp() {
	render(<App />);
}
