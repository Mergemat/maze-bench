import type { BenchmarkStats, RunResult } from "./types";

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export function computeStats(records: RunResult[]): BenchmarkStats {
  const overall = {
    successRate: mean(records.map((r) => (r.success ? 1 : 0))),
    avgSteps: mean(records.map((r) => r.totalSteps)),
    avgTimeMs: mean(records.map((r) => r.totalDurationMs)),
    totalCost: sum(records.map((r) => r.cost ?? 0)),
  };

  const grouped: Record<string, RunResult[]> = {};
  for (const rec of records) {
    const key = `${rec.config.complexity}_${rec.config.observationMode}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(rec);
  }

  const byConfig: BenchmarkStats["byConfig"] = {};
  for (const [key, vals] of Object.entries(grouped)) {
    byConfig[key] = {
      successRate: mean(vals.map((r) => (r.success ? 1 : 0))),
      avgSteps: mean(vals.map((r) => r.totalSteps)),
      avgTimeMs: mean(vals.map((r) => r.totalDurationMs)),
      totalCost: sum(vals.map((r) => r.cost ?? 0)),
      n: vals.length,
    };
  }

  return { overall, byConfig };
}
