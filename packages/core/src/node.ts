// Node/Bun-only helpers (filesystem). Kept out of the main entry so browser bundles stay clean.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseRunJsonl, type RunFile } from "./schema.ts";

/** Recursively list `.jsonl` files under a directory. Missing directory gives []. */
export function listRunFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of entries.sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...listRunFiles(path));
    } else if (name.endsWith(".jsonl")) {
      out.push(path);
    }
  }
  return out;
}

export function loadRuns(dir: string): RunFile[] {
  return listRunFiles(dir).map((path) => parseRunJsonl(readFileSync(path, "utf8"), path));
}
