import {random} from 'remotion';
import {ditherFill} from '../../../shared/PixelCanvas';
import type {PaletteA} from '../../../shared/palette';

// Story terrains for the action scenes. Drawn on a low-res canvas of
// w x 320 art px (1 art px = 6 screen px); w can exceed 180 so the camera can
// travel along a wide set (runway, street, tunnel…). Returns false when the
// kind is unknown.

type Ctx = CanvasRenderingContext2D;

const fill = (ctx: Ctx, c: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

// Crowd in tiered stands: rows of heads with a few flashes (photographers).
const stands = (ctx: Ctx, pal: PaletteA, w: number, y0: number, y1: number, t: number, seed: string) => {
  for (let y = y0; y < y1; y++) fill(ctx, (y - y0) / (y1 - y0) < 0.5 ? pal.plum : pal.plum2, 0, y, w, 1);
  for (let y = y0 + 3; y < y1 - 2; y += 5) {
    fill(ctx, pal.bg, 0, y + 3, w, 1); // step shadow
    for (let x = ((y / 5) % 2) * 2; x < w; x += 4) {
      const r = random(`${seed}-fan-${x}-${y}`);
      if (r < 0.3) continue;
      const flash = random(`${seed}-fl-${x}-${y}-${Math.floor(t * 4)}`) > 0.996;
      // crowd stays dark so the action in front reads clearly
      fill(ctx, flash ? pal.white : r > 0.97 ? pal.accentDark : r > 0.8 ? pal.mid1 : pal.plum2, x, y, 2, 2);
    }
  }
};

const floodlight = (ctx: Ctx, pal: PaletteA, x: number, y: number) => {
  fill(ctx, pal.mid1, x, y, 2, 70);
  fill(ctx, pal.mid2, x - 7, y - 6, 16, 7);
  for (let i = 0; i < 4; i++) fill(ctx, pal.paper, x - 6 + i * 4, y - 5, 3, 3);
  ditherFill(ctx, x - 40, y + 2, 80, 90, pal.plum2, (xx, yy) => 0.55 - Math.abs(xx - x) / 70 - (yy - y) / 160);
};

export const drawStoryTerrain = (ctx: Ctx, kind: string, t: number, pal: PaletteA, w: number, h: number, seed: string): boolean => {
  const rnd = (k: string) => random(`${seed}-${k}`);
  switch (kind) {
    // ------------------------------------------------ athletics: long-jump runway seen from the side
    case 'track': {
      fill(ctx, pal.bg, 0, 0, w, h);
      ditherFill(ctx, 0, 0, w, 90, pal.plum, (_x, y) => y / 110);
      stands(ctx, pal, w, 70, 182, t, seed);
      for (let x = 30; x < w; x += 140) floodlight(ctx, pal, x, 8);
      // advertising boards
      fill(ctx, pal.plum2, 0, 182, w, 10);
      for (let x = 0; x < w; x += 46) {
        fill(ctx, pal.mid1, x + 2, 184, 40, 6);
        fill(ctx, pal.mid3, x + 6, 186, 12, 2);
      }
      // infield grass with mowing stripes
      for (let y = 192; y < 214; y++) fill(ctx, (Math.floor(y / 4) % 2 ? pal.plum2 : pal.plum), 0, y, w, 1);
      // runway (tartan) + white edge lines
      fill(ctx, pal.mid1, 0, 214, w, 12);
      fill(ctx, pal.mid2, 0, 214, w, 1);
      fill(ctx, pal.white, 0, 225, w, 1);
      ditherFill(ctx, 0, 215, w, 10, pal.accentDark, (x, y) => ((x * 7 + y * 13) % 11 === 0 ? 1 : 0));
      // take-off board, sand pit with raked texture, measuring rail
      const board = Math.round(w * 0.55);
      fill(ctx, pal.white, board, 213, 5, 3);
      fill(ctx, pal.accent, board + 5, 213, 1, 3);
      fill(ctx, pal.paper, board + 14, 216, Math.min(w - board - 18, 120), 10);
      ditherFill(ctx, board + 14, 216, Math.min(w - board - 18, 120), 10, pal.mid3, (x, y) => ((x + y * 3) % 5 === 0 ? 1 : 0));
      fill(ctx, pal.mid2, board + 14, 213, Math.min(w - board - 18, 120), 1);
      for (let i = 0; i <= 10; i++) fill(ctx, pal.white, board + 14 + i * 11, 211, 1, 3);
      // ground under the track
      fill(ctx, pal.plum2, 0, 226, w, h - 226);
      for (let y = 230; y < h; y += 7) fill(ctx, pal.plum, 0, y, w, 3);
      ditherFill(ctx, 0, 226, w, h - 226, pal.bg, (_x, y) => (y - 226) / 110);
      return true;
    }
    default:
      return false;
  }
};
