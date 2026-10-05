import { BENCH_NAME, getSuite, TASKS } from "@mazebench/core";
import Link from "next/link";
import { CostScatter, type ScatterPoint } from "@/components/cost-scatter";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { type CurveModel, type CurveTask, LevelCurves } from "@/components/level-curves";
import { leaderboard, suites } from "@/lib/data";
import { slug } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 font-pixel text-2xl">{value}</div>
    </div>
  );
}

export function SuiteView({ suiteId }: { suiteId: string }) {
  const suite = getSuite(suiteId);
  const rows = leaderboard(suiteId);
  const all = suites();
  const info = all.find((s) => s.id === suiteId);
  const models = rows.filter((r) => r.subject.kind === "model");
  const heuristic = rows.find((r) => r.subject.key === "baseline-heuristic");

  const points: ScatterPoint[] = models
    .filter((r) => r.composite && r.usage.costComplete)
    .map((r) => ({
      key: r.subject.key,
      name: r.subject.displayName,
      href: `/suite/${suiteId}/${slug(r.subject.key)}`,
      cost: r.usage.costUsd,
      score: r.composite?.mean ?? 0,
      lo: r.composite?.lo ?? 0,
      hi: r.composite?.hi ?? 0,
      openWeights: r.subject.openWeights,
    }));

  const curveTasks: CurveTask[] = suite.tasks.map((t) => ({
    id: t.task,
    title: TASKS[t.task].title,
    metric: TASKS[t.task].metric,
    levels: t.levels.map((l) => l.level),
    heuristic: Object.fromEntries((heuristic?.tasks[t.task]?.levels ?? []).map((l) => [l.level, l.interval.mean])),
  }));
  const curveModels: CurveModel[] = models.map((r) => ({
    key: r.subject.key,
    name: r.subject.displayName,
    levels: Object.fromEntries(
      Object.entries(r.tasks).map(([task, t]) => [
        task,
        Object.fromEntries((t?.levels ?? []).map((l) => [l.level, l.interval.mean])),
      ]),
    ),
  }));

  return (
    <div className="space-y-14">
      <section className="space-y-5">
        <h1 className="max-w-3xl font-pixel text-4xl leading-tight tracking-tight sm:text-5xl">
          Can a language model find its way through a maze?
        </h1>
        <p className="max-w-3xl text-muted-foreground leading-relaxed">
          {BENCH_NAME} splits maze solving into five tasks that each target one ability: reading the grid, simulating a
          path, planning a route in one go, remembering a walk well enough to retrace it, and navigating with a 3×3 view
          and a move tool. Every maze comes from a seed, every score has a 95% bootstrap interval, and trivial baselines
          sit in the same table.{" "}
          <Link href="/methodology" className="text-foreground underline underline-offset-4">
            How it works →
          </Link>
        </p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {all.map((s) => (
            <Link
              key={s.id}
              href={s.id === "core" ? "/" : `/suite/${s.id}`}
              className={`rounded-md border px-2.5 py-1 font-mono ${s.id === suiteId ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s.key}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Models" value={info?.models ?? 0} />
          <Stat label="Items per model" value={info?.items ?? 0} />
          <Stat label="Tasks" value={suite.tasks.length} />
          <Stat label="Last run" value={info?.lastRun ? info.lastRun.slice(0, 10) : "–"} />
        </div>
        {suite.id !== "core" ? (
          <p className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-sm">
            {suite.description} Scores here are not comparable with the core leaderboard.
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-pixel text-2xl">Leaderboard</h2>
        {models.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-sm">
            No model has been run on {suite.id}@{suite.version} yet. The baselines below show the floor and the oracle
            ceiling.
          </p>
        ) : null}
        <LeaderboardTable rows={rows} suiteId={suiteId} />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Score is the unweighted mean of the five task scores. Intervals are 95% stratified bootstrap over items. “≈
          #1” means the paired difference to the leader has an interval that includes zero. Cost is what OpenRouter
          reported, including prompt-cache discounts. Items shows scored attempts out of planned ones; API failures are
          retried and never scored as zero.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-pixel text-2xl">Score vs cost</h2>
        <div className="rounded-lg border bg-card p-4">
          <CostScatter points={points} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-pixel text-2xl">Difficulty curves</h2>
        <LevelCurves tasks={curveTasks} models={curveModels} />
      </section>
    </div>
  );
}
