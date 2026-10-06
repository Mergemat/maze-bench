import { DIRS, isOpen, type Pos, posKey, step, type Tiles } from "./grid.ts";

export type Passable = (p: Pos) => boolean;

/** BFS distances from `from`. Unreachable tiles are absent from the map. */
export function bfsDistances(tiles: Tiles, from: Pos, passable?: Passable): Map<number, number> {
  const canEnter = passable ?? ((p: Pos) => isOpen(tiles, p));
  const dist = new Map<number, number>([[posKey(from), 0]]);
  const queue: Pos[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as Pos;
    const d = dist.get(posKey(cur)) as number;
    for (const dir of DIRS) {
      const next = step(cur, dir);
      const key = posKey(next);
      if (!dist.has(key) && canEnter(next)) {
        dist.set(key, d + 1);
        queue.push(next);
      }
    }
  }
  return dist;
}

/**
 * Shortest path from `from` to `to` as a list of positions including both ends,
 * or null if unreachable. Ties break by DIRS order, so the result is deterministic.
 */
export function shortestPath(tiles: Tiles, from: Pos, to: Pos, passable?: Passable): Pos[] | null {
  const canEnter = passable ?? ((p: Pos) => isOpen(tiles, p));
  const parent = new Map<number, Pos | null>([[posKey(from), null]]);
  const queue: Pos[] = [from];
  const target = posKey(to);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as Pos;
    if (posKey(cur) === target) {
      const path: Pos[] = [];
      let node: Pos | null = cur;
      while (node) {
        path.push(node);
        node = parent.get(posKey(node)) ?? null;
      }
      return path.reverse();
    }
    for (const dir of DIRS) {
      const next = step(cur, dir);
      const key = posKey(next);
      if (!parent.has(key) && canEnter(next)) {
        parent.set(key, cur);
        queue.push(next);
      }
    }
  }
  return null;
}

export function shortestDistance(tiles: Tiles, from: Pos, to: Pos, passable?: Passable): number | null {
  const path = shortestPath(tiles, from, to, passable);
  return path ? path.length - 1 : null;
}
