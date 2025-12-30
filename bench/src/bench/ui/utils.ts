import type { ModelStats } from "./types";

export function pctColor(p: number) {
  if (p >= 80) {
    return "green" as const;
  }
  if (p >= 50) {
    return "yellow" as const;
  }
  return "red" as const;
}

export function pad(str: string, width: number) {
  if (str.length === width) {
    return str;
  }
  if (str.length < width) {
    return str.padEnd(width, " ");
  }
  if (width <= 1) {
    return str.slice(0, width);
  }
  return `${str.slice(0, Math.max(0, width - 1))}…`;
}

export function padLeft(str: string, width: number) {
  if (str.length === width) {
    return str;
  }
  if (str.length < width) {
    return str.padStart(width, " ");
  }
  return str.slice(-width);
}

export function formatValue(
  value: number | null,
  formatter: (v: number) => string
): string {
  return value === null ? "-" : formatter(value);
}

export function formatRowData(
  name: string,
  s: ModelStats | undefined
): {
  model: string;
  tests: string;
  correct: string;
  err: string;
  running: string;
  avgCost: string;
  avgTokens: string;
  avg: string;
  slow: string;
  pct: number | null;
} {
  if (!s) {
    return {
      model: name,
      tests: "0/0",
      correct: "-",
      err: "-",
      running: "-",
      avgCost: "-",
      avgTokens: "-",
      avg: "-",
      slow: "-",
      pct: null,
    };
  }

  const done = s.executedDone;
  const err = s.executedErrors;
  const running = Math.max(0, s.executedStarted - done - err);
  const answered = s.correctCount + s.incorrectCount;
  const pct =
    answered > 0 ? Math.round((s.correctCount / answered) * 100) : null;

  return {
    model: name,
    tests: `${done + err}/${s.total}`,
    correct: pct === null ? "-" : `${pct}%`,
    err: err === 0 ? "-" : String(err),
    running: running === 0 ? "-" : String(running),
    avgCost: formatValue(
      done > 0 ? s.costSum / done : null,
      (v) => `$${v.toFixed(4)}`
    ),
    avgTokens: formatValue(
      done > 0 ? Math.round(s.completionTokensSum / done) : null,
      (v) => v.toLocaleString()
    ),
    avg: formatValue(
      done + err > 0 ? s.durationSumMs / (done + err) / 1000 : null,
      (v) => `${v.toFixed(2)}s`
    ),
    slow: formatValue(
      s.maxDurationMs > 0 ? s.maxDurationMs / 1000 : null,
      (v) => `${v.toFixed(2)}s`
    ),
    pct,
  };
}
