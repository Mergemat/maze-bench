// Regenerate the committed suite manifests. Run after an intentional suite version bump:
//   bun run packages/core/scripts/write-manifests.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildManifest, SUITES } from "../src/index.ts";

for (const suite of Object.values(SUITES)) {
  const path = join(import.meta.dir, "..", "suites", `${suite.id}-${suite.version}.manifest.json`);
  writeFileSync(path, `${JSON.stringify(buildManifest(suite), null, 2)}\n`);
  console.log(`wrote ${path}`);
}
