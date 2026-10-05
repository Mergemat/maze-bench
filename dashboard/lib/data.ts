// Server-only data access. Results are read from ../results at build time, so every page
// is static and the deployed site needs no database.
import { join } from "node:path";
import {
  aggregate,
  getSuite,
  type Interval,
  type ItemResult,
  mergeItems,
  pairedComposite,
  type RunFile,
  SUITES,
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

export interface SuiteInfo {
  id: string;
  key: string;
  description: string;
  models: number;
  baselines: number;
  items: number;
  lastRun: string | null;
}

/** Suites that have at least one results file, core first. */
export function suites(): SuiteInfo[] {
  return Object.values(SUITES)
    .map((suite) => {
      const rs = suiteRuns(suite);
      const subjects = new Map(rs.map((r) => [r.header.subject.key, r.header.subject.kind]));
      const modelRuns = rs.filter((r) => r.header.subject.kind === "model");
      return {
        id: suite.id,
        key: suiteKey(suite),
        description: suite.description,
        models: [...subjects.values()].filter((k) => k === "model").length,
        baselines: [...subjects.values()].filter((k) => k === "baseline").length,
        items: suite.tasks.reduce((s, t) => s + t.levels.reduce((a, l) => a + l.items, 0), 0),
        lastRun:
          modelRuns
            .map((r) => r.header.startedAt)
            .sort()
            .at(-1) ?? null,
      };
    })
    .filter((s) => s.models + s.baselines > 0);
}

export interface Row extends SubjectSummary {
  rank: number | null;
  /** Paired composite difference to the top model, when both are complete. */
  vsLeader: (Interval & { n: number }) | null;
}

export function leaderboard(suiteId: string): Row[] {
  const suite = getSuite(suiteId);
  const rs = suiteRuns(suite);
  const summaries = aggregate(rs, suite);
  const itemsOf = (key: string) => mergeItems(rs.filter((r) => r.header.subject.key === key));
  const models = summaries.filter((s) => s.subject.kind === "model");
  const leader = models.find((s) => s.composite !== null);
  const leaderItems = leader ? itemsOf(leader.subject.key) : [];
  let rank = 0;
  return summaries.map((s) => {
    const isModel = s.subject.kind === "model";
    const vsLeader =
      leader && isModel && s.composite && s.subject.key !== leader.subject.key
        ? pairedComposite(itemsOf(s.subject.key), leaderItems, suite)
        : null;
    return { ...s, rank: isModel ? ++rank : null, vsLeader };
  });
}

export function subject(suiteId: string, key: string): Row | undefined {
  return leaderboard(suiteId).find((r) => r.subject.key === key);
}

/** Merged item results for one subject, trimmed for the replay viewer. */
export function subjectItems(suiteId: string, key: string): ItemResult[] {
  const suite = getSuite(suiteId);
  const items = mergeItems(suiteRuns(suite).filter((r) => r.header.subject.key === key));
  return items
    .map((i) => (i.answer ? { ...i, answer: { ...i.answer, text: i.answer.text.slice(-1500) } } : i))
    .sort((a, b) => a.itemId.localeCompare(b.itemId, "en", { numeric: true }));
}

/** The home page always shows the core suite; other suites are linked from it. */
export function defaultSuite(): string {
  return "core";
}
