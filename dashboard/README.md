# MazeBench Dashboard

A Next.js dashboard for visualizing MazeBench results.

## Getting Started

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Data

The dashboard reads benchmark results from `../bench/src/bench/results/`. Run benchmarks first to generate data:

```bash
cd ../bench
bun run run
```

## Features

- Model comparison charts
- Filter by complexity, size, and observation mode
- Individual run details with step traces
