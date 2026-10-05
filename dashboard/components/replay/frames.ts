import {
  type Dir,
  executeMoves,
  type FogItem,
  type ItemResult,
  knownTiles,
  type LocalItem,
  type PlanItem,
  type Pos,
  posKey,
  type RecallItem,
  replayFog,
  shortestPath,
  step,
  type Tiles,
  type TraceItem,
  tourPositions,
  viewTiles,
} from "@mazebench/core";

/** One picture of the replay. Positions are tile coordinates. */
export interface Frame {
  agent?: Pos;
  /** The model's own moves so far. */
  path: Pos[];
  /** Context drawn underneath: the optimal route, or the walk the model was shown. */
  ghost: Pos[];
  /** Tiles the agent has seen. Undefined means everything is visible. */
  revealed?: Set<number>;
  /** A move into a wall: drawn on the wall tile it tried to enter. */
  bump?: Pos;
  /** Tiles to outline (e.g. the expected legal moves in `local`). */
  highlight?: Pos[];
  caption: string;
}

export interface Scene {
  tiles: Tiles;
  start?: Pos;
  goal?: Pos;
  frames: Frame[];
}

const DIR_NAME: Record<Dir, string> = { U: "up", D: "down", L: "left", R: "right" };

function prefixFrames(
  path: Pos[],
  base: Omit<Frame, "path" | "agent" | "caption">,
  label: (i: number) => string,
): Frame[] {
  return path.map((p, i) => ({ ...base, path: path.slice(0, i + 1), agent: p, caption: label(i) }));
}

export function buildScene(task: string, item: unknown, result: ItemResult): Scene {
  const trace = (result.trace ?? {}) as Record<string, unknown>;

  if (task === "local") {
    const it = item as LocalItem;
    const given = (trace.given as Dir[] | undefined) ?? [];
    return {
      tiles: it.tiles,
      frames: [
        {
          agent: it.pos,
          path: [it.pos],
          ghost: [],
          highlight: it.expected.map((d) => step(it.pos, d)),
          caption: `Legal moves: ${it.expected.join(", ")}. Model answered: ${given.length > 0 ? given.join(", ") : "nothing parseable"}.`,
        },
      ],
    };
  }

  if (task === "trace") {
    const it = item as TraceItem;
    const run = executeMoves(it.tiles, it.start, it.moves);
    const given = typeof trace.given === "number" ? trace.given : null;
    const frames = prefixFrames(run.positions, { ghost: [] }, (i) =>
      i === 0 ? "Start. The walker follows the listed moves." : `Move ${i}: ${DIR_NAME[it.moves[i - 1] as Dir]}`,
    );
    const last = run.positions.at(-1) as Pos;
    frames.push({
      path: run.positions,
      ghost: [],
      agent: last,
      ...(run.firstInvalid ? { bump: step(last, it.moves[run.firstInvalid - 1] as Dir) } : {}),
      caption: `First wall hit: ${it.expected === 0 ? "none (all legal)" : `move ${it.expected}`}. Model answered: ${given ?? "nothing parseable"}.`,
    });
    return { tiles: it.tiles, start: it.start, frames };
  }

  if (task === "plan") {
    const it = item as PlanItem;
    const path = (trace.path as Pos[] | undefined) ?? [it.start];
    const optimal = shortestPath(it.tiles, it.start, it.goal) ?? [];
    const frames = prefixFrames(
      path,
      { ghost: optimal },
      (i) => `Step ${i} of the model's route (${path.length - 1} moves)`,
    );
    const firstInvalid = trace.firstInvalid as number | null | undefined;
    if (firstInvalid && result.answer && Array.isArray(result.answer.value)) {
      const last = path.at(-1) as Pos;
      const dir = (result.answer.value as Dir[])[firstInvalid - 1];
      frames.push({
        path,
        ghost: optimal,
        agent: last,
        ...(dir ? { bump: step(last, dir) } : {}),
        caption: `Move ${firstInvalid} walks into a wall. Optimal route: ${optimal.length - 1} moves.`,
      });
    } else {
      frames.push({
        path,
        ghost: optimal,
        agent: path.at(-1) as Pos,
        caption: `${result.outcome === "success" ? "Reached G" : "Stopped before G"} in ${path.length - 1} moves. Optimal: ${optimal.length - 1}.`,
      });
    }
    return { tiles: it.tiles, start: it.start, goal: it.goal, frames };
  }

  if (task === "recall") {
    const it = item as RecallItem;
    const tour = tourPositions(it);
    const seen = new Set<number>();
    const frames: Frame[] = tour.map((p, i) => {
      for (const t of viewTiles(p)) {
        seen.add(posKey(t));
      }
      return {
        agent: p,
        path: [],
        ghost: tour.slice(0, i + 1),
        revealed: new Set(seen),
        caption:
          i === 0
            ? "The walk the model reads, with its 3×3 views"
            : `Walk, move ${i}: ${DIR_NAME[it.tour[i - 1] as Dir]}`,
      };
    });
    const known = knownTiles(it);
    const back = (trace.path as Pos[] | undefined) ?? [it.end];
    back.forEach((p, i) => {
      frames.push({
        agent: p,
        path: back.slice(0, i + 1),
        ghost: tour,
        revealed: known,
        caption: `Model's way back, move ${i} of ${back.length - 1}. Best known route: ${it.optimal}.`,
      });
    });
    return { tiles: it.tiles, start: it.start, frames };
  }

  // fog
  const it = item as FogItem;
  const log = String(trace.moves ?? "")
    .split("")
    .filter(Boolean) as Dir[];
  const { positions, blocked } = replayFog(it.tiles, it.start, log);
  const seen = new Set<number>();
  const visited: Pos[] = [];
  const frames: Frame[] = positions.map((p, i) => {
    for (const t of viewTiles(p)) {
      seen.add(posKey(t));
    }
    if (i === 0 || !blocked[i - 1]) {
      visited.push(p);
    }
    const prev = positions[i - 1];
    const wasBlocked = i > 0 && blocked[i - 1];
    return {
      agent: p,
      path: [...visited],
      ghost: [],
      revealed: new Set(seen),
      ...(wasBlocked && prev ? { bump: step(prev, log[i - 1] as Dir) } : {}),
      caption:
        i === 0
          ? "Start: the model sees only the 3×3 area around it"
          : `Move ${i}/${it.budget}: ${DIR_NAME[log[i - 1] as Dir]}${wasBlocked ? " (blocked)" : ""}`,
    };
  });
  return { tiles: it.tiles, start: it.start, goal: it.goal, frames };
}
