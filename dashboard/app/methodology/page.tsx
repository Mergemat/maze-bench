import {
  BENCH_NAME,
  buildItem,
  CORE_SUITE,
  enumerateItems,
  getTask,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  TASKS,
  type TaskId,
} from "@mazebench/core";
import type { Metadata } from "next";

export const metadata: Metadata = { title: `Methodology · ${BENCH_NAME}` };

const WHY: Record<TaskId, string> = {
  local:
    "Grid reading on its own. A model that cannot list the legal moves from one tile of a 33×33 maze cannot plan on it either, so the gap between this task and planning shows how much of a planning failure is perception.",
  trace:
    "Mental simulation of a given move list. Moves are numbered so the task tests tracking position, not counting. A quarter of the lists are fully legal, so answering 0 every time scores 25%.",
  plan: "The v1 “initial view” mode, labelled honestly. The model sees the full maze once and writes the whole route. Scored by SPL (success weighted by path length), because a wall follower reaches the goal in most mazes and success alone would reward that.",
  recall:
    "Memory for a stateless model: integrate many partial observations into a map. The model reads a walk with a 3×3 view per step and must return to the start. Walks go around loops, and items are kept only if cancelling back-and-forth moves (pure string manipulation) scores at most 0.7 SPL.",
  fog: "The integrated task and the closest to v1. The model moves with a tool, sees only a 3×3 view, has no coordinates, and gets twice as many moves as there are open tiles. The full history stays in context; there is no scratchpad tool.",
};

function examplePrompt(task: TaskId): string {
  const ref = enumerateItems(CORE_SUITE).find((r) => r.task === task && r.level.level === 1 && r.index === 1);
  if (!ref) {
    return "";
  }
  const t = getTask(task);
  const item = buildItem(ref);
  const p = t.kind === "oneshot" ? t.prompt(item, ref.repr) : t.prompt(item, t.createEnv(item));
  return `[system]\n${p.system}\n\n[user]\n${p.user}`;
}

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 font-pixel text-2xl">
      {children}
    </h2>
  );
}

export default function Methodology() {
  const levels = CORE_SUITE.tasks[0]?.levels ?? [];
  return (
    <article className="max-w-3xl space-y-10 leading-relaxed">
      <header className="space-y-3">
        <h1 className="font-pixel text-4xl">Methodology</h1>
        <p className="text-muted-foreground">
          What {BENCH_NAME} measures, how items are made, how scores and intervals are computed, and what the numbers do
          not tell you. The full design notes and sources are in <code>docs/design.md</code> and{" "}
          <code>docs/research.md</code> in the repository.
        </p>
      </header>

      <section className="space-y-3">
        <H2>What it measures</H2>
        <p>
          Three abilities, each isolated by its own task: <strong>spatial reasoning</strong> (reading a 2D grid from
          text and simulating movement on it), <strong>planning</strong> (writing a correct multi-step route in one go)
          and <strong>memory</strong> (building a map from observations spread over many steps). A fifth task combines
          all three with tool use. The benchmark does not measure visual perception (it is text only) and cannot tell
          whether a model plans like a person; models mostly search step by step in their reasoning tokens.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Mazes</H2>
        <p>
          Each maze is a square grid of {`2n+1`} tiles carved by a seeded depth-first backtracker, then <em>braided</em>
          : each dead end is opened into a neighbour with some probability, which adds loops. Start and goal come from
          the seed; the goal is at or beyond the 60th percentile of distances from the start. In v1 the start was always
          top-left and the goal bottom-right, which made “go down and right” a free heuristic.
        </p>
        <p>
          Walls are <code>#</code> and open floor is <code>.</code> (v1 used spaces, which tokenizers and UIs strip). No
          task asks for coordinates, so indexing mistakes do not leak into scores.
        </p>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 font-normal">Level</th>
                <th className="px-3 py-2 font-normal">Cells</th>
                <th className="px-3 py-2 font-normal">Tiles</th>
                <th className="px-3 py-2 font-normal">Tasks</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {levels.map((l) => (
                <tr key={l.level} className="border-b last:border-0">
                  <td className="px-3 py-2">L{l.level}</td>
                  <td className="px-3 py-2">{l.cells}</td>
                  <td className="px-3 py-2">
                    {2 * l.cells + 1}×{2 * l.cells + 1}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {CORE_SUITE.tasks
                      .filter((t) => t.levels.some((x) => x.level === l.level))
                      .map((t) => t.task)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-8">
        <H2>Tasks</H2>
        {CORE_SUITE.tasks.map((t) => (
          <div key={t.task} id={t.task} className="scroll-mt-20 space-y-3">
            <h3 className="font-medium text-lg">
              {TASKS[t.task].title} <span className="font-mono text-muted-foreground text-sm">{t.task}</span>
            </h3>
            <p className="text-muted-foreground text-sm">
              {TASKS[t.task].ability} · primary metric: {TASKS[t.task].metric} ·{" "}
              {t.levels.reduce((s, l) => s + l.items, 0)} items · braid {t.levels[0]?.braid}
            </p>
            <p>{WHY[t.task]}</p>
            <details className="rounded-lg border bg-card">
              <summary className="cursor-pointer px-4 py-2 text-muted-foreground text-xs">
                Example prompt (level 1)
              </summary>
              <pre className="overflow-x-auto px-4 pb-4 font-mono text-xs leading-relaxed">{examplePrompt(t.task)}</pre>
            </details>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <H2>Answers and failures</H2>
        <p>
          One-shot tasks end with a line <code>ANSWER: …</code>. The parser takes the last such line, falls back to the
          last non-empty line (marked <em>fallback</em>), and otherwise records a <em>parse failure</em> that scores 0.
          Parse failures, truncation at the token limit, invalid moves, wrong answers, stalls and exhausted budgets are
          reported separately. API failures (rate limits, 5xx, timeouts) are retried with backoff and, if they persist,
          stored as errors that are never scored and can be resumed.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Statistics</H2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Task score: mean over items; with several attempts per item, attempts are averaged within the item first.
          </li>
          <li>
            95% intervals: percentile bootstrap with 2,000 resamples over items (clusters), seeded for reproducibility.
          </li>
          <li>Composite: unweighted mean of the five task scores, with a bootstrap stratified by task.</li>
          <li>
            Comparisons: paired differences over shared items. “≈ #1” on the leaderboard means the paired interval to
            the leader includes zero.
          </li>
          <li>Per-level scores use Wilson intervals for binary scores; with 20 items per level they are wide.</li>
          <li>
            pass@k and pass^k use the unbiased estimators and appear when a model has k or more attempts per item.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2>Baselines</H2>
        <p>
          Three programs run on the same items through the same scorer. <strong>Oracle</strong> (BFS) must score 100% on
          every task; a test in CI enforces it. <strong>Random</strong> answers at random or walks randomly.{" "}
          <strong>Heuristic</strong> is the strongest strategy that needs no reasoning about the maze: “U, D” for legal
          moves, 0 for path checks, a right-hand wall follower for planning and fog, and free reduction of the reversed
          walk for recall. A model near the heuristic row has not shown the ability the task targets.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Model settings and reproducibility</H2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Every leaderboard entry is a (model, reasoning effort) pair. Effort uses OpenRouter's unified setting.
          </li>
          <li>
            Temperature is left at the provider default. Newer Claude and GPT models ignore or reject it, so variance is
            handled with repeated attempts instead.
          </li>
          <li>Output is capped at 32,000 tokens per call; hitting the cap is recorded as truncation.</li>
          <li>
            Each call records which provider served it. Open-weight models require providers that honour every
            parameter.
          </li>
          <li>
            Items are regenerated from <code>(suite, task, level, index)</code>. A committed manifest of item hashes
            fails CI if generation or prompts change without a suite version bump. Prompt version {PROMPT_VERSION},
            results schema {SCHEMA_VERSION}.
          </li>
          <li>
            A held-out split uses a private salt. A gap between public and held-out scores would point to contamination.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2>Limitations</H2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>No human baseline yet.</li>
          <li>Text only. Image input is out of scope for v2.</li>
          <li>
            Fog stops at level 2 in the core suite. Its context grows with the square of episode length; a level-3
            episode used 4.75M input tokens in calibration.
          </li>
          <li>
            One prompt template per task. Format sensitivity is measured only through the adjacency-list ablation.
          </li>
          <li>
            OpenRouter routing and provider quantization can change results for open-weight models between runs, even
            with the same model id.
          </li>
          <li>
            Results from the v1 harness (December 2025) are not comparable and are not shown. They remain in the git
            history.
          </li>
        </ul>
      </section>
    </article>
  );
}
