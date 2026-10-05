import { BENCH_NAME, BENCH_REPO } from "@mazebench/core";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FooterWash } from "@/components/footer-wash";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BENCH_NAME}: spatial reasoning, memory and planning in text mazes`,
  description:
    "A procedurally generated LLM benchmark with five maze tasks that separate grid reading, path simulation, planning, route memory and interactive navigation. Confidence intervals, baselines and cost on every score.",
};

const NAV = [
  { href: "/", label: "Leaderboard" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col font-sans">
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
            <Link href="/" className="font-pixel text-lg tracking-tight">
              {BENCH_NAME}
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="transition-colors hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
            <a
              href={BENCH_REPO}
              className="ml-auto font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
            >
              GitHub ↗
            </a>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">{children}</main>
        <footer className="relative mt-16 overflow-hidden border-t">
          <FooterWash />
          <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-10 text-muted-foreground text-xs">
            <span className="font-pixel text-foreground">{BENCH_NAME} v2</span>
            <span>Procedurally generated text mazes. Scores carry 95% bootstrap intervals.</span>
            <span className="ml-auto">Results schema 2.0.0 · MIT</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
