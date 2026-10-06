import { inBounds, type Pos, type Tiles, WALL } from "./grid.ts";

export interface Mark {
  pos: Pos;
  ch: string;
}

/** Full maze as ASCII rows. Later marks win when two share a tile. */
export function renderAscii(tiles: Tiles, marks: readonly Mark[] = []): string {
  const grid = tiles.map((row) => row.split(""));
  for (const m of marks) {
    const row = grid[m.pos.r];
    if (row && m.pos.c >= 0 && m.pos.c < row.length) {
      row[m.pos.c] = m.ch;
    }
  }
  return grid.map((row) => row.join("")).join("\n");
}

/** Square window of side 2*radius+1 centred on `center`. Off-grid tiles render as walls. */
export function localView(tiles: Tiles, center: Pos, marks: readonly Mark[] = [], radius = 1): string {
  const lines: string[] = [];
  for (let dr = -radius; dr <= radius; dr++) {
    let line = "";
    for (let dc = -radius; dc <= radius; dc++) {
      const p = { r: center.r + dr, c: center.c + dc };
      const mark = [...marks].reverse().find((m) => m.pos.r === p.r && m.pos.c === p.c);
      if (mark) {
        line += mark.ch;
      } else if (inBounds(tiles, p)) {
        line += tiles[p.r]?.[p.c] ?? WALL;
      } else {
        line += WALL;
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
}

/** Tiles covered by a local view, used to compute what an observer has seen. */
export function viewTiles(center: Pos, radius = 1): Pos[] {
  const out: Pos[] = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      out.push({ r: center.r + dr, c: center.c + dc });
    }
  }
  return out;
}
