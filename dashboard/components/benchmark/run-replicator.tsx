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
import { cn } from "@/lib/utils";

const PROVIDER_PREFIX_REGEX = /^\[.*?\]/;

/**
 * Formats a model key by removing the provider prefix.
 * e.g., "[openai]gpt-5-default" -> "gpt-5-default"
 */
function formatModelKey(model: string): string {
  return model.replace(PROVIDER_PREFIX_REGEX, "");
}

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
                  size === 5 && "h-6 w-6 sm:h-9 sm:w-9",

                  size === 11 && "h-6 w-6 sm:h-9 sm:w-9",
                  size === 21 && "h-3 w-3 sm:h-5 sm:w-5",
                  size === 31 && "h-1.5 w-1.5 text-xs sm:h-3 sm:w-3"
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
    }, 20);
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
  const _run = useAtomValue(runAtom);

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
        {currentTraceStep?.reasoning && (
          <div className="mt-2">
            <div className="font-semibold text-xs">Reasoning:</div>
            <div className="whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-xs">
              {currentTraceStep.reasoning}
            </div>
          </div>
        )}
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
      <div>Efficiency: {((run.efficiencyScore ?? 0) * 100).toFixed(2)}%</div>
    </div>
  );
};

const RunHeader = function RunHeader({ run }: { run: RunResult }) {
  return (
    <DialogHeader className="flex-row items-center justify-between">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-sm">
          {formatModelKey(run.model)}
        </DialogTitle>
        <div className="flex gap-2">
          <Badge variant="outline">{run.config.complexity}</Badge>
          <Badge variant="outline">
            {run.config.width}x{run.config.height}
          </Badge>
          <Badge variant="outline">{run.config.observationMode}</Badge>
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
