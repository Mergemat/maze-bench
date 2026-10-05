import {
  type Dir,
  type ItemResult,
  type MazeItem,
  type Pos,
  posKey,
  replayLog,
  step,
  type TaskId,
  viewTiles,
} from "@mazebench/core";

/** One picture of a replay. Positions are tile coordinates. */
export interface Frame {
  agent: Pos;
  /** Tiles walked so far. */
  path: Pos[];
  /** Tiles the agent has seen. Undefined means the whole map is visible. */
  revealed?: Set<number>;
  /** A move into a wall, drawn on the wall tile it tried to enter. */
  bump?: Pos;
}

export interface Scene {
  item: MazeItem;
  frames: Frame[];
  success: boolean;
}

/** Frames for one attempt: one per move, with fog revealing tiles as they come into view. */
export function buildScene(mode: TaskId, item: MazeItem, result: ItemResult): Scene {
  const log = String(result.trace?.moves ?? "")
    .split("")
    .filter(Boolean) as Dir[];
  const { positions, blocked } = replayLog(item, log);
  const seen = new Set<number>();
  const path: Pos[] = [];
  const frames = positions.map((p, i) => {
    if (mode === "fog") {
      for (const t of viewTiles(p)) {
        seen.add(posKey(t));
      }
    }
    const wasBlocked = i > 0 && blocked[i - 1];
    if (!wasBlocked) {
      path.push(p);
    }
    const prev = positions[i - 1];
    return {
      agent: p,
      path: [...path],
      ...(mode === "fog" ? { revealed: new Set(seen) } : {}),
      ...(wasBlocked && prev ? { bump: step(prev, log[i - 1] as Dir) } : {}),
    };
  });
  return { item, frames, success: result.score >= 1 };
}
