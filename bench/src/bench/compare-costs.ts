import { readFileSync } from "node:fs";

// Paths
const RESULTS_FILE = new URL(
  "./results/[google]gemini-3-flash-preview-none_2025-12-30T09-59-00-050Z.json",
  import.meta.url
).pathname;
const CSV_FILE =
  "/Users/b.omarov/Downloads/openrouter_activity_2025-12-30.csv";

// Load results JSON
const results = JSON.parse(readFileSync(RESULTS_FILE, "utf-8"));

// Extract run IDs and costs from results
const resultsCosts = new Map<string, number>();
for (const result of results.results) {
  // Handle undefined/null costs as 0
  resultsCosts.set(result.id, result.cost ?? 0);
}

console.log(`Found ${resultsCosts.size} runs in results file`);
console.log(
  `Total cost in results (from stats): $${results.stats.overall.totalCost.toFixed(6)}`
);

// Parse CSV manually (simple parser for this specific format)
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n");
  const headers = lines[0].split(",");
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const values = line.split(",");
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || "";
    }
    records.push(record);
  }
  return records;
}

// Load and parse CSV
const csvContent = readFileSync(CSV_FILE, "utf-8");
const records = parseCSV(csvContent);

// Aggregate costs by user (run ID)
const csvCosts = new Map<string, number>();
const csvCallCounts = new Map<string, number>();

for (const record of records) {
  const user = record.user;
  const cost = Number.parseFloat(record.cost_total) || 0;

  if (resultsCosts.has(user)) {
    csvCosts.set(user, (csvCosts.get(user) || 0) + cost);
    csvCallCounts.set(user, (csvCallCounts.get(user) || 0) + 1);
  }
}

console.log(`Found ${csvCosts.size} matching runs in CSV`);

// Compare costs
let totalResultsCost = 0;
let totalCsvCost = 0;
const comparisons: {
  id: string;
  resultsCost: number;
  csvCost: number;
  diff: number;
  apiCalls: number;
}[] = [];

for (const [id, resultsCost] of resultsCosts) {
  const csvCost = csvCosts.get(id) || 0;
  const apiCalls = csvCallCounts.get(id) || 0;
  totalResultsCost += resultsCost;
  totalCsvCost += csvCost;

  const diff = csvCost - resultsCost;
  comparisons.push({ id, resultsCost, csvCost, diff, apiCalls });
}

console.log("\n=== SUMMARY ===");
console.log(`Total cost in results file: $${totalResultsCost.toFixed(6)}`);
console.log(`Total cost in OpenRouter CSV: $${totalCsvCost.toFixed(6)}`);
console.log(
  `Difference (CSV - Results): $${(totalCsvCost - totalResultsCost).toFixed(6)}`
);
console.log(
  `Percentage difference: ${(((totalCsvCost - totalResultsCost) / totalCsvCost) * 100).toFixed(2)}%`
);

// Show all comparisons sorted by difference
console.log("\n=== ALL COMPARISONS (sorted by difference) ===");
comparisons.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

for (const c of comparisons) {
  const diffStr =
    c.diff > 0 ? `+$${c.diff.toFixed(6)}` : `-$${Math.abs(c.diff).toFixed(6)}`;
  console.log(
    `${c.id.split("_").slice(2, 5).join("_")}: Results=$${c.resultsCost.toFixed(6)}, CSV=$${c.csvCost.toFixed(6)}, Diff=${diffStr} (${c.apiCalls} API calls)`
  );
}

// Show runs with 0 cost in results but positive in CSV (likely missing cost tracking)
const zeroCostRuns = comparisons.filter(
  (c) => c.resultsCost === 0 && c.csvCost > 0
);
if (zeroCostRuns.length > 0) {
  console.log(
    `\n=== RUNS WITH $0 IN RESULTS BUT CHARGED IN CSV (${zeroCostRuns.length}) ===`
  );
  for (const c of zeroCostRuns) {
    console.log(`  ${c.id}: CSV cost = $${c.csvCost.toFixed(6)}`);
  }
}
