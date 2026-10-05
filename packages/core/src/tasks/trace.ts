import { placeStartGoal, generateMaze } from "../generate.ts";
import { DIRS, type Dir, isOpen, OPPOSITE, type Pos, step, type Tiles } from "../grid.ts";
import { renderAscii } from "../render.ts";
import { Rng } from "../rng.ts";
import { LEGEND, type OneShotTask, SYSTEM_ONESHOT } from "./types.ts";

export interface TraceItem {
  tiles: Tiles;
  start: Pos;
  moves: Dir[];
  /** 1-based index of the first move into a wall, or 0 if all moves are legal. */
  expected: number;
}

/** Random walk that avoids walls and avoids immediately reversing when it can. */
function walk(tiles: Tiles, from: Pos, length: number, rng: Rng, last?: Dir): { moves: Dir[]; end: Pos } {
  const moves: Dir[] = [];
  let cur = from;
  let prev = last;
  for (let i = 0; i < length; i++) {
    const legal = DIRS.filter((d) => isOpen(tiles, step(cur, d)));
    const forward = legal.filter((d) => !prev || d !== OPPOSITE[prev]);
    const d = rng.pick(forward.length > 0 ? forward : legal);
    moves.push(d);
    cur = step(cur, d);
    prev = d;
  }
  return { moves, end: cur };
}

export const traceTask: OneShotTask<TraceItem, number> = {
  id: "trace",
  kind: "oneshot",
  title: "Path check",
  ability: "spatial",
  summary: "Simulate a given move list on the map and find the first move that hits a wall.",
  metric: "exact-match accuracy",

  generate({ level, seed, index }) {
    const rng = new Rng(seed);
    const tiles = generateMaze({ cells: level.cells, braid: level.braid }, rng);
    const { start } = placeStartGoal(tiles, rng);
    const length = 4 * level.cells;
    if (index % 4 === 0) {
      return { tiles, start, moves: walk(tiles, start, length, rng).moves, expected: 0 };
    }
    // Pick a collision index k, then replace move k with a move into a wall.
    for (let attempt = 0; attempt < 100; attempt++) {
      const k = 1 + rng.int(length);
      const prefix = walk(tiles, start, k - 1, rng);
      const walls = DIRS.filter((d) => !isOpen(tiles, step(prefix.end, d)));
      if (walls.length === 0) {
        continue;
      }
      const bad = rng.pick(walls);
      const suffix = walk(tiles, prefix.end, length - k, rng, prefix.moves.at(-1));
      return { tiles, start, moves: [...prefix.moves, bad, ...suffix.moves], expected: k };
    }
    throw new Error(`trace: could not place a collision for seed ${seed}`);
  },

  prompt(item) {
    const numbered = item.moves.map((m, i) => `${i + 1}.${m}`).join(" ");
    return {
      system: SYSTEM_ONESHOT,
      user:
        `Here is a maze. ${LEGEND} \`S\` is the start.\n\n` +
        `<maze>\n${renderAscii(item.tiles, [{ pos: item.start, ch: "S" }])}\n</maze>\n\n` +
        `A walker starts on S and makes these ${item.moves.length} moves in order ` +
        "(U = up, D = down, L = left, R = right):\n\n" +
        `${numbered}\n\n` +
        "Which move is the first one that would walk into a wall? Give its number. " +
        "If every move is legal, answer 0.\n\nFor example:\nANSWER: 7",
    };
  },

  parse(content) {
    if (/\b(none|no collision|all legal)\b/i.test(content)) {
      return 0;
    }
    const match = /-?\d+/.exec(content);
    return match ? Number.parseInt(match[0], 10) : null;
  },

  score(item, value) {
    const ok = value === item.expected;
    return {
      score: ok ? 1 : 0,
      outcome: ok ? "success" : "wrong_answer",
      metrics: { expected: item.expected, given: value, moves: item.moves.length },
      trace: { given: value },
    };
  },

  baseline(item, kind, rng) {
    if (kind === "oracle") {
      return item.expected;
    }
    if (kind === "heuristic") {
      return 0;
    }
    return rng.int(item.moves.length + 1);
  },

  view(item) {
    return { tiles: item.tiles, start: item.start };
  },
};
