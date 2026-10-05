import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildItem,
  buildManifest,
  CORE_SUITE,
  enumerateItems,
  findItem,
  getSuite,
  REPR_SUITE,
  SUITES,
  suiteKey,
} from "../src/index.ts";

describe("suites", () => {
  test("core has the documented size", () => {
    const refs = enumerateItems(CORE_SUITE);
    expect(refs).toHaveLength(445);
    expect(new Set(refs.map((r) => r.itemId)).size).toBe(445);
    expect(new Set(refs.map((r) => r.seed)).size).toBe(445);
  });

  test("held-out salt changes every seed", () => {
    const pub = enumerateItems(CORE_SUITE);
    const held = enumerateItems(CORE_SUITE, "secret");
    expect(pub.every((r, i) => r.seed !== held[i]?.seed)).toBe(true);
  });

  test("repr ablation reuses core mazes", () => {
    const ref = findItem(REPR_SUITE, "plan/L2/3");
    const core = findItem(CORE_SUITE, "plan/L2/3");
    expect(ref?.seed).toBe(core?.seed as number);
    expect(buildItem(ref as never)).toEqual(buildItem(core as never));
  });

  test("getSuite accepts a versioned key", () => {
    expect(getSuite("core@2.0.0")).toBe(CORE_SUITE);
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
