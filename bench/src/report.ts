import { aggregate, type RunFile, type Suite, TASKS } from "@mazebench/core";

const pct = (x: number) => (Number.isFinite(x) ? (100 * x).toFixed(1) : "–");

/** Markdown leaderboard, used for the README table. */
export function markdownLeaderboard(runs: readonly RunFile[], suite: Suite): string {
  const rows = aggregate(runs, suite);
  const tasks = suite.tasks.map((t) => t.task);
  const head = `| # | Model | Completion % (95% CI) | ${tasks.map((t) => TASKS[t].title).join(" | ")} | $ / maze | Output tokens / maze | Steps / maze |`;
  const sep = `|---|---|---|${tasks.map(() => "---").join("|")}|---|---|---|`;
  let rank = 0;
  const lines = rows.map((s) => {
    const c = s.composite;
    const score = c ? `${pct(c.mean)} (${pct(c.lo)}–${pct(c.hi)})` : "partial";
    const baseline = s.subject.kind === "baseline";
    const name = baseline ? `_${s.subject.displayName}_` : s.subject.displayName;
    const cells = tasks.map((t) => {
      const ts = s.tasks[t];
      return ts && ts.n > 0 ? pct(ts.interval.mean) : "–";
    });
    const m = s.perMaze;
    const money = baseline ? "–" : `${s.usage.costComplete ? "" : "≥"}${m.costUsd.toFixed(4)}`;
    const out = baseline ? "–" : Math.round(m.outputTokens).toLocaleString("en");
    const steps = baseline ? "–" : m.steps.toFixed(1);
    return `| ${baseline ? "" : ++rank} | ${name} | ${score} | ${cells.join(" | ")} | ${money} | ${out} | ${steps} |`;
  });
  return [head, sep, ...lines].join("\n");
}
