import { TASK_IDS, TASKS } from "@mazebench/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModelBadge } from "@/components/model-badge";
import { ReplayViewer } from "@/components/replay/replay-viewer";
import { activeSuite, leaderboard, subject } from "@/lib/data";
import { compact, pct, slug, unslug, usd } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return leaderboard()
    .filter((r) => r.subject.kind === "model")
    .map((r) => ({ key: slug(r.subject.key) }));
}

type Params = Promise<{ key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const row = subject(unslug((await params).key));
  return { title: row ? row.subject.displayName : "Not found" };
}

function Big({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className={`font-pixel text-3xl ${accent ? "text-[rgb(150,200,255)]" : ""}`}>{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

/** Solved and attempted mazes for one condition (or all), from per-level counts. */
function counts(levels: { n: number; interval: { mean: number } }[] = []): { solved: number; total: number } {
  return levels.reduce(
    (acc, l) => ({ solved: acc.solved + Math.round(l.interval.mean * l.n), total: acc.total + l.n }),
    { solved: 0, total: 0 },
  );
}

export default async function ModelPage({ params }: { params: Params }) {
  const row = subject(unslug((await params).key));
  if (!row) {
    notFound();
  }
  const { suite } = activeSuite();
  const all = TASK_IDS.map((t) => counts(row.tasks[t]?.levels)).reduce(
    (a, b) => ({ solved: a.solved + b.solved, total: a.total + b.total }),
    { solved: 0, total: 0 },
  );

  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <Link href="/" className="text-muted-foreground text-xs hover:text-foreground">
          ← all models
        </Link>
        <h1 className="text-2xl">
          <ModelBadge
            name={row.subject.displayName}
            avatarSeed={row.subject.key}
            effort={row.subject.reasoningEffort}
            openWeights={row.subject.openWeights}
          />
        </h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Big
            value={`${pct(row.composite?.mean, 0)}%`}
            label={`${all.solved} of ${all.total} mazes solved${row.scored < row.expected ? ` · ${row.expected - row.scored} not finished` : ""}`}
            accent
          />
          <Big value={usd(row.perMaze.costUsd, row.usage.costComplete)} label="cost per task" />
          <Big value={compact(row.perMaze.outputTokens)} label="output tokens per task" />
          <Big value={row.perMaze.steps.toFixed(1)} label="agent steps per task" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {TASK_IDS.map((t) => {
            const ts = row.tasks[t];
            const v = ts && ts.n > 0 ? ts.interval.mean : null;
            const c = counts(ts?.levels);
            return (
              <div key={t} className="rounded-lg border bg-card px-4 py-3" title={TASKS[t].summary}>
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground text-xs">{TASKS[t].title}</span>
                  <span className="font-pixel text-xl">
                    {c.solved}/{c.total}
                    <span className="ml-2 text-muted-foreground text-xs">{v === null ? "–" : `${pct(v, 0)}%`}</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-[rgb(53,143,243)]" style={{ width: `${(v ?? 0) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <section className="space-y-4">
        <h2 className="font-pixel text-xl">Replays</h2>
        <ReplayViewer suiteId={suite.id} subjectKey={row.subject.key} />
      </section>
    </div>
  );
}
