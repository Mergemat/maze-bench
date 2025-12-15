"use client";

import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { type ReactElement, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Pos, RunResult } from "@/lib/types";
import { cn, formatModelName } from "@/lib/utils";

const runAtom = atom<RunResult | null>(null);
const currentStepAtom = atom(0);
const isPlayingAtom = atom(false);

const currentPosAtom = atom((get) => {
  const run = get(runAtom);
  const currentStep = get(currentStepAtom);
  if (!run) {
    return { x: 0, y: 0 };
  }
  return currentStep === 0
    ? run.startPos
    : (run.stepsTrace[currentStep - 1]?.posAfter ?? run.startPos);
});

const currentTraceStepAtom = atom((get) => {
  const run = get(runAtom);
  const currentStep = get(currentStepAtom);
  if (!run || currentStep === 0) {
    return null;
  }
  return run.stepsTrace[currentStep - 1] ?? null;
});

function getLocalVision(maze: string[], pos: Pos, radius = 2): string[][] {
  const out: string[][] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const row: string[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      const x = pos.x + dx;
      const y = pos.y + dy;
      if (dx === 0 && dy === 0) {
        row.push("A");
      } else {
        row.push(maze[y]?.[x] ?? "#");
      }
    }
    out.push(row);
  }
  return out;
}

const LocalVisionRenderer = function LocalVisionRenderer({
  maze,
  goalPos,
}: {
  maze: string[];
  goalPos: Pos;
}) {
  const currentPos = useAtomValue(currentPosAtom);
  const localView = getLocalVision(maze, currentPos);
  const radius = 2;

  return (
    <div className="select-none font-mono text-xs leading-none">
      {localView.map((row, dy) => (
        <div className="flex" key={dy}>
          {row.map((cell, dx) => {
            const isCenter = dx === radius && dy === radius;
            const worldX = currentPos.x + dx - radius;
            const worldY = currentPos.y + dy - radius;
            const isGoal = goalPos.x === worldX && goalPos.y === worldY;

            let bg = "bg-transparent";
            let text = "text-muted-foreground";

            if (cell === "#") {
              bg = "bg-foreground";
              text = "text-foreground";
            } else if (isCenter) {
              bg = "bg-primary";
              text = "text-primary-foreground";
            } else if (isGoal) {
              bg = "bg-green-500";
              text = "text-white";
            }

            return (
              <span
                className={`flex h-5 w-5 items-center justify-center ${bg} ${text}`}
                key={dx}
              >
                {isCenter
                  ? "●"
                  : isGoal && cell === "G"
                    ? "G"
                    : cell === "#"
                      ? ""
                      : cell === " "
                        ? ""
                        : cell}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const MazeRenderer = function MazeRenderer({
  maze,
  goalPos,
  size,
}: {
  maze: string[];
  goalPos: Pos;
  size: number;
}) {
  const currentPos = useAtomValue(currentPosAtom);

  return (
    <div className="select-none font-mono text-xs leading-none">
      {maze.map((row, y) => (
        <div className="flex" key={y}>
          {row.split("").map((cell, x) => {
            const isCurrentPos = currentPos.x === x && currentPos.y === y;
            const isGoal = goalPos.x === x && goalPos.y === y;

            let bg = "bg-transparent";
            let text = "text-muted-foreground";

            if (cell === "#") {
              bg = "bg-foreground";
              text = "text-foreground";
            } else if (isCurrentPos) {
              bg = "bg-primary";
              text = "text-primary-foreground";
            } else if (isGoal) {
              bg = "bg-green-500";
              text = "text-white";
            }

            return (
              <span
                className={cn(
                  "flex items-center justify-center",
                  bg,
                  text,
                  size === 7 && "h-7 w-7 sm:h-12 sm:w-12",
                  size === 21 && "h-3 w-3 sm:h-5 sm:w-5",
                  size === 41 && "h-1.5 w-1.5 text-xs sm:h-2 sm:w-2"
                )}
                key={x}
              >
                {isCurrentPos
                  ? "●"
                  : isGoal && cell === "G"
                    ? "G"
                    : cell === "#"
                      ? ""
                      : cell === " "
                        ? ""
                        : cell}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

function ReplicatorControls({ totalSteps }: { totalSteps: number }) {
  const [currentStep, setCurrentStep] = useAtom(currentStepAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const interval = setInterval(() => {
      setCurrentStep((s) => {
        if (s >= totalSteps) {
          setIsPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, totalSteps, setCurrentStep, setIsPlaying]);

  const reset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  return (
    <div className="flex gap-2">
      <Button
        disabled={currentStep === 0}
        onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
        size="sm"
        variant="outline"
      >
        Prev
      </Button>
      <Button
        onClick={() => setIsPlaying(!isPlaying)}
        size="sm"
        variant={isPlaying ? "destructive" : "default"}
      >
        {isPlaying ? "Pause" : "Play"}
      </Button>
      <Button
        disabled={currentStep >= totalSteps}
        onClick={() => setCurrentStep((s) => Math.min(totalSteps, s + 1))}
        size="sm"
        variant="outline"
      >
        Next
      </Button>
      <Button onClick={reset} size="sm" variant="outline">
        Reset
      </Button>
    </div>
  );
}

function StepInfo({ totalSteps }: { totalSteps: number }) {
  const currentStep = useAtomValue(currentStepAtom);
  const currentTraceStep = useAtomValue(currentTraceStepAtom);

  return (
    <div className="text-sm">
      <div className="text-muted-foreground">
        Step: {currentStep} / {totalSteps}
      </div>
      <div className="mt-2 space-y-1">
        <div>
          Action: <span className="font-mono">{currentTraceStep?.action}</span>
        </div>
        <div>
          From: ({currentTraceStep?.posBefore.x},{" "}
          {currentTraceStep?.posBefore.y}) → To: ({currentTraceStep?.posAfter.x}
          , {currentTraceStep?.posAfter.y})
        </div>
        <div>
          Move Success:{" "}
          <Badge variant={currentTraceStep?.success ? "default" : "secondary"}>
            {currentTraceStep?.success ? "Yes" : "No"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

const RunInfo = function RunInfo({ run }: { run: RunResult }) {
  return (
    <div className="mt-auto space-y-1 text-sm">
      <div className="text-muted-foreground">Run Info:</div>
      <div>Total Time: {(run.totalDurationMs / 1000).toFixed(2)}s</div>
      <div>Cost: ${run.cost?.toFixed(6) ?? "N/A"}</div>
      <div>Seed: {run.seed}</div>
      {run.modelOutput}
    </div>
  );
};

const RunHeader = function RunHeader({ run }: { run: RunResult }) {
  return (
    <DialogHeader className="flex-row items-center justify-between">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-sm">{formatModelName(run.model)}</DialogTitle>
        <div className="flex gap-2">
          <Badge variant="outline">{run.config.complexity}</Badge>
          <Badge variant="outline">
            {run.config.width}x{run.config.height}
          </Badge>
          <Badge variant="outline">{run.config.vision}</Badge>
          <Badge variant={run.success ? "default" : "destructive"}>
            {run.success ? "Success" : "Failed"}
          </Badge>
        </div>
      </div>
    </DialogHeader>
  );
};

type RunReplicatorProps = {
  run: RunResult;
  children: ReactElement;
};

export function RunReplicator({ run, children }: RunReplicatorProps) {
  const setRun = useSetAtom(runAtom);
  const setCurrentStep = useSetAtom(currentStepAtom);
  const setIsPlaying = useSetAtom(isPlayingAtom);

  const init = () => {
    setRun(run);
    setCurrentStep(0);
    setIsPlaying(false);
  };

  return (
    <Dialog onOpenChange={() => init()}>
      <DialogTrigger render={children} />
      <DialogContent className="w-fit sm:max-w-5xl">
        <RunHeader run={run} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="w-fit overflow-auto border p-2">
              <MazeRenderer
                goalPos={run.goalPos}
                maze={run.maze}
                size={run.config.width}
              />
            </div>
            {run.config.vision === "local" && (
              <div className="w-fit border p-2">
                <div className="mb-1 text-muted-foreground text-xs">
                  Model View (5x5)
                </div>
                <LocalVisionRenderer goalPos={run.goalPos} maze={run.maze} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <ReplicatorControls totalSteps={run.stepsTrace.length} />
            <StepInfo totalSteps={run.stepsTrace.length} />
            <RunInfo run={run} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
