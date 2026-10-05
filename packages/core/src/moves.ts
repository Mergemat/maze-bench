import { type Dir, isOpen, type Pos, samePos, step, type Tiles } from "./grid.ts";

export interface Execution {
  /** Positions visited, starting with the start position. */
  positions: Pos[];
  /** 1-based index of the first move into a wall, or null. Execution stops there. */
  firstInvalid: number | null;
  /** Number of moves taken when the goal was first reached, or null. Execution stops there. */
  reachedGoalAt: number | null;
  end: Pos;
}

export function executeMoves(tiles: Tiles, start: Pos, moves: readonly Dir[], goal?: Pos): Execution {
  const positions: Pos[] = [start];
  let cur = start;
  if (goal && samePos(start, goal)) {
    return { positions, firstInvalid: null, reachedGoalAt: 0, end: cur };
  }
  for (let i = 0; i < moves.length; i++) {
    const next = step(cur, moves[i] as Dir);
    if (!isOpen(tiles, next)) {
      return { positions, firstInvalid: i + 1, reachedGoalAt: null, end: cur };
    }
    cur = next;
    positions.push(cur);
    if (goal && samePos(cur, goal)) {
      return { positions, firstInvalid: null, reachedGoalAt: i + 1, end: cur };
    }
  }
  return { positions, firstInvalid: null, reachedGoalAt: null, end: cur };
}

const WORDS: Record<string, Dir> = {
  u: "U",
  up: "U",
  n: "U",
  north: "U",
  d: "D",
  down: "D",
  s: "D",
  south: "D",
  l: "L",
  left: "L",
  w: "L",
  west: "L",
  r: "R",
  right: "R",
  e: "R",
  east: "R",
};

/**
 * Parse a move list such as "R R D", "right, right, down", "[R,R,D]" or "RRD".
 * Returns null if any token is not a direction. An empty answer parses to [].
 */
export function parseMoves(text: string): Dir[] | null {
  const cleaned = text
    .replace(/[[\]{}()"'`*]/g, " ")
    .replace(/[,;:.|>→-]+/g, " ")
    .trim()
    .toLowerCase();
  if (cleaned === "" || cleaned === "none") {
    return [];
  }
  const tokens = cleaned.split(/\s+/);
  const out: Dir[] = [];
  for (const token of tokens) {
    const word = WORDS[token];
    if (word) {
      out.push(word);
      continue;
    }
    // Compact form like "RRDDL".
    if (/^[udlr]+$/.test(token)) {
      for (const ch of token) {
        out.push(WORDS[ch] as Dir);
      }
      continue;
    }
    return null;
  }
  return out;
}

/** Cancel adjacent opposite moves (U D, L R) until none remain. */
export function freeReduce(moves: readonly Dir[]): Dir[] {
  const out: Dir[] = [];
  const opposite: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
  for (const m of moves) {
    if (out.length > 0 && out.at(-1) === opposite[m]) {
      out.pop();
    } else {
      out.push(m);
    }
  }
  return out;
}

export function reverseMoves(moves: readonly Dir[]): Dir[] {
  const opposite: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
  return [...moves].reverse().map((m) => opposite[m]);
}
