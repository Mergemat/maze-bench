<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/e162b7c1-37aa-4576-bb2b-090c3104addd" />

# MazeBench

A benchmark for evaluating LLM spatial reasoning and navigation abilities through maze-solving tasks.
<img width="547" height="276" alt="image" src="https://github.com/user-attachments/assets/04aaccec-ffd6-4b49-badb-adf8fd0f50cf" />

## What it measures

MazeBench tests how well language models can:
- Understand and navigate 2D grid-based mazes
- Plan paths from start (S) to goal (G)
- Handle different levels of spatial complexity
- Operate with limited (local) or full (global) visibility

## How it works

The model receives a maze representation and must output movement commands (`up`, `down`, `left`, `right`) to navigate from start to goal. Performance is measured by success rate, steps taken, time, and API cost.

### Vision modes

- **Local**: Model sees only a 5x5 area around its position (marked as `A`)
- **Global**: Model sees the entire maze with its current position marked

### Complexity levels

- **Simple**: Long corridors, few decision points
- **Complex**: More branches and dead ends

### Maze sizes

- 5x5 (trivial)
- 21x21 (medium)
- 41x41 (challenging)

## Project structure

```
mazebench/
├── bench/          # Benchmark runner (Bun + AI SDK)
│   └── src/bench/  # Core benchmark logic
└── dashboard/      # Results visualization (Next.js)
```

## Quick start

### Run benchmarks

```bash
cd bench
bun install
bun run src/bench/run.ts
```

Results are saved to `bench/src/bench/results/`.

### View results

```bash
cd dashboard
bun install
bun dev
```

Open http://localhost:3000 to see the dashboard.

## Configuration

Edit `bench/src/bench/config.ts` to customize:
- Maze configurations (size, complexity, vision)
- Number of runs per config
- Max steps allowed

Edit `bench/src/bench/models.ts` to add/remove models to benchmark.

## Metrics

- **Success rate**: % of mazes solved
- **Average steps**: Mean steps to reach goal (successful runs)
- **Average time**: Mean duration per maze
- **Cost**: Total API cost for the benchmark run
