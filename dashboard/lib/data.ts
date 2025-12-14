import type { BenchmarkReport } from "./types";
export function getLatestReportByModel(
  reports: BenchmarkReport[]
): Map<string, BenchmarkReport> {
  const byModel = new Map<string, BenchmarkReport>();
  for (const report of reports) {
    const existing = byModel.get(report.metadata.model);
    if (
      !existing ||
      new Date(report.metadata.date) > new Date(existing.metadata.date)
    ) {
      byModel.set(report.metadata.model, report);
    }
  }
  return byModel;
}

export function getUniqueComplexities(reports: BenchmarkReport[]): string[] {
  const complexities = new Set<string>();
  for (const report of reports) {
    for (const result of report.results) {
      complexities.add(result.config.complexity);
    }
  }
  return Array.from(complexities).sort();
}

export function getUniqueSizes(reports: BenchmarkReport[]): string[] {
  const sizes = new Set<string>();
  for (const report of reports) {
    for (const result of report.results) {
      sizes.add(`${result.config.width}x${result.config.height}`);
    }
  }
  return Array.from(sizes).sort((a, b) => {
    const [aw] = a.split("x").map(Number);
    const [bw] = b.split("x").map(Number);
    return aw - bw;
  });
}

export function getUniqueVisions(reports: BenchmarkReport[]): string[] {
  const visions = new Set<string>();
  for (const report of reports) {
    for (const result of report.results) {
      visions.add(result.config.vision);
    }
  }
  return Array.from(visions);
}
