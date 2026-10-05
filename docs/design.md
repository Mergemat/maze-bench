# v2 design

This is the spec the code implements. Background and sources are in [research.md](./research.md).

## History of this design

The first v2 draft had five tasks: legal moves, path check, one-shot route, route recall and fog navigation. Calibration and review cut it down to one agent task under three conditions:

- **Legal moves and path check** were diagnostics that nobody reading the leaderboard cared about. They also read as jargon ("L1", "path check") rather than as a result.
- **One-shot route and route recall** were single calls, so "agent steps" meant nothing for them and their costs did not compare with the agent task's.
- **Planning** does not need its own task. When the move tool takes a batch of moves, an agent that plans sends the whole route in one step. That shows up directly as fewer steps and fewer tokens.

## The task

An agent must reach the exit of a maze. It has one tool:

```
move({ moves: ["R", "R", "D"] })
```

The moves run in order. The result reports, for each move that ran, `moved` or `blocked`, then `goal_reached` and `moves_left`. A batch stops early at the first blocked move or at the exit. The move budget is twice the number of open tiles. A blocked move uses up budget.

The loop is a standard AI SDK `ToolLoopAgent`, with the full conversation (reasoning included) in context. If the agent replies without calling the tool, the harness sends "Call the move tool to continue." up to three times, and then ends the episode as `stalled`. Model calls are capped at the move budget plus a small margin.

## Conditions

| Condition | Initial message | Each tool result adds |
|---|---|---|
| `full`: Full map | The ASCII map with `@` and `G` | The updated map after the batch |
| `once`: Map once | The ASCII map with `@` and `G` | Nothing beyond moved/blocked |
| `fog`: Fog | The 3×3 view around the agent | The 3×3 view after each move |

`#` is a wall, `.` is open floor, `@` is the agent and `G` is the exit. In fog, `G` appears only once it is within the 3×3 view. No coordinates are given in any condition.

## Mazes

- Grid of `(2n+1) x (2n+1)` tiles, carved by a seeded depth-first backtracker. Then each dead end is opened into a neighbour with probability 0.1, adding a few loops.
- Start is a random cell centre. The exit is a random cell centre at or beyond the 60th percentile of BFS distance from the start.
- RNG: `mulberry32` seeded from a 32-bit FNV-1a hash of `"{namespace}/{condition}/L{level}/{index}"`, plus an optional private salt for a held-out split.

## Suite `core@2.0.0`

| Condition | Sizes | Mazes per size | Mazes |
|---|---|---|---|
| Full map | 7×7, 11×11, 17×17, 25×25 | 20 | 80 |
| Map once | 7×7, 11×11, 17×17, 25×25 | 20 | 80 |
| Fog | 7×7, 11×11 | 20 | 40 |

200 mazes per (model, effort). Fog stops at 11×11 because every agent step resends the conversation, so input tokens grow with the square of the number of steps.

Two helper suites reuse the core seeds. `smoke@2.0.0` (2 mazes per condition at 7×7) checks the harness. `calib@2.0.0` (one maze per condition and size) measures token use for the cost estimate.

## Metrics

Per maze:

- **Completion**: 1 if the agent reached the exit within budget. This is the primary score.
- **Cost** (OpenRouter-reported, after cache discounts), **input and output tokens**, and **agent steps** (model calls).
- Moves, SPL (`optimal / max(moves, optimal)` on success), invalid-move rate, revisit rate, tool errors, nudges, and moves per step.

Per (model, effort): completion per condition, and overall completion as the unweighted mean of the three conditions. Every leaderboard entry is a (model, reasoning effort) pair, and the dashboard joins a model's efforts into one line.

## Statistics

- 95% percentile bootstrap over mazes (2,000 resamples, seeded). Repeated attempts on a maze are averaged within the maze first.
- The overall interval uses a bootstrap stratified by condition.
- Comparisons use paired differences over shared mazes. The table marks a model "tied with #1" when that interval includes zero.
- pass@k and pass^k use the unbiased estimators when there are at least k attempts per maze.

## Baselines

These run on the same mazes through the same scorer:

| Baseline | What it does | core@2.0.0 completion |
|---|---|---|
| BFS | Knows the map and walks the shortest path | 100% |
| Wall follower | Keeps its right hand on the wall; needs no map and no memory | 95.8% |
| Random walk | Picks a random open direction each move | 10.8% |

The wall follower is strong, because twice the open tiles is enough budget to follow walls through most mazes. Completion alone therefore does not show planning. Steps, tokens and SPL show how efficiently a model got there. A CI test enforces that BFS solves every maze.

## Model settings

- Reasoning effort uses OpenRouter's unified `reasoning.effort`. "default" sends no reasoning parameter.
- Temperature is left unset and recorded as `null`.
- Output is capped at 32,000 tokens per call. Anthropic models use prompt caching.
- Each call records which provider served it. Open-weight models require providers that honour every parameter.

## Errors

API errors (429, 5xx, timeouts, network) are retried by the AI SDK. If they persist, the maze is stored with `status: "error"`, is not scored, and is retried by `--resume`. Model-side endings are scored as failures and labelled: `budget_exhausted`, `stalled` or `truncated`.

## Results schema `2.0.0`

One JSONL file per run at `results/{suite}@{version}/{model}@{effort}/{timestamp}.jsonl`. Line 1 is the run header (suite, subject, settings, harness version). Every later line is one maze: id, content hash, condition, size, seed, epoch, status, score, outcome, metrics, the move log for replay, usage (tokens and cost), latency, model calls and serving providers. The Zod schemas are in `packages/core/src/schema.ts`, and `bench validate` checks every committed file against them and against the current item hashes.

## Out of scope

Images, human baselines, multi-goal mazes, and scratchpad or memory tools.
