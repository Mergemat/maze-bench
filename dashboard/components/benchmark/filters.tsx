"use client";

import { useAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MazeComplexity, VisionMode } from "@/lib/types";
import {
  complexityFilterAtom,
  sizeFilterAtom,
  visionFilterAtom,
} from "@/store/filters";

type FiltersProps = {
  complexities: string[];
  sizes: string[];
  visions: string[];
};

export function Filters({ complexities, sizes, visions }: FiltersProps) {
  const [selectedComplexity, setComplexityFilter] =
    useAtom(complexityFilterAtom);
  const [selectedSize, setSizeFilter] = useAtom(sizeFilterAtom);
  const [selectedVision, setVisionFilter] = useAtom(visionFilterAtom);
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
            <SelectItem value="all">All</SelectItem>
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
            <SelectItem value="all">All</SelectItem>
            {sizes.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Vision</span>
        <Select
          onValueChange={(v) =>
            setVisionFilter(v === "all" ? null : (v as VisionMode))
          }
          value={selectedVision ?? "all"}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {visions.map((v) => (
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
