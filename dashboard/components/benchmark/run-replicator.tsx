"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Pos, RunResult } from "@/lib/types";
import { cn } from "@/lib/utils";

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

function LocalVisionRenderer({
  maze,
  currentPos,
  goalPos,
}: {
  maze: string[];
  currentPos: Pos;
  goalPos: Pos;
}) {
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
}

function MazeRenderer({
  maze,
  currentPos,
  goalPos,
  size,
}: {
  maze: string[];
  currentPos: Pos;
  goalPos: Pos;
  size: number;
}) {
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
                  size === 5 && "h-7 w-7 sm:h-12 sm:w-12",
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
}

type RunReplicatorProps = {
  run: RunResult;
  onClose: () => void;
  open: boolean;
};

export function RunReplicator({ run, open, onClose }: RunReplicatorProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentPos =
    currentStep === 0
      ? run.startPos
      : (run.stepsTrace[currentStep - 1]?.posAfter ?? run.startPos);

  const step = useCallback(() => {
    setCurrentStep((s) => {
      if (s >= run.stepsTrace.length) {
        setIsPlaying(false);
        return s;
      }
      return s + 1;
    });
  }, [run.stepsTrace.length]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const interval = setInterval(step, 100);
    return () => clearInterval(interval);
  }, [isPlaying, step]);

  const reset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const currentTraceStep =
    currentStep > 0 ? run.stepsTrace[currentStep - 1] : null;

  return (
    <Dialog onOpenChange={(v) => !v && onClose()} open={open}>
      <DialogContent className="w-fit sm:max-w-5xl">
        <DialogHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-sm">{run.model}</DialogTitle>
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

        <div className="flex flex-col gap-4">
          {/* Maze + Vision */}
          <div className="flex flex-col gap-2">
            <div className="w-fit overflow-auto border p-2">
              <MazeRenderer
                currentPos={currentPos}
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
                <LocalVisionRenderer
                  currentPos={currentPos}
                  goalPos={run.goalPos}
                  maze={run.maze}
                />
              </div>
            )}
          </div>

          {/* Controls + Info */}
          <div className="flex flex-col gap-4">
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
                disabled={currentStep >= run.stepsTrace.length}
                onClick={step}
                size="sm"
                variant="outline"
              >
                Next
              </Button>

              <Button onClick={reset} size="sm" variant="outline">
                Reset
              </Button>
            </div>

            <div className="text-sm">
              <div className="text-muted-foreground">
                Step: {currentStep} / {run.stepsTrace.length}
              </div>

              {currentTraceStep && (
                <div className="mt-2 space-y-1">
                  <div>
                    Action:{" "}
                    <span className="font-mono">{currentTraceStep.action}</span>
                  </div>
                  <div>
                    From: ({currentTraceStep.posBefore.x},{" "}
                    {currentTraceStep.posBefore.y}) → To: (
                    {currentTraceStep.posAfter.x}, {currentTraceStep.posAfter.y}
                    )
                  </div>
                  <div>
                    Move Success:{" "}
                    <Badge
                      variant={
                        currentTraceStep.success ? "default" : "secondary"
                      }
                    >
                      {currentTraceStep.success ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto space-y-1 text-sm">
              <div className="text-muted-foreground">Run Info:</div>
              <div>Total Time: {(run.totalDurationMs / 1000).toFixed(2)}s</div>
              <div>Cost: ${run.cost?.toFixed(6) ?? "N/A"}</div>
              <div>Seed: {run.seed}</div>
            </div>

            {/* {run.modelOutput && ( */}
            {/* 	<div className="text-sm space-y-1"> */}
            {/* 		<div className="text-muted-foreground">Model Output:</div> */}
            {/* 		<div className="font-mono text-xs bg-muted p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap"> */}
            {/* 			{run.modelOutput} */}
            {/* 		</div> */}
            {/* 	</div> */}
            {/* )} */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
