import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ItemResult, RunFile, RunHeader } from "@mazebench/core";
import { loadRuns } from "@mazebench/core/node";

export const REPO_ROOT = join(import.meta.dir, "..", "..");
export const RESULTS_DIR = process.env.MAZEBENCH_RESULTS_DIR ?? join(REPO_ROOT, "results");
/** Held-out results never go in the public results folder (it is gitignored). */
export const HOLDOUT_DIR = process.env.MAZEBENCH_HOLDOUT_DIR ?? join(REPO_ROOT, "results-holdout");

export function resultsDir(split: "public" | "holdout"): string {
  return split === "public" ? RESULTS_DIR : HOLDOUT_DIR;
}

export function runPath(split: "public" | "holdout", suiteKey: string, subjectKey: string, file: string): string {
  return join(resultsDir(split), suiteKey, subjectKey, file);
}

/** Append-only JSONL writer: header first, then one line per finished item. */
export class RunWriter {
  constructor(
    readonly path: string,
    header: RunHeader,
  ) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(header)}\n`);
  }

  append(item: ItemResult): void {
    appendFileSync(this.path, `${JSON.stringify(item)}\n`);
  }
}

export function loadSubjectRuns(split: "public" | "holdout", suiteKey: string, subjectKey: string): RunFile[] {
  return loadRuns(join(resultsDir(split), suiteKey, subjectKey));
}

export function timestampId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
