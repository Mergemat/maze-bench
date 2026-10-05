export type ParseStatus = "ok" | "fallback" | "failed";

/**
 * Pull the answer out of a model reply. The prompt asks for a final line `ANSWER: ...`.
 * We take the last such line. If there is none, the last non-empty line is used and the
 * parse is marked `fallback`, so format slips are visible in the results.
 */
export function extractAnswer(text: string): { content: string; status: "ok" | "fallback" } | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[*_`#>]/g, "").trim())
    .filter((l) => l.length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = /\banswer\s*[:=]\s*(.*)$/i.exec(lines[i] as string);
    if (match) {
      return { content: (match[1] ?? "").trim(), status: "ok" };
    }
  }
  const last = lines.at(-1);
  return last === undefined ? null : { content: last, status: "fallback" };
}
