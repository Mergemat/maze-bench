import { generateMaze } from "../generate.ts";
import { DIRS, type Dir, openDirs, openTiles, type Pos, type Tiles } from "../grid.ts";
import { renderAdjacency, renderAscii } from "../render.ts";
import { Rng } from "../rng.ts";
import { LEGEND, type OneShotTask, SYSTEM_ONESHOT } from "./types.ts";

export interface LocalItem {
  tiles: Tiles;
  pos: Pos;
  expected: Dir[];
  degreeClass: "dead_end" | "corridor" | "junction";
}

const CLASSES = ["dead_end", "corridor", "junction"] as const;

function degreeClass(n: number): LocalItem["degreeClass"] {
  if (n <= 1) {
    return "dead_end";
  }
  return n === 2 ? "corridor" : "junction";
}

function sortDirs(dirs: Iterable<Dir>): Dir[] {
  const set = new Set(dirs);
  return DIRS.filter((d) => set.has(d));
}

export const localTask: OneShotTask<LocalItem, Dir[]> = {
  id: "local",
  kind: "oneshot",
  title: "Legal moves",
  ability: "spatial",
  summary: "Read the grid: list the directions you can move from a marked tile.",
  metric: "exact-match accuracy",

  generate({ level, seed, index }) {
    const rng = new Rng(seed);
    const tiles = generateMaze({ cells: level.cells, braid: level.braid }, rng);
    const wanted = CLASSES[index % CLASSES.length] as LocalItem["degreeClass"];
    const all = openTiles(tiles);
    const matching = all.filter((p) => degreeClass(openDirs(tiles, p).length) === wanted);
    const pos = rng.pick(matching.length > 0 ? matching : all);
    const expected = openDirs(tiles, pos);
    return { tiles, pos, expected, degreeClass: degreeClass(expected.length) };
  },

  prompt(item, repr) {
    const question =
      "Which directions can you move one step from your position without walking into a wall? " +
      "Directions are U (up), D (down), L (left) and R (right).\n\n" +
      "List every legal direction, separated by commas, on the final line. For example:\nANSWER: U, R";
    if (repr === "adjacency") {
      return {
        system: SYSTEM_ONESHOT,
        user:
          "Here is a maze given as a list of open tiles. Each line is `(row,col)` followed by its open neighbours. " +
          "Row 0 is the top row and column 0 is the left column. Any tile not listed is a wall.\n\n" +
          `<maze>\n${renderAdjacency(item.tiles)}\n</maze>\n\n` +
          `You are at (${item.pos.r},${item.pos.c}).\n\n${question}`,
      };
    }
    return {
      system: SYSTEM_ONESHOT,
      user:
        `Here is a maze. ${LEGEND} \`@\` is your position.\n\n` +
        `<maze>\n${renderAscii(item.tiles, [{ pos: item.pos, ch: "@" }])}\n</maze>\n\n${question}`,
    };
  },

  parse(content) {
    const tokens = content
      .toLowerCase()
      .replace(/[[\]{}()"'`*.]/g, " ")
      .split(/[\s,;/]+/)
      .filter(Boolean);
    const map: Record<string, Dir> = { u: "U", up: "U", d: "D", down: "D", l: "L", left: "L", r: "R", right: "R" };
    const dirs: Dir[] = [];
    for (const t of tokens) {
      const d = map[t];
      if (!d) {
        return null;
      }
      dirs.push(d);
    }
    return dirs.length > 0 ? sortDirs(dirs) : null;
  },

  score(item, value) {
    const expected = new Set(item.expected);
    const given = new Set(value);
    const intersection = [...given].filter((d) => expected.has(d)).length;
    const union = new Set([...expected, ...given]).size;
    const exact = intersection === expected.size && given.size === expected.size;
    return {
      score: exact ? 1 : 0,
      outcome: exact ? "success" : "wrong_answer",
      metrics: { jaccard: union === 0 ? 1 : intersection / union, degree: item.expected.length },
      trace: { given: sortDirs(value), expected: item.expected },
    };
  },

  baseline(item, kind, rng) {
    if (kind === "oracle") {
      return item.expected;
    }
    if (kind === "heuristic") {
      // The most common answer in a maze is a vertical or horizontal corridor.
      return ["U", "D"];
    }
    const subset = DIRS.filter(() => rng.chance(0.5));
    return subset.length > 0 ? subset : [rng.pick(DIRS)];
  },

  view(item) {
    return { tiles: item.tiles, agent: item.pos };
  },
};
