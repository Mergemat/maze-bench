import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computeStats } from "./stats";

const KEEP_SEEDS = [
  12_345, 12_346, 12_347, 12_348, 12_349, 12_350, 12_351, 12_352, 12_353,
  12_354, 12_355, 12_356,
];

const SEED_REGEX = /seed(\d+)$/;

const resultsDir = join(import.meta.dir, "results");

const files = readdirSync(resultsDir).filter((f) => f.includes("[openai]"));

for (const file of files) {
  const filePath = join(resultsDir, file);
  const data = JSON.parse(readFileSync(filePath, "utf-8"));

  console.log(`Processing ${file}...`);
  console.log(`  Original results: ${data.results.length}`);

  // Filter results to only keep those with seeds in KEEP_SEEDS
  data.results = data.results.filter((r: { id: string }) => {
    const seedMatch = r.id.match(SEED_REGEX);
    if (!seedMatch) {
      return false;
    }
    const seed = Number.parseInt(seedMatch[1], 10);
    return KEEP_SEEDS.includes(seed);
  });

  console.log(`  Filtered results: ${data.results.length}`);

  // Update metadata seeds
  data.metadata.seeds = KEEP_SEEDS;

  // Recalculate stats
  data.stats = computeStats(data.results);

  // Write back
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log("  Saved!");
}

console.log("\nDone!");
