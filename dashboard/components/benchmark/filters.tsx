"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FiltersProps = {
  complexities: string[];
  sizes: string[];
  visions: string[];
  selectedComplexity: string | null;
  selectedSize: string | null;
  selectedVision: string | null;
  onComplexityChange: (value: string | null) => void;
  onSizeChange: (value: string | null) => void;
  onVisionChange: (value: string | null) => void;
};

export function Filters({
  complexities,
  sizes,
  visions,
  selectedComplexity,
  selectedSize,
  selectedVision,
  onComplexityChange,
  onSizeChange,
  onVisionChange,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 sm:justify-end">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Complexity</span>
        <Select
          onValueChange={(v) => onComplexityChange(v === "all" ? null : v)}
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
          onValueChange={(v) => onSizeChange(v === "all" ? null : v)}
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
          onValueChange={(v) => onVisionChange(v === "all" ? null : v)}
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
