import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Load bench/.env without overriding variables already set in the environment. */
export function loadDotEnv(path = join(import.meta.dir, "..", ".env")): void {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1] as string] === undefined) {
      process.env[match[1] as string] = (match[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

export function gitSha(): string {
  const run = (args: string[]) => Bun.spawnSync(["git", ...args], { cwd: import.meta.dir }).stdout.toString().trim();
  const sha = run(["rev-parse", "--short", "HEAD"]) || "unknown";
  const dirty = run(["status", "--porcelain", "--", "../../packages", "."]).length > 0;
  return dirty ? `${sha}-dirty` : sha;
}

export function aiSdkVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "node_modules", "ai", "package.json"), "utf8"));
    return String(pkg.version);
  } catch {
    return "unknown";
  }
}
