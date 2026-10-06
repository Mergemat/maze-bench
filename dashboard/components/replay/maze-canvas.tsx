"use client";

import { type Pos, posKey } from "@mazebench/core";
import { useEffect, useRef } from "react";
import { BAYER4 } from "@/components/dither-kit/pixel";
import type { Frame, Scene } from "./frames";

// Each tile is a 4x4 block of low-res pixels, scaled up with `image-rendering: pixelated`,
// so walls get the same ordered-dither texture as the charts.
const SUB = 4;
const BLUE: [number, number, number] = [53, 143, 243];
const ORANGE: [number, number, number] = [255, 150, 50];
const GREEN: [number, number, number] = [40, 210, 110];
const RED: [number, number, number] = [240, 70, 70];

function put(img: ImageData, x: number, y: number, [r, g, b]: [number, number, number], a: number) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) {
    return;
  }
  const i = (y * img.width + x) * 4;
  // Alpha-blend over what is already there.
  const k = Math.max(0, Math.min(1, a));
  img.data[i] = Math.round((img.data[i] ?? 0) * (1 - k) + r * k);
  img.data[i + 1] = Math.round((img.data[i + 1] ?? 0) * (1 - k) + g * k);
  img.data[i + 2] = Math.round((img.data[i + 2] ?? 0) * (1 - k) + b * k);
  img.data[i + 3] = Math.min(255, (img.data[i + 3] ?? 0) + Math.round(255 * k));
}

function tileDither(img: ImageData, p: Pos, color: [number, number, number], density: number, alpha: number) {
  for (let dy = 0; dy < SUB; dy++) {
    for (let dx = 0; dx < SUB; dx++) {
      const x = p.c * SUB + dx;
      const y = p.r * SUB + dy;
      const on = density > (BAYER4[y & 3]?.[x & 3] ?? 0.5);
      put(img, x, y, color, on ? alpha : alpha * 0.18);
    }
  }
}

function tileCenter(img: ImageData, p: Pos, color: [number, number, number], alpha: number, size = 2) {
  const off = (SUB - size) / 2;
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      put(img, p.c * SUB + off + dx, p.r * SUB + off + dy, color, alpha);
    }
  }
}

function tileRing(img: ImageData, p: Pos, color: [number, number, number], alpha: number) {
  for (let d = 0; d < SUB; d++) {
    put(img, p.c * SUB + d, p.r * SUB, color, alpha);
    put(img, p.c * SUB + d, p.r * SUB + SUB - 1, color, alpha);
    put(img, p.c * SUB, p.r * SUB + d, color, alpha);
    put(img, p.c * SUB + SUB - 1, p.r * SUB + d, color, alpha);
  }
}

function tileCross(img: ImageData, p: Pos, color: [number, number, number]) {
  for (let d = 0; d < SUB; d++) {
    put(img, p.c * SUB + d, p.r * SUB + d, color, 1);
    put(img, p.c * SUB + SUB - 1 - d, p.r * SUB + d, color, 1);
  }
}

function draw(canvas: HTMLCanvasElement, scene: Scene, frame: Frame, wall: [number, number, number]) {
  const tiles = scene.item.tiles;
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  canvas.width = cols * SUB;
  canvas.height = rows * SUB;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const img = ctx.createImageData(canvas.width, canvas.height);
  const seen = (p: Pos) => !frame.revealed || frame.revealed.has(posKey(p));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = { r, c };
      const isWall = tiles[r]?.[c] !== ".";
      if (isWall) {
        tileDither(img, p, wall, seen(p) ? 0.72 : 0.12, seen(p) ? 0.9 : 0.5);
      } else if (!seen(p)) {
        tileDither(img, p, wall, 0.06, 0.35);
      }
    }
  }
  frame.path.forEach((p, i) => {
    const age = frame.path.length <= 1 ? 1 : i / (frame.path.length - 1);
    tileCenter(img, p, BLUE, 0.35 + 0.55 * age);
  });
  tileRing(img, scene.item.start, GREEN, 1);
  tileDither(img, scene.item.goal, ORANGE, 0.7, 1);
  if (frame.bump) {
    tileCross(img, frame.bump, RED);
  }
  tileCenter(img, frame.agent, BLUE, 1, 4);
  ctx.putImageData(img, 0, 0);
}

export function MazeCanvas({ scene, frame, className }: { scene: Scene; frame: Frame; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const dark = document.documentElement.classList.contains("dark");
    draw(canvas, scene, frame, dark ? [212, 212, 216] : [39, 39, 42]);
  }, [scene, frame]);
  return (
    <canvas
      ref={ref}
      className={`pixelated aspect-square w-full ${className ?? ""}`}
      aria-label="Maze replay"
      role="img"
    />
  );
}
