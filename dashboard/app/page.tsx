import { BENCH_NAME } from "@mazebench/core";
import Link from "next/link";
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
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-3xl tracking-tight">{BENCH_NAME}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            LLM agents walk procedurally generated mazes with a move tool. They see the full map, the map once, or a 3×3
            fog view.{" "}
            <Link href="/methodology" className="text-foreground underline underline-offset-4">
              Method
            </Link>
          </p>
        </div>
        {preview ? (
          <span className="rounded-md border border-dashed px-2 py-1 font-mono text-[11px] text-muted-foreground">
            preview: smoke runs only
          </span>
        ) : null}
      </header>

      <Charts models={models} />

      <LeaderboardTable rows={rows} />
    </div>
  );
}
