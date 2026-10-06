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

/** The prompt of the first maze in the condition's smallest size. */
function examplePrompt(task: TaskId): { size: string; text: string } | null {
  const ref = enumerateItems(CORE_SUITE).find((r) => r.task === task && r.index === 1);
  if (!ref) {
    return null;
  }
  const t = getTask(task);
  const item = buildItem(ref) as MazeItem;
  const p = t.prompt(item, t.createEnv(item));
  return { size: sizeLabel(ref.level), text: `[system]\n${p.system}\n\n[user]\n${p.user}` };
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
        {(Object.keys(TASKS) as TaskId[]).map((t) => {
          const example = examplePrompt(t);
          return (
            <div key={t} className="space-y-2">
              <p>
                <span className="font-medium">{TASKS[t].title}.</span>{" "}
                <span className="text-muted-foreground">{TASKS[t].summary}</span>
              </p>
              {example ? (
                <details className="rounded-lg border bg-card">
                  <summary className="cursor-pointer px-4 py-2 text-muted-foreground text-xs">
                    Prompt on a {example.size} maze
                  </summary>
                  <pre className="overflow-x-auto px-4 pb-4 font-mono text-xs leading-tight">{example.text}</pre>
                </details>
              ) : null}
            </div>
          );
        })}
        <p className="text-muted-foreground text-sm">
          The tool takes a list of moves, so the agent can plan a whole route in one step or feel its way one move at a
          time. Planning shows up as fewer steps. A batch stops at the first wall or at the exit. There is no move
          limit: the agent succeeds by reaching the exit and fails by stopping before it.
        </p>
      </section>

      <section className="space-y-3">
        <H2>What is measured</H2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Completion</strong>: mazes where the agent reached the exit, out of mazes scored.
          </li>
          <li>
            <strong>Cost</strong> per task, as reported by OpenRouter, including prompt-cache discounts.
          </li>
          <li>
            <strong>Output tokens</strong> per task, reasoning included.
          </li>
          <li>
            <strong>Agent steps</strong> per task: model calls. Every step resends the conversation, so steps drive
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
          Generated from a seed with Wilson's algorithm, which draws a uniformly random perfect maze: many short
          branches and dead ends, one route between any two tiles. Start and exit are drawn from the seed and at least
          moderately far apart. Sizes:{" "}
          {CORE_SUITE.tasks
            .map((t) => `${TASKS[t.task].title} ${t.levels.map((l) => sizeLabel(l)).join(", ")}`)
            .join("; ")}
          . 9 mazes per condition and size. Sides are odd because walls sit between cells.
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
          <li>
            With no move limit, even the random walk reaches every exit eventually, so steps, tokens and cost show how
            well a model planned.
          </li>
          <li>Open-weight models can behave differently depending on which provider serves them.</li>
        </ul>
      </section>
    </article>
  );
}
