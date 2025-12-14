import fs from "node:fs";
import path from "node:path";
import type { BenchmarkReport, MazeComplexity, VisionMode } from "./types";

const RESULTS_DIR = path.join(process.cwd(), "../bench/src/bench/results");

export async function loadBenchmarkReports(): Promise<BenchmarkReport[]> {
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith(".json"));
  const reports: BenchmarkReport[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(RESULTS_DIR, file), "utf-8");
    const report = JSON.parse(content) as BenchmarkReport;
    const sizeOrder = [
      { width: 5, height: 5 },
      { width: 21, height: 21 },
      { width: 41, height: 41 },
    ];

    const complexityOrder: Record<MazeComplexity, number> = {
      simple: 0,
      complex: 1,
      normal: 2,
      extreme: 3,
    };

    const visionOrder: Record<VisionMode, number> = {
      local: 0,
      global: 1,
    };

    function getSizeIndex(width: number, height: number): number {
      return sizeOrder.findIndex(
        (s) => s.width === width && s.height === height
      );
    }

    const sortedResults = [...report.results].sort((a, b) => {
      const aCfg = a.config;
      const bCfg = b.config;

      const sizeDiff =
        getSizeIndex(aCfg.width, aCfg.height) -
        getSizeIndex(bCfg.width, bCfg.height);
      if (sizeDiff !== 0) {
        return sizeDiff;
      }

      const visionDiff = visionOrder[aCfg.vision] - visionOrder[bCfg.vision];
      if (visionDiff !== 0) {
        return visionDiff;
      }

      const complexityDiff =
        complexityOrder[aCfg.complexity] - complexityOrder[bCfg.complexity];
      if (complexityDiff !== 0) {
        return complexityDiff;
      }

      return 0;
    });

    report.results = sortedResults;
    reports.push(report);
  }

  return reports;
}
