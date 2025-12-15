import { Box, Text } from "ink";
import type { RunState, BenchmarkStats } from "../types";

const STATUS = { pending: "○", running: "◐", success: "●", failed: "✗" } as const;
const COLORS = { pending: "gray", running: "cyan", success: "green", failed: "red" } as const;

export function Header({ title }: { title: string }) {
	return <Text bold color="yellow">{title}</Text>;
}

export function RunRow({ run }: { run: RunState }) {
	const c = COLORS[run.status];
	const t = run.timeMs !== undefined ? ` ${(run.timeMs / 1000).toFixed(1)}s` : "";
	const $ = run.cost !== undefined ? ` $${run.cost.toFixed(4)}` : "";
	const step = run.status === "running" ? ` s${run.currentStep}` : "";
	const err = run.error ? ` ${run.error}` : "";
	return (
		<Text>
			<Text color={c}>{STATUS[run.status]}</Text>
			<Text color="white"> {run.model.slice(0, 12).padEnd(12)}</Text>
			<Text color="gray"> {run.mazeId}</Text>
			<Text color="cyan">{step}</Text>
			<Text color="magenta">{t}</Text>
			<Text color="yellow">{$}</Text>
			<Text color="red">{err}</Text>
		</Text>
	);
}

export function ProgressBar({ completed, total, width = 20 }: { completed: number; total: number; width?: number }) {
	const p = total === 0 ? 0 : completed / total;
	const f = Math.round(width * p);
	return (
		<Text>
			<Text color="green">{"█".repeat(f)}</Text>
			<Text color="gray">{"░".repeat(width - f)}</Text>
			<Text> {completed}/{total} {Math.round(p * 100)}%</Text>
		</Text>
	);
}

export function RunningStats({ elapsedMs, totalCost }: { elapsedMs: number; totalCost: number }) {
	const s = Math.floor(elapsedMs / 1000);
	const t = s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
	return <Text color="gray">{t} │ ${totalCost.toFixed(4)}</Text>;
}

export function StatsDisplay({ stats }: { stats: BenchmarkStats }) {
	const o = stats.overall;
	return (
		<Text color="yellow">
			✓{(o.successRate * 100).toFixed(0)}% │ ~{o.avgSteps.toFixed(1)}steps │ ~{(o.avgTimeMs / 1000).toFixed(1)}s │ ${o.totalCost.toFixed(4)}
		</Text>
	);
}

export function Divider() {
	return <Text color="gray">{"─".repeat(40)}</Text>;
}
