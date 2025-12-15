// const [complexityFilter, setComplexityFilter] = useState<string | null>(null);
// const [sizeFilter, setSizeFilter] = useState<string | null>(null);
// const [visionFilter, setVisionFilter] = useState<string | null>(null);

import { atom } from "jotai";
import type { MazeComplexity, VisionMode } from "@/lib/types";

export const complexityFilterAtom = atom<MazeComplexity | null>(null);
export const sizeFilterAtom = atom<string | null>(null);
export const visionFilterAtom = atom<VisionMode | null>(null);
export const successfulOnlyAtom = atom(false);
