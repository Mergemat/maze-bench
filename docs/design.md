# v2 design

This is the spec the code implements. If the code and this file disagree, one of them has a bug. Background and sources are in [research.md](./research.md).

## What the benchmark claims to measure

Three abilities, each with its own task:

- **Spatial reasoning.** Reading a 2D grid from text and mentally simulating movement on it.
- **Memory.** Building a map from observations spread across many turns, then using it later.
- **Planning.** Producing a correct multi-step route from a full map in one go.

A fifth, integrated task (fog navigation) combines all three with tool use, because that is how the abilities get used in practice and it is closest to v1.

The benchmark does *not* claim to measure visual perception (text only), human-like spatial cognition (the visual MazeBench paper shows models do serial search in tokens, and this bench will not distinguish strategies), or general agent competence.

## Environment

### Mazes

- A maze is a grid of `H x W` tiles, each a wall or open. `H = W = 2n + 1` for a maze of `n x n` cells. Cell centres sit on odd coordinates and the tiles between them are corridors or walls.
- Generation is a seeded recursive backtracker (depth-first carving), which gives a *perfect* maze (exactly one path between any two tiles).
- **Braiding** adds loops. After carving, each dead end is opened into a random walled neighbour with probability `braid`. `braid = 0` stays perfect. `braid = 1` removes nearly all dead ends.
- **Start and goal** are drawn from the seed, not fixed to corners. The start is a random cell centre. The goal is a random cell centre whose BFS distance from the start is at or above the 60th percentile of distances. v1 always went top-left to bottom-right, which made "go down and right" a free heuristic.
- **RNG.** `mulberry32` seeded from a 32-bit FNV-1a hash of a string key. No `Math.random` anywhere in core code.

### Rendering

- **ASCII (default).** `#` is a wall and `.` is open. `S`, `G` and `@` mark start, goal and the agent. v1 used spaces for open tiles. Trailing spaces get stripped or merged by tokenizers and UIs, so `.` is safer.
- **Adjacency list (ablation).** Every open tile as `(row,col): up (r,c), left (r,c)`. Positions are then given as coordinates. Rows count down from 0 at the top and columns count right from 0 at the left.
- **Local view.** A 3x3 window centred on the agent, in ASCII, with `@` in the middle. Tiles outside the maze render as `#`.
- **Image.** Out of scope for v2. Rodriguez Salgado's MazeBench already covers images, and keeping text-only isolates reasoning from perception. The renderer interface leaves room for it.

No task needs the model to output coordinates. Answers are directions, move strings or a step index, so coordinate-indexing mistakes do not leak into scores except in the adjacency ablation, where coordinates are the representation.

### Moves

`U`, `D`, `L`, `R` move one tile. A move into a wall is **invalid**. In one-shot tasks an invalid move ends the evaluation of that answer. In the interactive task the agent stays put, gets `blocked` back, and the move counts towards the budget and the invalid-move rate.

## Tasks

Each task defines item generation from `(level, seed)`, a prompt, an answer parser and a scorer. One-shot tasks make one model call per item. The model must end its reply with a line `ANSWER: ...`. The parser takes the last `ANSWER:` line. If there is none it tries the last non-empty line and marks the parse `fallback`. If both fail the parse is `failed` and the item scores 0. Parse status is reported per model so format failures stay visible and separate from wrong answers.

### 1. `local`: legal moves (spatial perception)

- **Input.** Full ASCII maze with `@` on an open tile.
- **Question.** Which of `U, D, L, R` can `@` move without hitting a wall?
- **Answer.** A set, e.g. `ANSWER: U, L`.
- **Item sampling.** Positions are stratified by tile degree so a constant answer cannot win. Items cycle through dead ends (1 exit), corridors (2) and junctions (3+). `@` can be on any open tile.
- **Score.** 1 if the set matches exactly, else 0. Jaccard similarity is a secondary metric.
- **Why.** This isolates grid reading. A model that cannot do this reliably at 33x33 cannot plan on 33x33 either, and the gap between `local` and `plan` shows how much of the planning failure is perception.

### 2. `trace`: path validity (spatial simulation)

- **Input.** Full ASCII maze with `S`, and a move string of length `L` starting at `S`.
- **Question.** What is the 1-based index of the first move that walks into a wall? Answer 0 if every move is legal.
- **Answer.** An integer.
- **Item sampling.** `L = 4n`. The path is a random walk that never immediately reverses. In 25% of items it is fully legal. In the rest, one move at a uniformly chosen index `k` is replaced with a move into a wall. Later moves continue from the pre-collision tile, but only `k` matters.
- **Score.** Exact match.
- **Floor.** "Always 0" scores 25%. A uniform random guess over `0..L` scores about `1/(L+1)`. Both are reported as baselines.

### 3. `plan`: one-shot route (planning, initial view only)

- **Input.** Full ASCII maze with `S` and `G`.
- **Question.** Give the full move sequence from `S` to `G`.
- **Answer.** A move string, e.g. `ANSWER: R R D D L`. Commas and words are accepted.
- **Score.** **SPL** = success x `opt / max(len, opt)` (Anderson et al. 2018), where success means executing the moves reaches `G` without an invalid move before that point (later moves are ignored), `opt` is the BFS distance and `len` is the number of moves up to reaching `G`. Success and the index of the first invalid move are secondary metrics.
- **Why SPL and not success.** A right-hand wall follower written out as a move list reaches `G` in 91% of core mazes. Success alone would reward that; SPL gives it about 0.52.
- **Why.** This is v1's "initial" mode done honestly. In v1 the maze sat in the first message for the whole tool loop, so it never tested memory. Here it is labelled as planning.

### 4. `recall`: route memory

- **Input.** No map. A transcript of a walk through an unseen maze. Each step is the move taken and the 3x3 view after it. The walk starts at `S`, which appears as `S` in any view that contains it.
- **Question.** Return to `S` by the shortest route you can justify from what you have seen.
- **Answer.** A move string.
- **Item sampling.** Mazes use `braid = 0.5`, so loops are common. The walk is a non-reversing random walk of `n x U(5, 9)` moves from `S`; it only backtracks at dead ends, so it goes around loops. The *known map* is every tile that appeared in any view. `opt` is the BFS distance from `T` (where the walk ends) to `S` over known open tiles. A walk is kept only if free reduction of the reversed walk scores SPL <= 0.7, so cancelling back-and-forth moves is not enough.
- **Why the walk changed.** The first version joined BFS paths through random waypoints. Those walks were mostly out-and-back, and free reduction alone scored 0.95, which made the task string manipulation. With the current sampler free reduction scores 0.39.
- **Score.** SPL against `opt`, with validity checked against the true maze. Success alone is not the primary metric, because replaying the walk backwards always succeeds.
- **Baselines.** *Reverse the walk* (always valid, low SPL). *Free reduction* cancels adjacent opposite moves (`U D`). It removes dead-end excursions but cannot find loop shortcuts. The gap between free reduction and the oracle is the part that needs a spatial map rather than string manipulation.
- **Why.** Everyone gets the same information regardless of exploration skill, so this tests integrating many partial observations into a map, which is what memory means for a stateless model.

### 5. `fog`: navigation under fog of war (integrated, interactive)

- **Input.** Instructions plus the initial 3x3 view. No coordinates and no goal direction. The goal shows up as `G` once it is inside the view.
- **Interaction.** The episode runs as a standard AI SDK agent (`ToolLoopAgent`) with one `move` tool that takes a list of moves, for example `{"moves": ["U", "U", "L"]}`. Moves run in order and the result gives, for each move that ran, `moved` or `blocked` and the 3x3 view after it, then `goal_reached` and `moves_left`. A batch stops early at the first blocked move or at the goal. If the agent stops without calling the tool, the harness sends "Call the move tool to continue." up to 3 times in total. After that the episode ends as `stalled`.
- **Why batches.** Each model call resends the whole conversation, including the model's earlier reasoning, so input tokens grow with the square of the number of calls. With one move per call, a level-2 episode on GPT-6 Luna used 892k input tokens over 99 calls. With batches it used 134k over 55 calls (1.8 moves per call), with reasoning still in context.
- **Budget.** `2 x (number of open tiles)` moves. That is enough for depth-first exploration with perfect memory to visit every tile.
- **Context policy.** Full history stays in context, including the model's earlier reasoning. There is no scratchpad tool, but the model's own text between tool calls stays in context. AGI Maze showed that scratchpads change scores a lot, so this policy is fixed and recorded.
- **Score.** Success (goal reached within budget). Secondary metrics: moves per model call, moves used, SPL against the BFS shortest path (low by design, since the agent has to explore), invalid-move rate (blocked moves / moves), and revisit rate (moves into an already-visited tile / moves).
- **Baselines.** Random walk. Right-hand wall follower, which always succeeds in a perfect maze but may loop in braided ones. DFS explorer with perfect memory, an upper reference that is not an oracle.

## Difficulty ladder

Size is the main difficulty knob because the search cost grows with it.

| Level | Cells `n` | Tiles | `local`, `trace`, `plan` | `recall` | `fog` |
|---|---|---|---|---|---|
| 1 | 3 | 7x7 | yes | yes | yes |
| 2 | 5 | 11x11 | yes | yes | yes |
| 3 | 8 | 17x17 | yes | yes | no (cost) |
| 4 | 12 | 25x25 | yes | yes | no (cost) |
| 5 | 16 | 33x33 | yes | yes | no (cost) |

Braid is 0.1 for `local`, `trace`, `plan` and `fog`, and 0.5 for `recall`.

**Why fog stops at level 2.** The fog loop resends the whole history each call, so input tokens grow with the square of the number of calls. In the first calibration (one move per call) GPT-6 Luna used 118k input tokens at level 1, 892k at level 2 and 4.75M at level 3. Batched moves cut level 2 to 134k, but level 3 would still cost several dollars per episode for frontier models. When a model clears level 5 above 90%, the next suite version adds a level 6 (n = 24) rather than replacing items.

## Suite `core@2.0.0`

| Task | Levels | Items per level | Items |
|---|---|---|---|
| `local` | 1 to 5 | 20 | 100 |
| `trace` | 1 to 5 | 20 | 100 |
| `plan` | 1 to 5 | 20 | 100 |
| `recall` | 1 to 5 | 20 | 100 |
| `fog` | 1 to 2 | 20 | 40 |

440 items. One epoch by default. With n = 100 the 95% CI half-width is at most about 10 points per task. `fog` has fewer items because each episode is up to about 100 calls, so its CIs are wider and the dashboard shows that.

**Other suites.** `smoke@2.0.0` (2 items per task and level on levels 1-2, fog level 1) checks the harness end to end. `calib@2.0.0` (one item per task and level, fog levels 1-3) measures token use per level for the cost estimate. Both reuse core seeds and never appear on the main leaderboard.

**Composite score** = the unweighted mean of the five primary task scores, times 100. An equal-weight mean is easy to explain, and the per-task breakdown sits next to it.

**Ablation suite `repr@2.0.0`.** `local` and `plan` on levels 1 to 3, 20 items each, with the *same seeds* as `core`, in adjacency-list form. The paired difference against `core` estimates how much the ASCII format costs each model.

### Item identity and seeds

- Item key: `"{suite}@{version}/{task}/L{level}/{index}"`. Seed: `fnv1a32(key + salt)`.
- The public split uses an empty salt. The held-out split takes its salt from `MAZEBENCH_HOLDOUT_SALT`, which is never committed. A public/held-out gap is a contamination signal.
- `packages/core/suites/core-2.0.0.manifest.json` stores a content hash per item. A unit test regenerates the suite and compares hashes, so any change to the generator, sampler or prompts that would change items fails CI until someone bumps the suite version on purpose.
- Mazes are not stored in results. They are regenerated from the seed, and results carry the item hash so a mismatch is detected.

## Model settings

- One leaderboard entry per `(model, reasoning effort)`. Effort uses OpenRouter's unified `reasoning.effort`. "default" means no reasoning parameter is sent.
- Temperature is left unset (provider default) and recorded as `null`. Newer Claude and GPT models ignore or reject it anyway. Variance comes from epochs.
- `maxOutputTokens` is 32,000 per call. Hitting it is recorded as `truncated`.
- OpenRouter returns the provider that served each call, and results record it. A model entry can pin providers (`order`, `allow_fallbacks: false`) for open-weight models.
- Local models use the OpenAI-compatible provider (LM Studio by default at `http://localhost:1234/v1`).

## Error handling

- **Infrastructure errors** (network, 429, 5xx, timeouts) are retried with exponential backoff and jitter, 4 times. If they still fail, the item gets `status: "error"` and is **not** scored. `bench run --resume` retries only errored and missing items. The leaderboard requires at least 95% of items scored and shows coverage.
- **Model-side failures** are scored and categorised: `parse_failed`, `truncated`, `invalid_move`, `stalled`, `budget_exhausted`, `wrong_answer`.

## Statistics

- **Per-task score.** Mean of item scores. With several epochs, items are clusters.
- **95% CI.** Percentile cluster bootstrap with 2,000 resamples and a fixed seed, resampling items with all their epochs.
- **Composite CI.** Stratified bootstrap. Each resample draws items within each task, recomputes each task mean, and averages.
- **Pairwise comparison.** Mean paired difference over shared items, with a bootstrap CI. The dashboard marks models whose difference from the leader has a CI excluding 0.
- **pass@k and pass^k.** Unbiased estimators per item, averaged, shown when epochs >= k.
- **Per-level curves.** Success by level with Wilson intervals, because per-level n = 20 is small.

## Baselines

Baselines are deterministic programs that run through the same item generator and scorer and write results files in the same schema. They show up on the leaderboard in a separate style.

| Baseline | `local` | `trace` | `plan` | `recall` | `fog` |
|---|---|---|---|---|---|
| `oracle` (BFS) | 100% | 100% | 100% | SPL 1.0 | ~100% |
| `random` | random non-empty set | random index | random walk of length `opt` | random walk | random walk |
| `heuristic` | always `U, D` | always 0 | right-hand wall follower | free reduction | right-hand wall follower |

Measured on `core@2.0.0`: oracle 100 on every task; random 12 / 3 / 0 / 2 / 15 (composite 6.4); heuristic 17 / 25 / 52 / 39 / 97.5 (composite 46.2). The fog heuristic is strong: a wall follower almost always finds the goal within a budget of twice the open tiles. A model below that row on fog has done worse than a ten-line program, which is itself a finding.

The oracle is a test. If it does not score 100% on every one-shot item, CI fails (ABC T.8/T.9).

## Results schema `2.0.0`

One JSONL file per run at `results/{suite}@{version}/{modelKey}/{runId}.jsonl`. Line 1 is the run header and every later line is one item result. JSONL allows resuming and appending without rewriting.

```ts
type RunHeader = {
  type: "run";
  schemaVersion: "2.0.0";
  runId: string;
  suite: { id: string; version: string; split: "public" | "holdout" };
  subject: {
    kind: "model" | "baseline";
    key: string;               // e.g. "gpt-6-luna@default"
    displayName: string;
    creator: string;
    provider: "openrouter" | "openai-compatible" | "baseline";
    modelId: string;           // exact API id
    reasoningEffort: string;   // "default" | "none" | "low" | ...
    openWeights: boolean;
    routing?: object;
  };
  settings: { epochs: number; maxOutputTokens: number; temperature: null; concurrency: number };
  harness: { gitSha: string; promptVersion: string; aiSdkVersion: string; runtime: string };
  startedAt: string;
};

type ItemResult = {
  type: "item";
  itemId: string; itemHash: string;
  task: TaskId; level: number; seed: number; epoch: number;
  status: "scored" | "error";
  score: number;                       // primary metric, 0..1
  outcome: string;                     // "success" | "wrong_answer" | "parse_failed" | ...
  metrics: Record<string, number | boolean | null>;
  answer?: { text: string; parse: "ok" | "fallback" | "failed"; value: unknown };
  trace?: object;                      // what the replay viewer needs
  usage: { inputTokens: number; outputTokens: number; reasoningTokens: number; costUsd: number | null };
  latencyMs: number; calls: number; providers: string[];
  error?: { category: string; message: string };
  finishedAt: string;
};
```

The code defines these as Zod schemas, and `bench validate` checks every committed file.

## Out of scope for v2

Images, human baselines (planned: a play page on the dashboard that records human runs against the same seeds), multi-goal or key-and-door variants, scratchpad and notes ablations, and fine-tuning.
