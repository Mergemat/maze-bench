import { getSuite, TASKS } from "@mazebench/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CiBar } from "@/components/ci-bar";
import { ModelBadge } from "@/components/model-badge";
import { ReplayViewer } from "@/components/replay/replay-viewer";
import { TaskRadar } from "@/components/task-radar";
import { leaderboard, subject, suites } from "@/lib/data";
import { compact, pct, seconds, slug, unslug, usd } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return suites().flatMap((s) => leaderboard(s.id).map((r) => ({ suite: s.id, model: slug(r.subject.key) })));
}

type Params = Promise<{ suite: string; model: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { suite, model } = await params;
  const row = subject(suite, unslug(model));
  return { title: row ? `${row.subject.displayName} · ${suite}` : "Not found" };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm">{children}</dd>
    </div>
  );
}

export default async function ModelPage({ params }: { params: Params }) {
  const { suite: suiteId, model } = await params;
  const key = unslug(model);
  const row = subject(suiteId, key);
  if (!row) {
    notFound();
  }
  const suite = getSuite(suiteId);
  const leader = leaderboard(suiteId).find((r) => r.rank === 1);
  const compare = leader && leader.subject.key !== row.subject.key ? leader : undefined;
  const isBaseline = row.subject.kind === "baseline";

  const radar = suite.tasks.map((t) => ({
    task: TASKS[t.task].title,
    subject: Math.round(1000 * (row.tasks[t.task]?.interval.mean ?? 0)) / 10,
    ...(compare ? { compare: Math.round(1000 * (compare.tasks[t.task]?.interval.mean ?? 0)) / 10 } : {}),
  }));

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <Link
          href={suiteId === "core" ? "/" : `/suite/${suiteId}`}
          className="text-muted-foreground text-xs hover:text-foreground"
        >
          ← {suite.id}@{suite.version}
        </Link>
        <h1 className="font-pixel text-3xl">
          <ModelBadge
            name={row.subject.displayName}
            avatarSeed={row.subject.key}
            effort={row.subject.reasoningEffort}
            openWeights={row.subject.openWeights}
            baseline={isBaseline}
          />
        </h1>
        <div className="flex flex-wrap items-center gap-6">
          <CiBar interval={row.composite} width={220} tone={isBaseline ? "grey" : "blue"} />
          {row.rank ? <span className="text-muted-foreground text-sm">Rank {row.rank}</span> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-card p-5 sm:grid-cols-4">
          <Fact label="Model id">{row.subject.modelId}</Fact>
          <Fact label="Reasoning effort">{row.subject.reasoningEffort}</Fact>
          <Fact label="Scored / planned">
            {row.scored}/{row.expected}
            {row.errors > 0 ? ` (${row.errors} API errors)` : ""}
          </Fact>
          <Fact label="Total cost">{isBaseline ? "–" : usd(row.usage.costUsd, row.usage.costComplete)}</Fact>
          <Fact label="Tokens in / out">
            {compact(row.usage.inputTokens)} / {compact(row.usage.outputTokens)}
          </Fact>
          <Fact label="Reasoning tokens">{compact(row.usage.reasoningTokens)}</Fact>
          <Fact label="Model calls">{compact(row.usage.calls)}</Fact>
          <Fact label="Mean time per item">{seconds(row.usage.meanLatencyMs)}</Fact>
          <Fact label="Served by">
            {Object.keys(row.providers).length > 0
              ? Object.entries(row.providers)
                  .sort((a, b) => b[1] - a[1])
                  .map(([p, n]) => `${p} (${n})`)
                  .join(", ")
              : "–"}
          </Fact>
          <Fact label="Runs">{row.runIds.length}</Fact>
          <Fact label="Epochs">{row.epochs}</Fact>
          <Fact label="Open weights">{row.subject.openWeights ? "yes" : "no"}</Fact>
        </dl>
      </div>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="h-80 rounded-lg border bg-card p-3">
          <TaskRadar
            data={radar}
            subjectName={row.subject.displayName}
            {...(compare ? { compareName: compare.subject.displayName } : {})}
          />
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 font-normal">Task</th>
                <th className="px-3 py-2 font-normal">Score · 95% CI</th>
                {[1, 2, 3, 4, 5].map((l) => (
                  <th key={l} className="px-2 py-2 text-right font-normal">
                    L{l}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-normal" title="Replies with no parseable answer">
                  Format fails
                </th>
              </tr>
            </thead>
            <tbody>
              {suite.tasks.map((t) => {
                const s = row.tasks[t.task];
                const failed = s ? s.parse.failed : 0;
                return (
                  <tr key={t.task} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {TASKS[t.task].title}
                      <span className="block text-[10px] text-muted-foreground">{TASKS[t.task].metric}</span>
                    </td>
                    <td className="px-3 py-2">
                      <CiBar
                        interval={s && s.n > 0 ? s.interval : null}
                        width={100}
                        tone={isBaseline ? "grey" : "blue"}
                      />
                    </td>
                    {[1, 2, 3, 4, 5].map((l) => {
                      const lv = s?.levels.find((x) => x.level === l);
                      return (
                        <td
                          key={l}
                          className="px-2 py-2 text-right font-mono text-xs tabular-nums"
                          title={lv ? `n=${lv.n}, 95% CI ${pct(lv.interval.lo)}–${pct(lv.interval.hi)}` : undefined}
                        >
                          {lv ? pct(lv.interval.mean, 0) : "–"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {s && s.n > 0 ? `${failed}/${s.n}` : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="space-y-1 border-t px-3 py-3 text-muted-foreground text-xs">
            {suite.tasks.map((t) => {
              const s = row.tasks[t.task];
              if (!s || s.n === 0) {
                return null;
              }
              const outcomes = Object.entries(s.outcomes)
                .sort((a, b) => b[1] - a[1])
                .map(([o, n]) => `${o.replace(/_/g, " ")} ${n}`)
                .join(" · ");
              return (
                <p key={t.task}>
                  <span className="text-foreground">{TASKS[t.task].title}:</span> {outcomes}
                  {Object.keys(s.passHat).length > 0
                    ? ` · pass^k ${Object.entries(s.passHat)
                        .map(([k, v]) => `${k}: ${pct(v, 0)}`)
                        .join(", ")}`
                    : ""}
                </p>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-pixel text-2xl">Replays</h2>
        <p className="max-w-3xl text-muted-foreground text-sm">
          Every maze is rebuilt in your browser from its seed, so what you see is exactly what the model was given.
        </p>
        <ReplayViewer suiteId={suiteId} subjectKey={row.subject.key} />
      </section>
    </div>
  );
}
