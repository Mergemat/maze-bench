"use client";

import { useEffect, useRef } from "react";
import { CELL, paintColumn } from "@/components/dither-kit/dither-paint";
import { rgb } from "@/components/dither-kit/palette";
import { fillOf, type PixelColor, pixelBloomStyle, pixelPrefersReducedMotion } from "@/components/dither-kit/pixel";

export interface DitherSeries {
  key: string;
  color: PixelColor;
  /** Points in plot coordinates (same units as width/height), in the order the line visits them. */
  points: { x: number; y: number }[];
}

/**
 * The dithered part of the chart, painted with dither-kit's own engine: each series is a line
 * with dither-kit's ordered-dither area fading down from it, on a low-res canvas scaled up
 * pixelated, plus a blurred copy for bloom. Axes and labels stay in SVG on top.
 */
export function DitherPlot({
  series,
  width,
  height,
  hovered,
}: {
  series: DitherSeries[];
  width: number;
  height: number;
  hovered: string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);
  const progress = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const cols = Math.round(width / CELL);
    const rows = Math.round(height / CELL);
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const paint = (reveal: number) => {
      ctx.clearRect(0, 0, cols, rows);
      const limit = reveal * cols;
      for (const s of series) {
        const seed = { fill: fillOf(s.color), line: fillOf(s.color), star: fillOf(s.color) };
        const isHover = hovered === s.key;
        const faded = hovered !== null && !isHover;
        // Areas are a faint wash so overlapping models stay readable; lines carry the data.
        const area = faded ? 0.03 : isHover ? 0.35 : 0.12;
        const line = faded ? 0.15 : 1;
        const pts = s.points.map((p) => ({ x: p.x / CELL, y: p.y / CELL }));
        // Area: one dithered column per backing pixel between consecutive points.
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1] as { x: number; y: number };
          const b = pts[i] as { x: number; y: number };
          // Segments can run right-to-left when a lower effort costs more; fill the span either way.
          const [l, r] = a.x <= b.x ? [a, b] : [b, a];
          for (let x = Math.round(l.x); x <= Math.round(r.x) && x <= limit; x++) {
            const t = r.x === l.x ? 1 : (x - l.x) / (r.x - l.x);
            paintColumn(ctx, x, l.y + (r.y - l.y) * t, rows, seed, {
              variant: "gradient",
              intensity: 0,
              dim: area,
              stacked: false,
              sparse: isHover ? 0.2 : 0.45,
            });
          }
        }
        // Line: solid cells along each segment so steep segments have no gaps.
        ctx.fillStyle = rgb(seed.fill, 1, line * 0.9);
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1] as { x: number; y: number };
          const b = pts[i] as { x: number; y: number };
          const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
          for (let k = 0; k <= n; k++) {
            const x = a.x + ((b.x - a.x) * k) / n;
            if (x <= limit) {
              ctx.fillRect(Math.round(x), Math.round(a.y + ((b.y - a.y) * k) / n), 1, 1);
            }
          }
        }
        // Points: 3x3 blocks with a dark centre cell, dither-kit's dot look.
        for (const p of pts) {
          if (p.x > limit) {
            continue;
          }
          ctx.fillStyle = rgb(seed.fill, 1, line);
          ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
        }
      }
      const bloom = bloomRef.current;
      const bctx = bloom?.getContext("2d");
      if (bloom && bctx) {
        bloom.width = cols;
        bloom.height = rows;
        bctx.drawImage(canvas, 0, 0);
      }
    };

    if (progress.current >= 1 || pixelPrefersReducedMotion()) {
      progress.current = 1;
      paint(1);
      return;
    }
    // Entrance: reveal left to right, like the dither-kit charts.
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      progress.current = Math.min(1, (now - start) / 700);
      paint(1 - (1 - progress.current) ** 3);
      if (progress.current < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [series, width, height, hovered]);

  const bloom = pixelBloomStyle("low");
  return (
    <div aria-hidden="true" className="absolute inset-0">
      {bloom ? (
        <canvas ref={bloomRef} className="pointer-events-none absolute inset-0 size-full" style={bloom} />
      ) : null}
      <canvas ref={ref} className="pixelated pointer-events-none absolute inset-0 size-full" />
    </div>
  );
}
