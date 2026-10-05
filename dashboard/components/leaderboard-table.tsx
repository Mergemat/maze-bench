import { TASK_IDS, TASKS } from "@mazebench/core";
import { CiBar } from "@/components/ci-bar";
import { ModelBadge } from "@/components/model-badge";
import type { Row } from "@/lib/data";
import { compact, pct, slug, usd } from "@/lib/format";

export function LeaderboardTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b text-left text-muted-foreground text-xs">
          <tr>
            <th className="px-3 py-2.5 font-normal">Model</th>
            <th className="px-3 py-2.5 font-normal">Completion</th>
            {TASK_IDS.map((t) => (
              <th key={t} className="px-3 py-2.5 text-right font-normal" title={TASKS[t].summary}>
                {TASKS[t].title}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-normal">$ / maze</th>
            <th className="px-3 py-2.5 text-right font-normal">Output tokens / maze</th>
            <th className="px-3 py-2.5 text-right font-normal">Steps / maze</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const baseline = row.subject.kind === "baseline";
            const tied = row.vsLeader && row.vsLeader.lo <= 0 && row.vsLeader.hi >= 0;
            return (
              <tr key={row.subject.key} className={`border-b last:border-0 ${baseline ? "text-muted-foreground" : ""}`}>
                <td className="px-3 py-2.5">
                  <ModelBadge
                    name={row.subject.displayName}
                    avatarSeed={row.subject.key}
                    href={baseline ? undefined : `/model/${slug(row.subject.key)}`}
                    effort={row.subject.reasoningEffort}
                    openWeights={row.subject.openWeights}
                    baseline={baseline}
                  />
                  {tied ? (
                    <span
                      className="ml-7 font-mono text-[10px] text-muted-foreground"
                      title="The paired difference to #1 has a 95% interval that includes zero"
                    >
                      tied with #1
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <CiBar interval={row.composite} tone={baseline ? "grey" : "blue"} />
                </td>
                {TASK_IDS.map((t) => {
                  const ts = row.tasks[t];
                  return (
                    <td key={t} className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {ts && ts.n > 0 ? `${pct(ts.interval.mean, 0)}%` : "–"}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {baseline ? "–" : usd(row.perMaze.costUsd, row.usage.costComplete)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {baseline ? "–" : compact(row.perMaze.outputTokens)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {baseline ? "–" : row.perMaze.steps.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
