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

The loop is a standard AI SDK `ToolLoopAgent`, with the full conversation (reasoning included) in context. If the agent replies without calling the tool, the harness sends "Continue." up to three times, and then ends the episode as `stalled`. Model calls are capped at the move budget plus a small margin.

## Prompt

The system prompt holds the goal, the symbols, what the condition shows, and the move budget. The tool description is the single place the move mechanics are explained. The prompt gives no strategy: how far ahead to plan, how many moves to send per call and how to keep track of the maze are left to the model. The user message is the map, or in fog the first 3×3 view, with no other text. The methodology page renders the exact prompts from the code.

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
| Full map | 11×11, 17×17, 25×25 | 9 | 27 |
| Map once | 11×11, 17×17, 25×25 | 9 | 27 |
| Fog | 11×11, 17×17 | 9 | 18 |

72 mazes per (model, effort). Fog at 25×25 was planned but dropped from the first sweep: those episodes run for hundreds of steps, every step resends the conversation, and finishing them did not fit the budget. Sides are always odd because walls sit between cells. 7×7 was dropped after the first run: every model solved full-map 7×7 in a single step, so it carried no signal. An earlier draft had 200 mazes, but most of them were small mazes that every model solved.

`smoke@2.0.0` reuses the core seeds: one maze per condition and size, 10 in total. It checks the harness end to end, and its token counts feed the cost estimate.

## Metrics

Per maze:

- **Completion**: 1 if the agent reached the exit within budget. This is the primary score.
- **Cost**, two ways: *billed* (what OpenRouter charged, after the provider's prompt-cache discount) and *list price* (the same token counts priced at the model's published rates for uncached input, cache reads, cache writes and output, as Artificial Analysis and DeepSWE do). The run header stores the prices used.
- **Input tokens** with the cache-read and cache-write shares, **output tokens** (reasoning included, as both Artificial Analysis and DeepSWE count them), and **agent steps** (model calls).
- Moves, SPL (`optimal / max(moves, optimal)` on success), invalid-move rate, revisit rate, tool errors, nudges, and moves per step.

Per (model, effort): completion per condition, and overall completion as mazes solved out of mazes scored, so the headline always matches the solved count. Every leaderboard entry is a (model, reasoning effort) pair, and the dashboard joins a model's efforts into one line.

## Statistics

- 95% percentile bootstrap over mazes (2,000 resamples, seeded). Repeated attempts on a maze are averaged within the maze first.
- The overall interval is a bootstrap over all scored mazes.
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

API errors (429, 5xx, timeouts, network) are retried, including failed connections at the fetch level. If they persist, the task is stored with `status: "error"`, is not scored, and is retried by `--resume`. Every other ending is scored, and any ending other than reaching the exit counts as not solved: `budget_exhausted` (move cap), `stalled`, `truncated`, or `spend_limit` (stopped by the `--max-cost` cap, a resource limit like the move cap). Every model gets the same tasks, and the score is how many it solved.

## Results schema `2.0.0`

One JSONL file per run at `results/{suite}@{version}/{model}@{effort}/{timestamp}.jsonl`. Line 1 is the run header (suite, subject, settings, harness version). Every later line is one maze: id, content hash, condition, size, seed, epoch, status, score, outcome, metrics, the move log for replay, usage (tokens and cost), latency, model calls and serving providers. The Zod schemas are in `packages/core/src/schema.ts`, and `bench validate` checks every committed file against them and against the current item hashes.

## Out of scope

Images, human baselines, multi-goal mazes, and scratchpad or memory tools.
