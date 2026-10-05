# Research notes for the v2 rebuild

Written 2026-10-05, before any v2 code. Sources are linked inline and collected at the end. Model IDs and prices come from the live OpenRouter catalogue (`GET https://openrouter.ai/api/v1/models`) on the same date.

## 1. Related benchmarks and the name collision

### There are now at least three other "MazeBench"s

This repo started in December 2025. Since then the name has been taken three times over, and two of the newcomers are better known than this project.

| Name | Who / when | What it measures | Method | Weaknesses |
|---|---|---|---|---|
| **MazeBench (mazebench.com)** | Jonathan and David Pappas, launched 2026-07-28, sponsored by Prime Intellect's residency | Long-horizon 3D spatial reasoning and planning for agents | A hand-built 3D world with 200+ rooms, 100 hidden gems and Sokoban-style box puzzles. Agents play through 11 MCP actions (move, rotate camera, undo, reset, teleport) inside their native harnesses (Codex, Claude Code). Vision, ASCII and JSON observation tracks, with and without Python. Score is gems collected (1 gem = 1%). | One environment, so n is effectively 1 per run and there are no confidence intervals. Runs cost thousands of dollars ($3,238 to $14,198 per frontier run on the July board). Results depend on the harness (Codex vs Claude Code), not only the model. Hand-made puzzles are fixed and public. With Python, models write A* solvers, so the score partly measures coding. |
| **MazeBench (Rodriguez Salgado)** | arXiv 2603.26839, March 2026, data on Hugging Face | Whether multimodal models plan visually or brute-force in token space | 110 procedurally generated maze *images* (5x5 to 20x20) in nine controlled groups. One prompt, no tools. The model returns JSON with reachability, shortest-path length and the exact path. Solved only if all three are right. | Single-shot only, no interaction or memory. 110 items with no error bars. Conflates image-to-grid transcription with search (their own text-grid ablation moves Claude Sonnet 4.6 from 6% to 80%). Exact-match on one of the annotated shortest paths. |
| **MazeBench (AlphaMaze)** | arXiv 2502.14669, February 2025 | Used as the eval set for a GRPO-trained maze model | 100 tokenized mazes in three difficulty buckets by path length (1 to 13 steps). | Tiny and easy. It is a training-paper appendix more than a benchmark. Predates this repo, but nobody knows it by name. |

The one that matters for naming is **mazebench.com**. It owns the domain, has a public leaderboard that aggregators such as BenchmarkList mirror, and got press coverage in August and September 2026 when GPT-6 Astra scored 14% without Python ([MazeBench blog](https://mazebench.com/blog?post=maze-bench-results), [aisocratic.org](https://aisocratic.org/news/mazebench-the-best-coding-agent-collects-13-gems-four-frontier-models-get-zero), [Quesma](https://quesma.com/blog/gpt-6-astra-solves-puzzles)). Anyone searching "MazeBench" in late 2026 lands there.

### Other maze, grid and navigation benchmarks

| Benchmark | What it measures | Method | Weaknesses |
|---|---|---|---|
| **MazeEval** ([arXiv 2507.20395](https://arxiv.org/abs/2507.20395), LREC 2026) | Sequential spatial decisions without a map | Function-calling navigation of perfect mazes (5x5 to 15x15) with only coordinates and distance-to-wall readings. English vs Icelandic. Fails an episode when any cell is visited 10 times. | Five mazes per size. Only 2025-era models. Every observation includes full history, so it does not separate memory from planning. Found that 100% of non-o3 failures were loops. |
| **Text-based exploration under partial observability** ([arXiv 2604.09604](https://arxiv.org/abs/2604.09604)) | Exploration and navigation from a 5x5 local window | ASCII gridworlds, one move per turn, three fixed layouts | Three fixed layouts, so contamination is easy. Reviewers note it hands the agent global coordinates each step, which weakens the partial-observability claim. |
| **Lost in Aggregation** ([arXiv 2606.22219](https://arxiv.org/abs/2606.22219)) | Where in the pipeline navigation fails: local passability (Fine), junction choice (Meso), global heading (Macro) | Mazes with probes at each level plus end-to-end runs. Metrics include valid-move ratio and first-error step. | Diagnostic paper, not a maintained leaderboard. Its decomposition is the closest prior art to this bench's task split, and I borrow the idea of isolating local reading from global planning. |
| **AGI Maze** ([arXiv 2607.00627](https://arxiv.org/abs/2607.00627)) | World-modelling under partial observability | POMDP grid with textual feedback only ("a monolith blocks the way"), key and treasure | Shows that letting models keep notes doubles scores (GPT-5.5 30% to 60%). That means a memory score depends heavily on whether the harness gives a scratchpad, which has to be fixed and reported. |
| **SpatialEval** ([NeurIPS 2024](https://github.com/jiayuww/SpatialEval)) | Spatial relations, counting, Maze-Nav | Multiple-choice QA in text, image and image+text | Static multiple-choice with a fixed public set. Its finding that text beats images still holds in 2026. |
| **PPNL** ([arXiv 2310.03249](https://arxiv.org/abs/2310.03249)) | Path planning from natural-language grid descriptions | Single and multi-goal planning on 5x5 to 7x7 grids. Metrics: success, optimal rate, feasible rate, distance to goal. | Small grids, and saturated by any 2026 reasoning model. Its metric set (success, optimality, feasibility) is still the right one. |
| **BALROG** ([balrogai.com](https://balrogai.com/), [arXiv 2411.13543](https://arxiv.org/abs/2411.13543)) | Long-horizon agentic play in BabyAI, Crafter, TextWorld, Baba Is AI, MiniHack, NetHack | Natural-language actions in procedurally generated RL environments, 0 to 100 progress per game, standard errors reported | Mixes many skills, so a low score does not say *which* skill failed. Public environments. Top score 58% (Gemini 3 Pro), so not saturated. |
| **ARC-AGI-3** ([technical report](https://arxiv.org/abs/2603.24621)) | Exploration, world-model building, goal inference | Turn-based games with no instructions. Scored by action efficiency against human baselines, squared. | It went from 0.37% (March 2026) to 30% (Opus 5, July) to 99.9% with OpenAI's own adapter (GPT-6 Astra, September). That is the saturation warning for this project. A fixed difficulty ceiling lasts months. The same Astra run scored 62.7% on the neutral harness, which shows how much the harness matters. |
| **Theory of Space** ([GitHub](https://github.com/mll-lab-nu/Theory-of-Space)) | Building, revising and using a spatial belief from partial views | Text and 3D-vision multi-room worlds, explore then answer queries | Heavier setup (ThreeDWorld). Close to this bench's memory task in spirit. |
| **SpatialSTALE** ([arXiv 2608.04574](https://arxiv.org/abs/2608.04574)) | What happens when spatial memory goes stale | Dynamic FrozenLake with a memory store, text and image | 8x8 only. Interesting failure mode, narrow scope. |

### Lessons I am taking from them

1. **Every successful text-maze method is "BFS in prose".** Rodriguez Salgado's traces show models transcribing the grid and enumerating paths step by step, with solve rates tracking the thinking budget (GPT-5.5: 15% at no reasoning, 96% at medium). So a maze score mostly measures how much serial search the model can afford and how accurately it reads the grid. The bench should measure those two things separately and report tokens, not hide them.
2. **Grid reading is its own failure.** Both the visual MazeBench ablation and Lost in Aggregation find big losses from simply misreading which cells are open. A task that only asks "which moves are legal here?" isolates that.
3. **Chat context does not forget.** In the v1 "initial" mode the maze stayed in the first message for the whole tool loop. That tests planning plus position tracking, not memory. Real memory pressure in an LLM comes from information spread across many turns that the model has to integrate, as in MazeEval and AGI Maze.
4. **Loops are the dominant failure under partial observability** (MazeEval, 2604.09604). Revisit counts and invalid-move rates explain failures better than success alone.
5. **Small n everywhere.** None of the maze benchmarks above report confidence intervals except BALROG. Most use 5 to 110 items.

### How this bench differs, and the rename

This bench is text-only, procedurally generated and agentic. A model gets a batched `move` tool and has to reach the exit. Three conditions (full map, map once, 3×3 fog) vary only what it sees. Every result reports completion with a bootstrap interval next to cost, output tokens and agent steps, across reasoning effort. Every maze comes from a seed, so any number of fresh items can be drawn, and runs cost cents to dollars per model, where mazebench.com costs thousands per run. (An earlier draft split the score into five single-ability tasks; [design.md](./design.md) explains why that was cut.)

It does need a new name. Sharing "MazeBench" with a better-known, well-funded 3D benchmark will confuse readers and reviewers, and the comparison does not flatter a small text benchmark.

**Recommendation: TheseusBench.** Claude Shannon's 1950 maze-solving mouse was called Theseus. It explored a maze by bumping into walls, stored what it learned in relays, and then ran the route from memory. That is this benchmark's memory task, built by hand 76 years ago. Collisions I checked: "Theseus" is a Meta PyTorch optimisation library and the name of a 2026 KGQA graph-navigation formulation (arXiv 2609.14528), but I found no benchmark called TheseusBench. Fallback if you dislike it: **MazeRecall** (descriptive, but undersells the planning tasks).

I have not renamed anything. The display name is one constant (`BENCH_NAME` in `packages/core/src/meta.ts`), so a rename is a one-line change plus the README and the GitHub repo.

## 2. Evaluation practice in 2026

### Contamination resistance

- **Procedural generation from seeds** is the standard answer (ARC-AGI-3, BALROG, both MazeBenches). A seed-addressed generator means a suite is a list of `(task, level, seed)` triples and any item can be regenerated byte for byte.
- **Held-out split.** Publish the public seeds but keep a private salt that produces an unpublished split. If public and held-out scores diverge for a model, that is evidence of contamination. ABC item R.3 asks for exactly this ([Zhu et al., arXiv 2507.02825](https://arxiv.org/abs/2507.02825)).
- **Versioned suites.** When items leak, bump the suite version and draw new seeds instead of patching in place.
- **Avoid priors that shortcut the task.** v1 always put the start at the top-left and the goal at the bottom-right, so "go down and right" was a free heuristic. Start and goal positions should be drawn from the seed.

### Statistical rigor

- **Report standard errors and 95% CIs on every score** ([Miller, "Adding error bars to evals", arXiv 2411.00640](https://arxiv.org/abs/2411.00640)). When items share structure (several epochs of the same maze, or several questions about one maze), use clustered standard errors or a cluster bootstrap. Miller shows naive SEs can be 3x too small.
- **Compare models on paired differences.** All models see the same seeds, so per-item differences give much tighter intervals than comparing two independent means.
- **Power.** At p = 0.5, n = 100 items gives a 95% CI half-width of about ±10 points. n = 400 gives ±5. That sets the item budget.
- **pass@k vs pass^k.** pass@k (at least one of k succeeds) measures the capability ceiling. pass^k (all k succeed) measures reliability. τ-bench introduced pass^k and found GPT-4o at 61% pass^1 but 25% pass^8 on retail ([Yao et al., arXiv 2406.12045](https://arxiv.org/abs/2406.12045)). Both have unbiased estimators from n ≥ k samples per item: `1 - C(n-c,k)/C(n,k)` and `C(c,k)/C(n,k)`.
- **evalci** ([arXiv 2607.04429](https://arxiv.org/abs/2607.04429)) packages these for Python. In TypeScript I will implement the few pieces needed (cluster bootstrap, paired differences, pass@k, pass^k) and test them.

### Baselines

ABC asks for a trivial baseline (R.13), a non-AI baseline (R.12) and an oracle solver that proves every task is solvable (T.9). For mazes that means:

- **Oracle:** BFS shortest path. It must score 100% on every task. If it does not, the task is broken.
- **Trivial or random:** a random walk, random answers, or random legal moves. This gives the floor.
- **Simple heuristics:** wall-following for navigation and reversing the observed route for route recall. These show how much of a score a non-reasoning strategy can collect.
- **Human:** ARC-AGI-3 uses the median first-time human. I have no human data. That goes in the limitations section with a plan to collect it.

### Difficulty and saturation

ARC-AGI-3 going from under 1% to 99.9% in six months is the clearest lesson. A benchmark needs a difficulty knob with no fixed top. Maze size works well here. The serial-search cost grows with path length, and the visual MazeBench already shows 20x20 breaking GPT-5.5. The suite should define a ladder of levels, report per-level curves rather than one average, and add a harder level in a new suite version once the top level saturates.

### Cost, latency and reasoning effort

- Report cost (from the provider's reported cost, not list price times tokens), input, output and reasoning tokens, and wall time per item. A model that matches another at 10x the cost is a different product.
- **Reasoning effort is a model setting, not a footnote.** GPT-5.5 scores 15/100 at `none` and 96/100 at `medium` on the visual MazeBench. Each leaderboard entry is a (model, effort) pair. OpenRouter maps a unified `reasoning.effort` to each vendor's control. Since 2026-06-22 that includes Anthropic's `output_config.effort` on Claude 4.6 and newer ([OpenRouter migration guide](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/model-migrations/claude-4-7)).
- **Temperature is going away.** Claude Opus 4.7, Sonnet 5 and later silently ignore `temperature`, `top_p` and `top_k`. GPT-5.x rejects temperature unless effort is `none`. Inspect's evals now leave temperature unset for like-for-like comparisons ([inspect_evals TAC notes](https://github.com/UKGovernmentBEIS/inspect_evals/blob/main/src/inspect_evals/tac/EVALUATION.md)). I will leave it unset, record that, and get variance from multiple epochs instead of pretending runs are deterministic.

### Reproducibility

- **Pin model IDs** to dated slugs where they exist (`deepseek/deepseek-v4-pro-0813`, `qwen/qwen3.8-max-0902`). Avoid `~latest` aliases.
- **Provider routing changes results.** The same open-weight model can differ by 15 points on GPQA and 23 on τ-bench Airline depending on which host serves it ([theterminal.space write-up on DeepSeek V4 Flash 0731](https://theterminal.space/software/openrouter-provider-routing-inconsistency)). Quantization is often undisclosed (about a third of OpenRouter open-weight endpoints in [one audit](https://github.com/AMindToThink/openrouter_reliable_research_search/blob/master/reports/openrouter-best-practices.md)). OpenRouter's Auto Exacto routes tool-calling requests to providers with better tool-call telemetry by default since March 2026 ([announcement](https://openrouter.ai/blog/announcements/auto-exacto)). The harness has to record which provider actually served each call. It should allow pinning a provider with `allow_fallbacks: false` and `require_parameters: true`.
- **Version everything:** suite version, results schema version, harness git SHA, prompt template hash.

### Harness pitfalls

- **Prompt format sensitivity.** Formatting alone moved LLaMA-2-13B by up to 76 points ([Sclar et al.](https://arxiv.org/abs/2310.11324)). The 2026 Format Sensitivity Index study found the swings come mostly from parse failures ([arXiv 2607.09665](https://arxiv.org/abs/2607.09665)). So: one documented prompt template per task, a lenient but specified answer parser, parse-failure rates reported separately, and a representation ablation (ASCII vs adjacency list) to measure how much the format matters.
- **Separate tool-call failures from reasoning failures.** An invalid tool call, an empty response, a truncated output and a wrong answer are four different things. Infrastructure errors (HTTP 5xx, timeouts after retries) are not model failures. They get retried and reported separately, never silently scored as zero ([ABC](https://arxiv.org/abs/2507.02825), T.3).
- **Do-nothing and shortcut agents.** τ-bench gave a do-nothing agent 38% ([ABC](https://arxiv.org/abs/2507.02825)). Every task needs a check that the trivial baseline scores near the floor.
- **Scratchpad and context policy** change memory scores by 2x (AGI Maze). The harness must fix and document them.

## 3. Toolchain

| Piece | Version on 2026-10-05 | Notes |
|---|---|---|
| Vercel AI SDK (`ai`) | 7.0.127 | v7 is current, v6 is still maintained. Agents use `ToolLoopAgent` with `stopWhen` (`isStepCount`, `hasToolCall`) and `prepareStep` ([docs](https://ai-sdk.dev/docs/agents/loop-control)). `generateText` covers single calls. |
| `@openrouter/ai-sdk-provider` | 3.1.0 | Peer-depends on `ai@^7`. Exposes reasoning effort, usage accounting (cost per call) and provider routing options. |
| `@ai-sdk/openai-compatible` | 3.0.62 | For local models (LM Studio, llama.cpp, vLLM). |
| Next.js | 16.3.8 | App Router, static generation. React 19.3. |
| Bun | 1.3.14 locally | Runtime, package manager, test runner. |
| TypeScript | 7.0.2 (the Go port) | Next's build-time type check needs the JS compiler API, so I will check whether 7.x works and fall back to 6.x if not. |
| Biome | 2.5.15 | Lint and format. |
| Inspect AI | 0.3.276 (Python) | See below. |
| promptfoo | 0.123.1 | See below. |

### OpenRouter as the provider layer

One key covers every lab. Cost comes back per request, so no price tables go stale. Reasoning effort has one parameter across vendors. Provider routing can be pinned and the serving provider is reported. The costs: an extra hop, its own routing choices (Auto Exacto), and per-provider variance for open-weight models. All three are manageable if the harness records the provider and lets you pin it. The repo already uses it and the key exists. Local models go through the OpenAI-compatible provider.

### Build on a framework, or stay custom?

**Inspect AI** (UK AISI) is the strongest open framework. It has datasets, solvers, scorers, epochs, tool calling, sandboxes and a log viewer. **promptfoo** is mostly prompt regression testing. **OpenAI evals** has gone quiet. **HELM** is a fixed-scenario leaderboard framework.

I am staying custom, in TypeScript, for three reasons:

1. The interesting parts of this bench are the environment (maze generation, observation rendering, the fog-of-war loop) and the scoring. Those are custom code in any framework. What Inspect would add (dataset loading, a generic agent loop, a log viewer) is a small fraction of the code.
2. The dashboard is TypeScript and needs the same maze renderer, scorer and stats code for replays and CIs. One TypeScript core package shared by the runner and the dashboard removes a whole class of "the dashboard computes it differently" bugs. A Python runner would mean porting all of it.
3. The repo's stack is Bun and the AI SDK, and the user's default is Bun.

What I take from Inspect anyway: epochs as a first-class setting, structured per-sample logs with usage and errors, and scorers kept separate from solvers. If someone later wants an Inspect port, the seed-addressed suite format makes that easy. The items are a function of `(task, level, seed)`.

## 4. Frontier model lineup (October 2026)

Prices are USD per million input/output tokens from OpenRouter on 2026-10-05. "Open" means open weights on Hugging Face.

| Lab | Model | OpenRouter ID | $ in / out | Notes |
|---|---|---|---|---|
| OpenAI | GPT-6 Astra | `openai/gpt-6-astra` | 10 / 50 | Flagship. 99.9% ARC-AGI-3 with OpenAI's adapter. |
| OpenAI | GPT-6.1 Sol | `openai/gpt-6.1-sol` | 2 / 10 | Released 2026-09-30. |
| OpenAI | GPT-6 Luna | `openai/gpt-6-luna` | 0.10 / 0.50 | Cheapest frontier-family model. Smoke-test candidate. |
| OpenAI | gpt-oss-120b | `openai/gpt-oss-120b` | 0.04 / 0.17 | Open. Old (Aug 2025) but the reference open model. |
| Anthropic | Claude Fable 5.1 | `anthropic/claude-fable-5.1` | 10 / 50 | Top Anthropic model. |
| Anthropic | Claude Opus 5.5 | `anthropic/claude-opus-5.5` | 4 / 20 | |
| Anthropic | Claude Sonnet 5.5 | `anthropic/claude-sonnet-5.5` | 2 / 10 | |
| Anthropic | Claude Haiku 4.5 | `anthropic/claude-haiku-4.5` | 1 / 5 | |
| Google | Gemini 3.1 Pro (preview) | `google/gemini-3.1-pro-preview` | 2 / 12 | Latest Pro on OpenRouter. |
| Google | Gemini 3.8 Flash | `google/gemini-3.8-flash` | 0.75 / 3.75 | |
| Google | Gemini 3.5 Flash-Lite | `google/gemini-3.5-flash-lite` | 0.30 / 2.50 | |
| xAI | Grok 4.7 | `x-ai/grok-4.7` | 2 / 6 | |
| DeepSeek | DeepSeek V4 Pro (0813) | `deepseek/deepseek-v4-pro-0813` | 0.40 / 5 | Open. |
| DeepSeek | DeepSeek V4.1 Flash | `deepseek/deepseek-v4.1-flash` | 0.30 / 1.20 | Open. |
| Qwen | Qwen3.8 Max (0902) | `qwen/qwen3.8-max-0902` | 2 / 6 | |
| Qwen | Qwen3.8 27B | `qwen/qwen3.8-27b` | 0.42 / 2.55 | Open, small. |
| Moonshot | Kimi K3 | `moonshotai/kimi-k3` | 0.67 / 14 | Open. |
| Zhipu | GLM-5.3 | `z-ai/glm-5.3` | 0.05 / 7 | Open. |
| Zhipu | GLM-5.3 Flash | `z-ai/glm-5.3-flash` | 0.15 / 0.50 | Open. |
| MiniMax | MiniMax M3 | `minimax/minimax-m3` | 0.30 / 1.20 | Open. |
| Xiaomi | MiMo V2.6 Pro | `xiaomi/mimo-v2.6-pro` | 0.43 / 0.87 | |
| NVIDIA | Nemotron 3 Ultra | `nvidia/nemotron-3-ultra-550b-a55b` | 0.50 / 2.20 | Open. |

All of them support tools and reasoning on OpenRouter. Proposed sweep: the 16 models in `bench/src/models.ts`, with frontier models at their default effort and two effort levels (`none` and `high`) for one cheap model to show the effort curve.

## Sources

Name collision and related benchmarks
- mazebench.com results post: https://mazebench.com/blog?post=maze-bench-results
- Launch thread: https://x.com/patience_cave/status/2082091368336548047
- BenchmarkList mirror: https://benchmarklist.com/benchmarks/mazebench/
- aisocratic.org coverage: https://aisocratic.org/news/mazebench-the-best-coding-agent-collects-13-gems-four-frontier-models-get-zero
- Rodriguez Salgado, "From Pixels to BFS" (arXiv 2603.26839): https://arxiv.org/abs/2603.26839 and https://github.com/alrod97/LLMs_mazes
- AlphaMaze (arXiv 2502.14669): https://arxiv.org/abs/2502.14669
- MazeEval (arXiv 2507.20395): https://arxiv.org/abs/2507.20395
- LLMs for text-based exploration under partial observability (arXiv 2604.09604): https://arxiv.org/abs/2604.09604
- Lost in Aggregation (arXiv 2606.22219): https://arxiv.org/abs/2606.22219
- AGI Maze (arXiv 2607.00627): https://www.emergentmind.com/papers/2607.00627
- SpatialEval: https://github.com/jiayuww/SpatialEval
- PPNL (arXiv 2310.03249): https://arxiv.org/abs/2310.03249
- BALROG: https://balrogai.com/ and https://arxiv.org/abs/2411.13543
- ARC-AGI-3 launch numbers: https://tokencost.app/blog/arc-agi-3-benchmark-cost ; Astra result: https://ai.info/future/road-to-agi-what-general-intelligence-means-how-close-we-are
- Theory of Space: https://github.com/mll-lab-nu/Theory-of-Space
- SpatialSTALE (arXiv 2608.04574): https://arxiv.org/abs/2608.04574
- Shannon's Theseus: https://ourworldindata.org/scaling-up-ai

Evaluation practice
- Miller, "Adding error bars to evals" (arXiv 2411.00640): https://arxiv.org/abs/2411.00640
- Agentic Benchmark Checklist (arXiv 2507.02825): https://arxiv.org/abs/2507.02825
- τ-bench and pass^k (arXiv 2406.12045): https://arxiv.org/abs/2406.12045
- pass^k theory: https://tmls.nyc/research/reliability-frontier-passk
- evalci (arXiv 2607.04429): https://arxiv.org/abs/2607.04429
- Format Sensitivity Index (arXiv 2607.09665): https://arxiv.org/abs/2607.09665
- Sclar et al., spurious features in prompt design: https://arxiv.org/abs/2310.11324
- SPL metric, Anderson et al. 2018, "On Evaluation of Embodied Navigation Agents": https://arxiv.org/abs/1807.06757

Providers and reproducibility
- OpenRouter Exacto: https://openrouter.ai/blog/announcements/provider-variance-introducing-exacto
- OpenRouter Auto Exacto: https://openrouter.ai/blog/announcements/auto-exacto
- Provider variance write-up: https://theterminal.space/software/openrouter-provider-routing-inconsistency
- OpenRouter quantization audit: https://github.com/AMindToThink/openrouter_reliable_research_search/blob/master/reports/openrouter-best-practices.md
- Claude 4.7 / Sonnet 5 parameter changes on OpenRouter: https://openrouter.ai/docs/cookbook/evaluate-and-optimize/model-migrations/claude-4-7
- Inspect TAC eval settings: https://github.com/UKGovernmentBEIS/inspect_evals/blob/main/src/inspect_evals/tac/EVALUATION.md

Toolchain
- AI SDK agents and loop control: https://ai-sdk.dev/docs/agents/overview , https://ai-sdk.dev/docs/agents/loop-control
- Inspect AI: https://inspect.aisi.org.uk/
- OpenRouter models API: https://openrouter.ai/api/v1/models
