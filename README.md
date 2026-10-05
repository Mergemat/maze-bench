# MazeBench

LLM agents walking procedurally generated text mazes. Each run measures **completion**, **cost**, **output tokens** and **agent steps**, across reasoning effort.

Dashboard: https://maze-bench.vercel.app · Design: [docs/design.md](docs/design.md) · Research notes: [docs/research.md](docs/research.md)

> **Name.** Since this repo started (December 2025), three other benchmarks have been published as "MazeBench". The best known is [mazebench.com](https://mazebench.com), a 3D agent world from July 2026. A rename to **TheseusBench** is proposed, after Claude Shannon's 1950 maze-learning mouse. See [docs/research.md](docs/research.md#1-related-benchmarks-and-the-name-collision). The display name is one constant in `packages/core/src/meta.ts`.

## The task

An agent gets a maze and one tool, `move`, which takes a list of moves (`["R", "R", "D"]`). It has to reach the exit within twice as many moves as there are open tiles. The agent can send a whole planned route in one step or feel its way one move at a time, so good planning shows up as fewer steps and fewer tokens.

The only thing that changes between conditions is what the agent sees:

| Condition | What the agent sees | What it stresses |
|---|---|---|
| **Full map** | The whole map, redrawn after every batch | Reading the grid and planning a route |
| **Map once** | The map once at the start, then only whether each move worked | Planning and keeping track of position from memory |
| **Fog** | A 3×3 view after every move, no coordinates | Exploring and remembering where it has been |

Mazes are 7×7, 11×11, 17×17 and 25×25 (fog stops at 11×11 because its long episodes get expensive), with 20 mazes per condition and size: 200 per model and effort setting.

## What is reported

- **Completion**: share of mazes solved, with a 95% bootstrap interval. The headline averages the three conditions equally.
- **Cost per maze**, as reported by OpenRouter, including prompt-cache discounts.
- **Output tokens per maze**, reasoning included.
- **Agent steps per maze** (model calls). Every step resends the conversation, so steps drive input cost.

Each model runs at several reasoning-effort settings, and the dashboard joins them into one line per model.

## Methodology

- **Mazes** come from a seeded depth-first carver with a few extra loops. Start and exit come from the seed and are at least moderately far apart. Every maze is rebuilt from `(suite, condition, size, index)`, and a committed manifest of item hashes fails CI if mazes or prompts change without a suite version bump.
- **Agent loop.** The agent is a standard AI SDK `ToolLoopAgent`, and the full conversation (reasoning included) stays in context. A batch stops at the first wall or at the exit. If the agent stops calling the tool, it gets up to three nudges.
- **Baselines** run on the same mazes: BFS, a random walk, and a right-hand wall follower that needs no map and no memory.
- **Statistics.** Bootstrap intervals over mazes, paired comparison to the leader on shared mazes, and pass@k and pass^k when there are several attempts per maze.
- **Settings.** Models run through OpenRouter. Temperature is left at the provider default, and the serving provider is recorded for every call. API errors are retried and never counted as failures.

## Results

The full sweep has not run yet. Baselines on `core@2.0.0` (`bun run bench report`):

| Baseline | Completion % (95% CI) | Full map | Map once | Fog |
|---|---|---|---|---|
| BFS | 100.0 (100.0–100.0) | 100.0 | 100.0 | 100.0 |
| Wall follower | 95.8 (92.9–98.3) | 95.0 | 95.0 | 97.5 |
| Random walk | 10.8 (6.3–15.8) | 11.3 | 6.3 | 15.0 |

The wall follower solves most mazes within the move budget. Completion alone therefore does not prove planning, which is why steps and tokens sit next to it.

Version 1 results (December 2025) used a different harness and are not comparable. They remain in git history at commit `c55850a`.

## Running it

Requires [Bun](https://bun.com) 1.3+.

```bash
bun install
cp bench/.env.example bench/.env   # add OPENROUTER_API_KEY

bun run bench models                                         # registry with live OpenRouter prices
bun run bench run --model gpt-6-luna --suite smoke           # 10 mazes, one per condition and size
bun run bench run --model claude-sonnet-5.5 --efforts low,medium,high,xhigh   # core, at the efforts the model supports
bun run bench run --sweep --resume                           # every model in the lineup
bun run bench estimate --sweep --efforts low,medium,high,xhigh   # cost estimate from smoke runs
bun run bench report                                         # markdown table
bun run bench validate                                       # schema and item-hash check
```

Results are append-only JSONL files in `results/{suite}@{version}/{model}@{effort}/`. The format is versioned (`schemaVersion: "2.0.0"`).

Checks (the same ones CI runs):

```bash
bun run typecheck && bun run lint && bun run test && bun run bench validate && bun run build
```

### Adding a model

1. Add an entry to `bench/src/models.ts` with the exact OpenRouter slug (prefer dated slugs). For open-weight models set `openWeights: true`. To pin a provider, add `routing: { order: ["provider"], allow_fallbacks: false }`.
2. For a local model (LM Studio or any OpenAI-compatible server), set `LOCAL_BASE_URL` and `LOCAL_MODEL` and use `--model local`.
3. Run `--suite smoke` first, then the core suite at each effort you want on the chart.
4. Commit the results file; the dashboard picks it up on the next build.

## Repository layout

```
packages/core   maze generator, conditions, scoring, statistics, results schema
bench           OpenRouter runner and CLI
dashboard       Next.js site built with dither-kit
results         committed run files
docs            research notes and design
```

## Limitations

- No human baseline yet.
- Text only.
- A simple wall follower solves most mazes, so read completion together with steps and tokens.
- Open-weight models can behave differently depending on which OpenRouter provider serves them.
- The dashboard relaxes two TypeScript flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), because the vendored dither-kit components do not compile under them.

## Citation

```bibtex
@software{omarov2026mazebench,
  author  = {Omarov, Bagautdin},
  title   = {MazeBench: LLM agents in procedurally generated text mazes},
  year    = {2026},
  version = {2.0.0},
  url     = {https://github.com/Mergemat/maze-bench}
}
```

## License

MIT. See [LICENSE](LICENSE). The components in `dashboard/components/dither-kit` come from https://tripwire.sh/dither-kit.
