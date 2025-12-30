"use client";

import { useAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MazeComplexity, ObservationMode } from "@/lib/types";
import {
  complexityFilterAtom,
  sizeFilterAtom,
  observationModeFilterAtom,
} from "@/store/filters";

type FiltersProps = {
  complexities: string[];
  sizes: string[];
  observationModes: string[];
};

export function Filters({ complexities, sizes, observationModes }: FiltersProps) {
  const [selectedComplexity, setComplexityFilter] =
    useAtom(complexityFilterAtom);
  const [selectedSize, setSizeFilter] = useAtom(sizeFilterAtom);
  const [selectedObservationMode, setObservationModeFilter] = useAtom(observationModeFilterAtom);
  return (
    <div className="flex flex-wrap gap-4 sm:justify-end">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Complexity</span>
        <Select
          onValueChange={(v) =>
            setComplexityFilter(v === "all" ? null : (v as MazeComplexity))
          }
          value={selectedComplexity ?? "all"}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all</SelectItem>
            {complexities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Size</span>
        <Select
          onValueChange={(v) => setSizeFilter(v === "all" ? null : v)}
          value={selectedSize ?? "all"}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all</SelectItem>
            {sizes.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Observation</span>
        <Select
          onValueChange={(v) =>
            setObservationModeFilter(v === "all" ? null : (v as ObservationMode))
          }
          value={selectedObservationMode ?? "all"}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all</SelectItem>
            {observationModes.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
