"use client";

import Link from "next/link";
import { DitherAvatar } from "@/components/dither-kit";
import { LabLogo } from "@/components/lab-logo";

export function ModelBadge({
  name,
  avatarSeed,
  creator,
  href,
  effort,
  openWeights,
  baseline,
}: {
  name: string;
  avatarSeed: string;
  creator: string;
  href?: string;
  effort?: string;
  openWeights?: boolean;
  baseline?: boolean;
}) {
  const label = (
    <span className="flex items-center gap-2.5">
      {baseline ? (
        <DitherAvatar name={avatarSeed} size={20} animate={false} className="opacity-50" />
      ) : (
        <LabLogo creator={creator} size={18} className="mx-px" />
      )}
      {/* The effort is shown as its own badge, so drop the "(high)" suffix from the name. */}
      <span className={baseline ? "text-muted-foreground italic" : undefined}>
        {effort && effort !== "default" ? name.replace(/\s*\([^)]*\)$/, "") : name}
      </span>
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
