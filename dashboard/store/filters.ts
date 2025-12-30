// const [complexityFilter, setComplexityFilter] = useState<string | null>(null);
// const [sizeFilter, setSizeFilter] = useState<string | null>(null);
// const [observationModeFilter, setObservationModeFilter] = useState<string | null>(null);

import { atom } from "jotai";
import type { MazeComplexity, ObservationMode } from "@/lib/types";

export const complexityFilterAtom = atom<MazeComplexity | null>(null);
export const sizeFilterAtom = atom<string | null>(null);
export const observationModeFilterAtom = atom<ObservationMode | null>(null);
export const successfulOnlyAtom = atom(false);
