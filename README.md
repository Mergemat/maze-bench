# MazeBench

A procedurally generated benchmark for **spatial reasoning, memory and planning** in language models, using text mazes.

Dashboard: https://maze-bench.vercel.app · Design: [docs/design.md](docs/design.md) · Research notes: [docs/research.md](docs/research.md)

> **Name.** Since this repo started (December 2025), three other benchmarks have been published as "MazeBench". The best known is [mazebench.com](https://mazebench.com), a 3D agent world from July 2026. A rename to **TheseusBench** is proposed, after Claude Shannon's 1950 maze-learning mouse. See [docs/research.md](docs/research.md#1-related-benchmarks-and-the-name-collision). The display name is one constant in `packages/core/src/meta.ts`.

## What it measures

Maze solving looks like one skill but fails in several separate ways. A model can misread the grid, lose track of where it is, plan a route badly, or forget what it has already seen. Version 1 of this repo scored all of that as one success rate, and its README said honestly that it was not sure what it measured. Version 2 splits the score into five tasks, each aimed at one ability:

| Task | Ability | What the model does | Primary metric |
|---|---|---|---|
| `local`: legal moves | Spatial perception | Sees the full maze with `@` on one tile and lists the directions it can move | Exact-match accuracy |
| `trace`: path check | Spatial simulation | Gets a numbered move list from `S` and names the first move that walks into a wall (or 0) | Exact-match accuracy |
| `plan`: one-shot route | Planning | Sees the maze once and writes the whole route from `S` to `G` | SPL |
| `recall`: route memory | Memory | Reads a walk through an unseen maze, one 3×3 view per step, then returns to the start | SPL |
| `fog`: fog navigation | All three, with tool use | Moves with a `move` tool, sees only a 3×3 view, has no coordinates, and must find `G` | Success rate |

SPL is success weighted by path length (`optimal / max(taken, optimal)`, Anderson et al. 2018). The composite score is the unweighted mean of the five task scores.

The benchmark does not measure visual perception (it is text only), and it cannot tell whether a model plans the way a person does. Models mostly search step by step in their reasoning tokens.

## Methodology

- **Items.** Mazes come from a seeded depth-first carver with optional braiding (extra loops). Start and goal positions come from the seed, not fixed corners. Each item is addressed by `(suite, task, level, index)` and rebuilt on demand. A committed manifest of item hashes fails CI if generation or prompts change without a suite version bump.
- **Difficulty.** Five levels from 7×7 to 33×33 tiles. Fog uses levels 1–2 only, because its context grows with the square of episode length. When the top level saturates, the next suite version adds a larger level.
- **Suite `core@2.0.0`.** 440 items: 100 each for `local`, `trace`, `plan` and `recall`, plus 40 for `fog`.
- **Answers.** One-shot tasks end with `ANSWER: …`. Parse failures, truncation, invalid moves, stalls and exhausted budgets are scored 0 but labelled separately. API failures are retried and never scored. They are stored as errors and can be resumed.
- **Statistics.** 95% intervals come from a percentile bootstrap over items (2,000 resamples, clustered by item when there are several attempts). The composite interval uses a bootstrap stratified by task. Models are compared on paired differences over shared items. pass@k and pass^k use the unbiased estimators.
- **Baselines.** Oracle (BFS, must score 100%, enforced in tests), random, and a no-reasoning heuristic per task (wall follower, constant answers, free reduction of the walk). They share the table with the models.
- **Model settings.** Each entry is a (model, reasoning effort) pair, run through OpenRouter. Temperature is left at the provider default, because newer Claude and GPT models ignore it. Output is capped at 32k tokens per call. The serving provider and the reported cost are stored for every call. Anthropic models use prompt caching.
- **Contamination.** Everything is procedural. A held-out split uses a private salt (`MAZEBENCH_HOLDOUT_SALT`) and writes to a gitignored folder.

The [methodology page](https://maze-bench.vercel.app/methodology) shows the exact prompt for every task.

## Results

`core@2.0.0` has not been swept yet; see "Status" below. These are the baselines, from `bun run bench report`:

| # | Model | Score (95% CI) | local | trace | plan | recall | fog |
|---|---|---|---|---|---|---|---|
| | _Oracle (BFS)_ | 100.0 (100.0–100.0) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| | _Heuristic_ | 46.2 (43.3–49.0) | 17.0 | 25.0 | 52.3 | 39.0 | 97.5 |
| | _Random_ | 6.4 (3.9–9.1) | 12.0 | 3.0 | 0.0 | 2.0 | 15.0 |

The fog heuristic is a right-hand wall follower. Within a budget of twice the open tiles it almost always finds the goal, so a model below that row on fog has done worse than a ten-line program.

Calibration runs (one item per task and level) on cheap models are in `results/calib@2.0.0/`. GPT-6 Luna solved every `local` and `recall` item up to 33×33. It failed `plan` from level 3 up, and its level-4 attempt hit the 32k output cap. It exhausted the fog budget on every level, walking in circles while reporting that it had explored everything.

### Status

The harness, tasks, dashboard and calibration are done. The full sweep is waiting on a budget decision; `bun run bench estimate --sweep` prints the current estimate.

### Version 1 results

Results from the v1 harness (December 2025: gpt-5, gpt-5-mini, gpt-5.2, gemini-3-flash, deepseek-v3.1, grok-4.1-fast, gpt-oss-120b) are **not comparable** and have been dropped from the tree. v1 had fixed corner start and goal, spaces for open tiles, and an "initial view" mode that kept the maze in context the whole time. The files remain in git history at commit `c55850a` under `bench/src/bench/results/`.

## Running it

Requires [Bun](https://bun.com) 1.3+.

```bash
bun install
cp bench/.env.example bench/.env   # add OPENROUTER_API_KEY

bun run bench models                                   # registry with live OpenRouter prices
bun run bench run --model gpt-6-luna --suite smoke     # 18 attempts, about $0.02
bun run bench run --model claude-sonnet-5.5 --effort high --tasks plan,recall --levels 1,2,3
bun run bench run --sweep --resume                     # the full lineup on core; skips finished items
bun run bench estimate --sweep                         # cost estimate from calibration runs
bun run bench baselines --suite core                   # regenerate baseline results
bun run bench report                                   # markdown leaderboard
bun run bench validate                                 # schema and item-hash check for every results file
```

Results are append-only JSONL files in `results/{suite}@{version}/{model}@{effort}/`, one per run. The format is versioned (`schemaVersion: "2.0.0"`) and defined as Zod schemas in `packages/core/src/schema.ts`.

Dashboard:

```bash
bun run build          # static Next.js build of dashboard/ from results/
```

Checks (the same ones CI runs):

```bash
bun run typecheck && bun run lint && bun run test && bun run bench validate && bun run build
```

### Adding a model

1. Add an entry to `bench/src/models.ts` with the exact OpenRouter slug (prefer dated slugs such as `-0813`). Set `openWeights: true` for open-weight models; this also requires providers that honour every request parameter. To pin a provider, add `routing: { order: ["provider"], allow_fallbacks: false }`.
2. For a local model, set `LOCAL_BASE_URL` and `LOCAL_MODEL` and run `--model local`. Any OpenAI-compatible server works (LM Studio by default).
3. Run `bun run bench run --model <id> --suite smoke` first, then `--suite core`.
4. Commit the results file. The dashboard picks it up on the next build.

## Repository layout

```
packages/core   maze generator, tasks, prompts, scoring, statistics, results schema (shared by both apps)
bench           OpenRouter runner and CLI
dashboard       Next.js results site (dither-kit charts, maze replays)
results         committed run files
docs            research notes and design spec
```

## Limitations

- No human baseline yet.
- Text only. The [visual MazeBench](https://arxiv.org/abs/2603.26839) covers images.
- One prompt template per task. Format sensitivity is measured only through the adjacency-list ablation suite (`repr`).
- Fog stops at 11×11 for cost, and its heuristic baseline is strong.
- With 20 items per level, per-level intervals are wide. The per-task and composite numbers are the ones to compare.
- Open-weight models can behave differently depending on which OpenRouter provider serves them. Each call's provider is recorded, but routing is not pinned by default.
- The dashboard type-checks with two strictness flags relaxed (`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`), because the vendored dither-kit components do not compile under them.

## Citation

```bibtex
@software{omarov2026mazebench,
  author  = {Omarov, Bagautdin},
  title   = {MazeBench: spatial reasoning, memory and planning in text mazes},
  year    = {2026},
  version = {2.0.0},
  url     = {https://github.com/Mergemat/maze-bench}
}
```

## License

MIT. See [LICENSE](LICENSE). The dither-kit components in `dashboard/components/dither-kit` come from https://tripwire.sh/dither-kit.
