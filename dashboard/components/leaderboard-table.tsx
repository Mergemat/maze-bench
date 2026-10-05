import { getSuite, TASKS, type TaskId } from "@mazebench/core";
import Link from "next/link";
import { CiBar } from "@/components/ci-bar";
import { ModelBadge } from "@/components/model-badge";
import type { Row } from "@/lib/data";
import { compact, pct, slug, usd } from "@/lib/format";

function TaskCell({ row, task }: { row: Row; task: TaskId }) {
  const t = row.tasks[task];
  if (!t || t.n === 0) {
    return <td className="px-3 py-3 text-right text-muted-foreground">–</td>;
  }
  const { mean, lo, hi } = t.interval;
  return (
    <td className="px-3 py-3 text-right font-mono tabular-nums" title={`95% CI ${pct(lo)}–${pct(hi)} · n=${t.n}`}>
      {pct(mean)}
      <span className="block text-[10px] text-muted-foreground">±{pct((hi - lo) / 2, 0)}</span>
    </td>
  );
}

function Delta({ row }: { row: Row }) {
  if (row.rank === 1) {
    return <span className="font-mono text-[10px] text-muted-foreground">leader</span>;
  }
  const d = row.vsLeader;
  if (!d) {
    return null;
  }
  const tied = d.lo <= 0 && d.hi >= 0;
  return (
    <span
      className="font-mono text-[10px] text-muted-foreground"
      title={`Paired difference to #1 over ${d.n} shared items, 95% CI ${pct(d.lo)} to ${pct(d.hi)}`}
    >
      {tied ? "≈ #1" : `${pct(d.mean)} vs #1`}
    </span>
  );
}

export function LeaderboardTable({ rows, suiteId }: { rows: Row[]; suiteId: string }) {
  const suite = getSuite(suiteId);
  const tasks = suite.tasks.map((t) => t.task);
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b text-left text-muted-foreground text-xs">
          <tr>
            <th className="px-3 py-3 font-normal">#</th>
            <th className="px-3 py-3 font-normal">Model</th>
            <th className="px-3 py-3 font-normal">Score · 95% CI</th>
            {tasks.map((t) => (
              <th key={t} className="px-3 py-3 text-right font-normal">
                <Link href={`/methodology#${t}`} className="hover:text-foreground" title={TASKS[t].summary}>
                  {TASKS[t].title}
                  <span className="block text-[10px] opacity-70">{TASKS[t].ability}</span>
                </Link>
              </th>
            ))}
            <th className="px-3 py-3 text-right font-normal">Cost</th>
            <th
              className="px-3 py-3 text-right font-normal"
              title="Output tokens per scored attempt, including reasoning"
            >
              Out tok/item
            </th>
            <th className="px-3 py-3 text-right font-normal">Items</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const baseline = row.subject.kind === "baseline";
            return (
              <tr key={row.subject.key} className={`border-b last:border-0 ${baseline ? "bg-muted/30" : ""}`}>
                <td className="px-3 py-3 font-mono text-muted-foreground tabular-nums">{row.rank ?? "·"}</td>
                <td className="px-3 py-3">
                  <ModelBadge
                    name={row.subject.displayName}
                    avatarSeed={row.subject.key}
                    href={`/suite/${suiteId}/${slug(row.subject.key)}`}
                    effort={row.subject.reasoningEffort}
                    openWeights={row.subject.openWeights}
                    baseline={baseline}
                  />
                  <Delta row={row} />
                </td>
                <td className="px-3 py-3">
                  <CiBar interval={row.composite} tone={baseline ? "grey" : "blue"} />
                </td>
                {tasks.map((t) => (
                  <TaskCell key={t} row={row} task={t} />
                ))}
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {baseline ? "–" : usd(row.usage.costUsd, row.usage.costComplete)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {baseline || row.scored === 0 ? "–" : compact(row.usage.outputTokens / row.scored)}
                </td>
                <td
                  className={`px-3 py-3 text-right font-mono tabular-nums ${row.scored < row.expected * 0.95 ? "text-[rgb(255,195,130)]" : "text-muted-foreground"}`}
                  title={
                    row.errors > 0 ? `${row.errors} attempt(s) failed on the API side and are not scored` : undefined
                  }
                >
                  {row.scored}/{row.expected}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
