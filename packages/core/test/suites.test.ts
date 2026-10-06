import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildManifest,
  CORE_SUITE,
  enumerateItems,
  findItem,
  getSuite,
  SUITES,
  sizeLabel,
  suiteKey,
} from "../src/index.ts";

describe("suites", () => {
  test("core has the documented size", () => {
    const refs = enumerateItems(CORE_SUITE);
    expect(refs).toHaveLength(45);
    expect(new Set(refs.map((r) => r.itemId)).size).toBe(45);
    expect(new Set(refs.map((r) => r.seed)).size).toBe(45);
  });

  test("held-out salt changes every seed", () => {
    const pub = enumerateItems(CORE_SUITE);
    const held = enumerateItems(CORE_SUITE, "secret");
    expect(pub.every((r, i) => r.seed !== held[i]?.seed)).toBe(true);
  });

  test("sizes are labelled in tiles and conditions draw their own mazes", () => {
    const full = findItem(CORE_SUITE, "full/L3/3");
    const fog = findItem(CORE_SUITE, "fog/L3/3");
    expect(full?.seed).not.toBe(fog?.seed as number);
    expect(sizeLabel(full?.level as never)).toBe("51×51");
    expect(sizeLabel(findItem(CORE_SUITE, "fog/L1/0")?.level as never)).toBe("11×11");
  });

  test("getSuite accepts a versioned key", () => {
    expect(getSuite("core@3.0.0")).toBe(CORE_SUITE);
    expect(() => getSuite("nope")).toThrow();
  });

  for (const suite of Object.values(SUITES)) {
    test(`${suiteKey(suite)} matches its committed manifest`, () => {
      // Fails when generation or prompts change. Bump the suite version and run
      // `bun run packages/core/scripts/write-manifests.ts` if the change is intended.
      const path = join(import.meta.dir, "..", "suites", `${suite.id}-${suite.version}.manifest.json`);
      const committed = JSON.parse(readFileSync(path, "utf8"));
      expect(buildManifest(suite)).toEqual(committed);
    });
  }
});
