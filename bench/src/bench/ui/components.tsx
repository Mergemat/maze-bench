
import { Box, Text } from "ink";
import type { RunState, BenchmarkStats } from "../types";

export function Header({ title }: { title: string }) {
	return (
		<Box marginBottom={1}>
			<Text bold color="yellow">
				{title}
			</Text>
		</Box>
	);
}

export function RunRow({ run }: { run: RunState }) {
	const statusIcon = {
		pending: "○",
		running: "◐",
		success: "●",
		failed: "✗",
	}[run.status];

	const statusColor = {
		pending: "gray",
		running: "cyan",
		success: "green",
		failed: "red",
	}[run.status] as "gray" | "cyan" | "green" | "red";

	const timeStr = run.timeMs !== undefined ? `${(run.timeMs / 1000).toFixed(1)}s` : null;
	const costStr = run.cost !== undefined ? `$${run.cost.toFixed(4)}` : null;

	return (
		<Box>
			<Text color={statusColor}>{statusIcon} </Text>
			<Text color="white">{run.model}</Text>
			<Text color="gray"> │ </Text>
			<Text>{run.mazeId}</Text>
			{run.status === "running" && (
				<Text color="cyan"> │ Step {run.currentStep}</Text>
			)}
			{(run.status === "success" || run.status === "failed") && timeStr && (
				<Text color="magenta"> │ {timeStr}</Text>
			)}
			{(run.status === "success" || run.status === "failed") && costStr && (
				<Text color="yellow"> │ {costStr}</Text>
			)}
			{run.error && <Text color="red"> │ {run.error}</Text>}
		</Box>
	);
}

export function ProgressBar({
	completed,
	total,
	width = 30,
}: {
	completed: number;
	total: number;
	width?: number;
}) {
	const percent = total === 0 ? 0 : completed / total;
	const filled = Math.round(width * percent);
	const empty = width - filled;

	return (
		<Box>
			<Text color="green">{"█".repeat(filled)}</Text>
			<Text color="gray">{"░".repeat(empty)}</Text>
			<Text color="white">
				{" "}
				{completed}/{total} ({Math.round(percent * 100)}%)
			</Text>
		</Box>
	);
}

export function RunningStats({ elapsedMs, totalCost }: { elapsedMs: number; totalCost: number }) {
	const seconds = Math.floor(elapsedMs / 1000);
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	const timeStr = minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;

	return (
		<Box marginTop={1}>
			<Text color="magenta">Time: </Text>
			<Text>{timeStr}</Text>
			<Text color="gray"> │ </Text>
			<Text color="yellow">Cost: </Text>
			<Text>${totalCost.toFixed(4)}</Text>
		</Box>
	);
}

export function StatsDisplay({ stats }: { stats: BenchmarkStats }) {
	return (
		<Box flexDirection="column" marginTop={1}>
			<Text bold color="yellow">
				Results
			</Text>
			<Box>
				<Text color="green">Success Rate: </Text>
				<Text>{(stats.overall.successRate * 100).toFixed(1)}%</Text>
			</Box>
			<Box>
				<Text color="cyan">Avg Steps: </Text>
				<Text>{stats.overall.avgSteps.toFixed(1)}</Text>
			</Box>
			<Box>
				<Text color="magenta">Avg Time: </Text>
				<Text>{(stats.overall.avgTimeMs / 1000).toFixed(2)}s</Text>
			</Box>
			<Box>
				<Text color="yellow">Total Cost: </Text>
				<Text>${stats.overall.totalCost.toFixed(4)}</Text>
			</Box>
		</Box>
	);
}

export function Divider() {
	return (
		<Box marginY={1}>
			<Text color="gray">{"─".repeat(50)}</Text>
		</Box>
	);
}
