"use client";

import { DitherGradient } from "@/components/dither-kit";

export function FooterWash() {
  return <DitherGradient from="blue" direction="up" opacity={0.35} cell={3} />;
}
