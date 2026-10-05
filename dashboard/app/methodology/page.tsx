import {
  BENCH_NAME,
  buildItem,
  CORE_SUITE,
  enumerateItems,
  getTask,
  type MazeItem,
  sizeLabel,
  TASKS,
  type TaskId,
} from "@mazebench/core";
import type { Metadata } from "next";

export const metadata: Metadata = { title: `Method · ${BENCH_NAME}` };

function examplePrompt(task: TaskId): string {
  const ref = enumerateItems(CORE_SUITE).find((r) => r.task === task && r.level.level === 1 && r.index === 1);
  if (!ref) {
    return "";
  }
  const t = getTask(task);
  const item = buildItem(ref) as MazeItem;
  const p = t.prompt(item, t.createEnv(item));
  return `[system]\n${p.system}\n\n[user]\n${p.user}`;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-pixel text-xl">{children}</h2>;
}

export default function Method() {
  return (
    <article className="max-w-3xl space-y-10 leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-pixel text-3xl">Method</h1>
        <p className="text-muted-foreground">
          An LLM agent gets a maze and a <code>move</code> tool, and has to reach the exit. That's the whole task. What
          changes is what the agent can see.
        </p>
      </header>

      <section className="space-y-4">
        <H2>Three conditions</H2>
        {(Object.keys(TASKS) as TaskId[]).map((t) => (
          <div key={t} className="space-y-2">
            <p>
              <span className="font-medium">{TASKS[t].title}.</span>{" "}
              <span className="text-muted-foreground">{TASKS[t].summary}</span>
            </p>
            <details className="rounded-lg border bg-card">
              <summary className="cursor-pointer px-4 py-2 text-muted-foreground text-xs">Prompt on a 7×7 maze</summary>
              <pre className="overflow-x-auto px-4 pb-4 font-mono text-xs leading-relaxed">{examplePrompt(t)}</pre>
            </details>
          </div>
        ))}
        <p className="text-muted-foreground text-sm">
          The tool takes a list of moves, so the agent can plan a whole route in one step or feel its way one move at a
          time. Planning shows up as fewer steps. A batch stops at the first wall or at the exit. The agent gets twice
          as many moves as there are open tiles.
        </p>
      </section>

      <section className="space-y-3">
        <H2>What is measured</H2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Completion</strong>: share of mazes where the agent reached the exit. The headline number averages
            the three conditions equally.
          </li>
          <li>
            <strong>Cost</strong> per maze, as reported by OpenRouter, including prompt-cache discounts.
          </li>
          <li>
            <strong>Output tokens</strong> per maze, reasoning included.
          </li>
          <li>
            <strong>Agent steps</strong> per maze: model calls. Every step resends the conversation, so steps drive
            input cost.
          </li>
        </ul>
        <p className="text-muted-foreground text-sm">
          Each model is run at several reasoning-effort settings; the chart joins them into one line per model.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Mazes</H2>
        <p>
          Generated from a seed by a depth-first carver with a few extra loops. Start and exit are drawn from the seed
          and at least moderately far apart. Sizes:{" "}
          {CORE_SUITE.tasks
            .map((t) => `${TASKS[t.task].title} ${t.levels.map((l) => sizeLabel(l)).join(", ")}`)
            .join("; ")}
          . 20 mazes per condition and size. Fog stops at 11×11 because its long episodes get expensive.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Rigor</H2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>95% bootstrap intervals on every completion rate; models are compared on the same mazes.</li>
          <li>
            Baselines on the same mazes: BFS (always 100%), a random walk, and a right-hand wall follower that needs no
            map and no memory.
          </li>
          <li>API errors are retried and never counted as failures.</li>
          <li>Temperature is left at the provider default; the serving provider is recorded for every call.</li>
          <li>Item hashes are pinned in the repo, so any change to mazes or prompts needs a new suite version.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2>Limits</H2>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>No human baseline yet.</li>
          <li>Text only.</li>
          <li>The wall follower solves most mazes within the budget, so completion alone does not prove planning.</li>
          <li>Open-weight models can behave differently depending on which provider serves them.</li>
        </ul>
      </section>
    </article>
  );
}
