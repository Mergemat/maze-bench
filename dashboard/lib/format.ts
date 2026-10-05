export const pct = (x: number | undefined | null, digits = 1): string =>
  x === undefined || x === null || !Number.isFinite(x) ? "–" : (100 * x).toFixed(digits);

export function usd(x: number, complete = true): string {
  const prefix = complete ? "" : "≥";
  if (x === 0) {
    return "$0";
  }
  if (x < 0.01) {
    return `${prefix}$${x.toFixed(4)}`;
  }
  return `${prefix}$${x < 10 ? x.toFixed(2) : x.toFixed(0)}`;
}

export function compact(n: number): string {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function seconds(ms: number): string {
  return Number.isFinite(ms) ? `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s` : "–";
}

/** URL-safe form of a subject key: `gpt-6-luna@high` -> `gpt-6-luna~high`. */
export const slug = (key: string): string => key.replace(/@/g, "~");
export const unslug = (s: string): string => decodeURIComponent(s).replace(/~/g, "@");
