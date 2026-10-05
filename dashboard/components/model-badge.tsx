"use client";

import Link from "next/link";
import { DitherAvatar } from "@/components/dither-kit";

export function ModelBadge({
  name,
  avatarSeed,
  href,
  effort,
  openWeights,
  baseline,
}: {
  name: string;
  avatarSeed: string;
  href?: string;
  effort?: string;
  openWeights?: boolean;
  baseline?: boolean;
}) {
  const label = (
    <span className="flex items-center gap-2.5">
      <DitherAvatar name={avatarSeed} size={20} animate={false} className={baseline ? "opacity-50" : undefined} />
      <span className={baseline ? "text-muted-foreground italic" : undefined}>{name}</span>
      {effort && effort !== "default" ? (
        <span className="rounded border px-1 font-mono text-[10px] text-muted-foreground">{effort}</span>
      ) : null}
      {openWeights && !baseline ? (
        <span className="rounded border px-1 font-mono text-[10px] text-muted-foreground" title="Open weights">
          open
        </span>
      ) : null}
    </span>
  );
  return href ? (
    <Link href={href} className="transition-colors hover:text-[rgb(150,200,255)]">
      {label}
    </Link>
  ) : (
    label
  );
}
