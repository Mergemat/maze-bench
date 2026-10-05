import { aggregate, type RunFile, type SubjectSummary, type Suite } from "@mazebench/core";

const pct = (x: number) => (Number.isFinite(x) ? (100 * x).toFixed(1) : "–");

function cell(s: SubjectSummary, task: string): string {
  const t = s.tasks[task as keyof typeof s.tasks];
  return t && t.n > 0 ? pct(t.interval.mean) : "–";
}

/** Markdown leaderboard, used for the README table. */
export function markdownLeaderboard(runs: readonly RunFile[], suite: Suite): string {
  const rows = aggregate(runs, suite);
  const tasks = suite.tasks.map((t) => t.task);
  const head = `| # | Model | Score (95% CI) | ${tasks.join(" | ")} | Cost (USD) | Items |`;
  const sep = `|---|---|---|${tasks.map(() => "---").join("|")}|---|---|`;
  let rank = 0;
  const lines = rows.map((s) => {
    const c = s.composite;
    const score = c ? `${pct(c.mean)} (${pct(c.lo)}–${pct(c.hi)})` : "partial";
    const cost =
      s.subject.kind === "baseline" ? "–" : `${s.usage.costComplete ? "" : "≥"}${s.usage.costUsd.toFixed(2)}`;
    const name = s.subject.kind === "baseline" ? `_${s.subject.displayName}_` : s.subject.displayName;
    const position = s.subject.kind === "baseline" ? "" : String(++rank);
    return `| ${position} | ${name} | ${score} | ${tasks.map((t) => cell(s, t)).join(" | ")} | ${cost} | ${s.scored}/${s.expected} |`;
  });
  return [head, sep, ...lines].join("\n");
}
