// Server-only data access. Results are read from ../results at build time, so every page
// is static and the deployed site needs no database.
import { join } from "node:path";
import {
  aggregate,
  CORE_SUITE,
  getSuite,
  type Interval,
  type ItemResult,
  mergeItems,
  pairedComposite,
  type RunFile,
  type SubjectSummary,
  type Suite,
  suiteKey,
} from "@mazebench/core";
import { loadRuns } from "@mazebench/core/node";

const RESULTS_DIR = process.env.MAZEBENCH_RESULTS_DIR ?? join(process.cwd(), "..", "results");

let cache: RunFile[] | undefined;

function runs(): RunFile[] {
  cache ??= loadRuns(RESULTS_DIR);
  return cache;
}

function suiteRuns(suite: Suite): RunFile[] {
  const key = suiteKey(suite);
  return runs().filter((r) => suiteKey(r.header.suite) === key && r.header.suite.split === "public");
}

const hasModels = (suite: Suite) => suiteRuns(suite).some((r) => r.header.subject.kind === "model");

/**
 * The suite the site shows: core, or the smoke suite as a labelled preview until the first
 * core sweep exists.
 */
export function activeSuite(): { suite: Suite; preview: boolean } {
  if (hasModels(CORE_SUITE)) {
    return { suite: CORE_SUITE, preview: false };
  }
  const smoke = getSuite("smoke");
  return hasModels(smoke) ? { suite: smoke, preview: true } : { suite: CORE_SUITE, preview: false };
}

export interface Row extends SubjectSummary {
  rank: number | null;
  /** Paired completion difference to the top model, when both are complete. */
  vsLeader: (Interval & { n: number }) | null;
}

export function leaderboard(): Row[] {
  const { suite } = activeSuite();
  const rs = suiteRuns(suite);
  const summaries = aggregate(rs, suite);
  const itemsOf = (key: string) => mergeItems(rs.filter((r) => r.header.subject.key === key));
  const leader = summaries.find((s) => s.subject.kind === "model" && s.composite !== null);
  const leaderItems = leader ? itemsOf(leader.subject.key) : [];
  let rank = 0;
  const rows = summaries.map((s) => {
    const isModel = s.subject.kind === "model";
    const vsLeader =
      leader && isModel && s.composite && s.subject.key !== leader.subject.key
        ? pairedComposite(itemsOf(s.subject.key), leaderItems, suite)
        : null;
    return { ...s, rank: isModel ? ++rank : null, vsLeader };
  });
  // Models first, baselines after them.
  return [...rows.filter((r) => r.rank !== null), ...rows.filter((r) => r.rank === null)];
}

export function subject(key: string): Row | undefined {
  return leaderboard().find((r) => r.subject.key === key);
}

/** Merged item results for one subject, trimmed for the replay viewer. */
export function subjectItems(key: string): ItemResult[] {
  const { suite } = activeSuite();
  return mergeItems(suiteRuns(suite).filter((r) => r.header.subject.key === key))
    .map((i) => {
      const { answer: _answer, ...rest } = i;
      return rest;
    })
    .sort((a, b) => a.itemId.localeCompare(b.itemId, "en", { numeric: true }));
}
