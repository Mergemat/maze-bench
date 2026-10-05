import { BENCH_NAME } from "@mazebench/core";
import { type ChartModel, Charts } from "@/components/charts";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { activeSuite, leaderboard } from "@/lib/data";
import { slug } from "@/lib/format";

export default function Home() {
  const rows = leaderboard();
  const { preview } = activeSuite();
  const models: ChartModel[] = rows
    .filter((r) => r.subject.kind === "model" && r.composite)
    .map((r) => ({
      key: r.subject.key,
      group: r.subject.key.split("@")[0] ?? r.subject.key,
      // The display name carries the effort in brackets; the chart shows effort separately.
      name: r.subject.displayName.replace(/\s*\([^)]*\)$/, ""),
      effort: r.subject.reasoningEffort,
      creator: r.subject.creator,
      href: `/model/${slug(r.subject.key)}`,
      score: r.composite?.mean ?? 0,
      lo: r.composite?.lo ?? 0,
      hi: r.composite?.hi ?? 0,
      cost: r.perMaze.costUsd,
      outputTokens: r.perMaze.outputTokens,
      steps: r.perMaze.steps,
    }));

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="font-pixel text-3xl tracking-tight">{BENCH_NAME}</h1>
        <p className="text-muted-foreground text-sm">
          LLM agents walking procedurally generated mazes. One line per model across reasoning effort.{" "}
          {preview ? <span className="font-mono text-xs">(preview: smoke runs)</span> : null}
        </p>
      </header>
      <Charts models={models} />
      <LeaderboardTable rows={rows} />
    </div>
  );
}
