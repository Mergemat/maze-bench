import { generateSharedMazes } from "./maze";
import type { MazeData } from "./types";
import type { SuiteChoice } from "./ui/types";

/**
 * TODO: Replace this with whatever “suites” mean for you:
 * - different maze counts
 * - different generators
 * - different seed lists
 * - etc.
 */
export function getSuites(): SuiteChoice[] {
  return [
    {
      id: "default",
      name: "Default mazes",
      description: "Shared mazes from generateSharedMazes()",
    },
    // { id: "hard", name: "Hard set", description: "More steps / bigger mazes" },
  ];
}

/**
 * TODO: If suite affects maze generation, implement it here.
 */
export function generateMazesForSuite(_suite: SuiteChoice): MazeData[] {
  return generateSharedMazes();
}
