import fs from "node:fs";
import path from "node:path";
import type { BenchmarkReport } from "./types";

const RESULT_DIR = path.resolve(import.meta.dir, "results");

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
