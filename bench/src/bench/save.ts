import fs from "node:fs";
import path from "node:path";
import { getModelDefinition, type ModelKey } from "./models";
import type { BenchmarkReport, RunResult } from "./types";

const RESULT_DIR = path.resolve(import.meta.dir, "results");

export interface ExistingResult {
  modelKey: string;
  filePath: string;
  date: string;
  successRate: number;
  totalRuns: number;
}

/**
 * Get existing results for all models that have been benchmarked.
 * Returns a map of model key to the most recent result info.
 */
export function getExistingResults(): Map<string, ExistingResult> {
  const results = new Map<string, ExistingResult>();

  if (!fs.existsSync(RESULT_DIR)) {
    return results;
  }

  const files = fs.readdirSync(RESULT_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    try {
      const filePath = path.join(RESULT_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const report = JSON.parse(content) as BenchmarkReport;

      const modelKey = report.metadata.model;
      const existing = results.get(modelKey);

      // Keep the most recent result for each model
      if (
        !existing ||
        new Date(report.metadata.date) > new Date(existing.date)
      ) {
        results.set(modelKey, {
          modelKey,
          filePath,
          date: report.metadata.date,
          successRate: report.stats.overall.successRate,
          totalRuns: report.results.length,
        });
      }
    } catch {
      // Skip malformed files
    }
  }

  return results;
}

function ensureResultDir() {
  if (!fs.existsSync(RESULT_DIR)) {
    fs.mkdirSync(RESULT_DIR, { recursive: true });
  }
}

export function saveRunResult(filename: string, data: BenchmarkReport): string {
  ensureResultDir();
  const filePath = path.join(RESULT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
}

/**
 * Manages incremental saving of benchmark results as they come in.
 * Each model gets its own file that is updated after each maze result.
 */
export class IncrementalResultSaver {
  private readonly filePath: string;
  private readonly report: BenchmarkReport;

  constructor(params: {
    model: ModelKey;
    suiteId: string;
    seeds: number[];
  }) {
    ensureResultDir();
    const { model, suiteId, seeds } = params;
    const filename = `${model}_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    this.filePath = path.join(RESULT_DIR, filename);

    const modelDef = getModelDefinition(model);
    this.report = {
      metadata: {
        model,
        displayName: modelDef?.displayName ?? model,
        creator: modelDef?.creator ?? "unknown",
        date: new Date().toISOString(),
        suite: suiteId,
        seeds,
      },
      stats: {
        overall: {
          successRate: 0,
          avgSteps: 0,
          avgTimeMs: 0,
          totalCost: 0,
        },
        byConfig: {},
      },
      results: [],
    };

    // Write initial empty file
    this.save();
  }

  addResult(result: RunResult): void {
    this.report.results.push(result);
    this.updateStats();
    this.save();
  }

  private updateStats(): void {
    const results = this.report.results;
    if (results.length === 0) {
      return;
    }

    const successCount = results.filter((r) => r.success).length;
    const totalSteps = results.reduce((sum, r) => sum + r.totalSteps, 0);
    const totalTime = results.reduce((sum, r) => sum + r.totalDurationMs, 0);
    const totalCost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0);

    this.report.stats.overall = {
      successRate: successCount / results.length,
      avgSteps: totalSteps / results.length,
      avgTimeMs: totalTime / results.length,
      totalCost,
    };

    // Update byConfig stats
    const byConfig: Record<string, RunResult[]> = {};
    for (const r of results) {
      const key = `${r.config.width}x${r.config.height}_${r.config.complexity}_${r.config.observationMode}`;
      if (!byConfig[key]) {
        byConfig[key] = [];
      }
      byConfig[key].push(r);
    }

    this.report.stats.byConfig = {};
    for (const [key, configResults] of Object.entries(byConfig)) {
      const configSuccessCount = configResults.filter((r) => r.success).length;
      const configTotalSteps = configResults.reduce(
        (sum, r) => sum + r.totalSteps,
        0
      );
      const configTotalTime = configResults.reduce(
        (sum, r) => sum + r.totalDurationMs,
        0
      );
      const configTotalCost = configResults.reduce(
        (sum, r) => sum + (r.cost ?? 0),
        0
      );

      this.report.stats.byConfig[key] = {
        successRate: configSuccessCount / configResults.length,
        avgSteps: configTotalSteps / configResults.length,
        avgTimeMs: configTotalTime / configResults.length,
        totalCost: configTotalCost,
        n: configResults.length,
      };
    }
  }

  private save(): void {
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(this.report, null, 2),
      "utf-8"
    );
  }

  getFilePath(): string {
    return this.filePath;
  }
}
