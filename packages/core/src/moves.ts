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
