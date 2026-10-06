export type Dir = "U" | "D" | "L" | "R";

export const DIRS: readonly Dir[] = ["U", "D", "L", "R"];

export const DELTA: Readonly<Record<Dir, { dr: number; dc: number }>> = {
  U: { dr: -1, dc: 0 },
  D: { dr: 1, dc: 0 },
  L: { dr: 0, dc: -1 },
  R: { dr: 0, dc: 1 },
};

export const OPPOSITE: Readonly<Record<Dir, Dir>> = { U: "D", D: "U", L: "R", R: "L" };

/** Clockwise order, used by the wall follower. */
export const CLOCKWISE: readonly Dir[] = ["U", "R", "D", "L"];

export interface Pos {
  r: number;
  c: number;
}

/**
 * A maze is a rectangle of tiles. `#` is a wall and `.` is open.
 * Marks such as S, G and @ are never stored in the grid; renderers add them.
 */
export type Tiles = readonly string[];

export const WALL = "#";
export const OPEN = ".";

export function rows(tiles: Tiles): number {
  return tiles.length;
}

export function cols(tiles: Tiles): number {
  return tiles[0]?.length ?? 0;
}

export function inBounds(tiles: Tiles, p: Pos): boolean {
  return p.r >= 0 && p.c >= 0 && p.r < rows(tiles) && p.c < cols(tiles);
}

export function isOpen(tiles: Tiles, p: Pos): boolean {
  return tiles[p.r]?.[p.c] === OPEN;
}

export function step(p: Pos, dir: Dir): Pos {
  const d = DELTA[dir];
  return { r: p.r + d.dr, c: p.c + d.dc };
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.r === b.r && a.c === b.c;
}

export function posKey(p: Pos): number {
  // Mazes are far below 4096 tiles per side.
  return p.r * 4096 + p.c;
}

/** Directions from p that lead to an open tile, in DIRS order. */
export function openDirs(tiles: Tiles, p: Pos): Dir[] {
  return DIRS.filter((d) => isOpen(tiles, step(p, d)));
}

export function openTiles(tiles: Tiles): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < rows(tiles); r++) {
    for (let c = 0; c < cols(tiles); c++) {
      if (isOpen(tiles, { r, c })) {
        out.push({ r, c });
      }
    }
  }
  return out;
}

export function countOpen(tiles: Tiles): number {
  let n = 0;
  for (const row of tiles) {
    for (const ch of row) {
      if (ch === OPEN) {
        n++;
      }
    }
  }
  return n;
}

/** Turn a sequence of adjacent positions into moves. */
export function movesFromPath(path: readonly Pos[]): Dir[] {
  const moves: Dir[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Pos;
    const b = path[i] as Pos;
    const dir = DIRS.find((d) => samePos(step(a, d), b));
    if (!dir) {
      throw new Error(`movesFromPath: (${a.r},${a.c}) -> (${b.r},${b.c}) is not a single step`);
    }
    moves.push(dir);
  }
  return moves;
}
