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

export type TerrainArgs = Record<string, number | string | boolean>;

export const drawStoryTerrain = (ctx: Ctx, kind: string, t: number, pal: PaletteA, w: number, h: number, seed: string, args: TerrainArgs = {}): boolean => {
  const num = (k: string, d: number) => (typeof args[k] === 'number' ? (args[k] as number) : d);
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
      // take-off board at art x 165 (screen 990), pit 179→284, optical-sight rail beside it
      const board = 165;
      const pitW = 105;
      fill(ctx, pal.white, board, 213, 5, 3);
      fill(ctx, pal.accent, board + 5, 213, 1, 3);
      fill(ctx, pal.paper, board + 14, 216, pitW, 10);
      ditherFill(ctx, board + 14, 216, pitW, 10, pal.mid3, (x, y) => ((x + y * 3) % 5 === 0 ? 1 : 0));
      fill(ctx, pal.mid3, board + 14, 216, pitW, 1);
      fill(ctx, pal.white, board + 12, 210, 82, 1); // rail (stops before the far end of the pit)
      fill(ctx, pal.mid2, board + 12, 211, 82, 1);
      for (let i = 0; i <= 7; i++) fill(ctx, pal.white, board + 14 + i * 11, 208, 1, 3);
      // ground under the track
      fill(ctx, pal.plum2, 0, 226, w, h - 226);
      for (let y = 230; y < h; y += 7) fill(ctx, pal.plum, 0, y, w, 3);
      ditherFill(ctx, 0, 226, w, h - 226, pal.bg, (_x, y) => (y - 226) / 110);
      return true;
    }
    // ------------------------------------------------ crime: brick wall close-up (message, hole)
    case 'brickwall': {
      fill(ctx, pal.plum, 0, 0, w, h);
      for (let y = 0; y < 250; y += 7)
        for (let x = (y / 7) % 2 ? -8 : 0; x < w; x += 16) {
          const r = rnd(`b${x}-${y}`);
          fill(ctx, r > 0.6 ? pal.mid1 : pal.plum2, x + 1, y + 1, 15, 6);
          if (r > 0.85) fill(ctx, pal.mid2, x + 2, y + 1, 6, 1);
          if (r < 0.15) fill(ctx, pal.plum, x + 3 + Math.floor(r * 40) % 9, y + 3, 2, 1);
        }
      // lamp light from the top left, darkness at the bottom
      ditherFill(ctx, 0, 0, w, 250, pal.mid2, (x, y) => 0.45 - Math.hypot(x - 40, y - 30) / 160);
      ditherFill(ctx, 0, 120, w, 130, pal.bg, (_x, y) => (y - 120) / 160);
      const holeK = num('hole', 1); // 0 = intact wall, 1 = full hole
      if (holeK > 0.02) {
        // rough hole bored through the wall
        const hx = num('holeX', 40);
        const hy = num('holeY', 215);
        const rx = 32 * holeK;
        const ry = 24 * holeK;
        for (let y = Math.floor(hy - 30); y < hy + 30; y++)
          for (let x = Math.floor(hx - 36); x < hx + 36; x++) {
            const d = ((x - hx) / rx) ** 2 + ((y - hy) / ry) ** 2 + (rnd(`h${x >> 1}${y >> 1}`) - 0.5) * 0.35;
            if (d < 1) fill(ctx, d > 0.82 ? pal.mid2 : pal.bg, x, y, 1, 1);
          }
      }
      fill(ctx, pal.plum2, 0, 250, w, h - 250);
      for (let i = 0; i < 40; i++) fill(ctx, rnd(`rb${i}`) > 0.5 ? pal.mid1 : pal.mid2, Math.floor(rnd(`rx${i}`) * 90), 248 + Math.floor(rnd(`ry${i}`) * 10), 2 + Math.floor(rnd(`rs${i}`) * 4), 2);
      ditherFill(ctx, 0, 250, w, h - 250, pal.bg, (_x, y) => (y - 250) / 80);
      return true;
    }
    // ------------------------------------------------ crime: bank vault with safe-deposit boxes
    case 'vault': {
      fill(ctx, pal.bg, 0, 0, w, h);
      const open = num('open', 0); // share of boxes forced open
      const x0 = 6;
      const y0 = 24;
      for (let r = 0; r < 16; r++)
        for (let c = 0; c < Math.floor((w - 12) / 15); c++) {
          const x = x0 + c * 15;
          const y = y0 + r * 10;
          const forced = rnd(`o${c}-${r}`) < open;
          if (forced) {
            fill(ctx, pal.bg, x, y, 14, 9);
            fill(ctx, pal.plum2, x, y, 14, 1);
            if (rnd(`g${c}-${r}`) > 0.75) fill(ctx, (Math.floor(t * 3 + c + r) % 4 === 0 ? pal.white : pal.accentDark), x + 3 + Math.floor(rnd(`gx${c}${r}`) * 8), y + 6, 2, 2);
            fill(ctx, pal.mid2, x - 1, y + 1, 2, 8); // door hanging open
          } else {
            fill(ctx, pal.mid1, x, y, 14, 9);
            fill(ctx, pal.mid2, x, y, 14, 1);
            fill(ctx, pal.plum2, x, y + 8, 14, 1);
            fill(ctx, pal.bg, x + 6, y + 4, 2, 2);
            fill(ctx, pal.mid3, x + 2, y + 2, 3, 1);
          }
        }
      ditherFill(ctx, 0, 0, w, 190, pal.bg, (x, y) => 0.15 + Math.hypot(x - w / 2, y - 40) / 260);
      if (args.hole) {
        const hx = 26;
        const hy = num('holeY', 160);
        for (let y = hy - 24; y < hy + 22; y++)
          for (let x = hx - 26; x < hx + 26; x++) {
            const d = ((x - hx) / 24) ** 2 + ((y - hy) / 20) ** 2 + (rnd(`vh${x >> 1}${y >> 1}`) - 0.5) * 0.3;
            if (d < 1) fill(ctx, d > 0.8 ? pal.mid2 : pal.black, x, y, 1, 1);
          }
      }
      // floor: tiles + emptied boxes, papers, jewels
      fill(ctx, pal.mid1, 0, 184, w, 2);
      fill(ctx, pal.plum2, 0, 186, w, h - 186);
      for (let x = 0; x < w; x += 12) fill(ctx, pal.plum, x, 186, 1, h - 186);
      for (let y = 186; y < h; y += 10) fill(ctx, pal.plum, 0, y, w, 1);
      const litter = Math.floor(open * 70);
      for (let i = 0; i < litter; i++) {
        const x = Math.floor(rnd(`lx${i}`) * (w - 10));
        const y = 188 + Math.floor(rnd(`ly${i}`) * 40);
        const k = rnd(`lk${i}`);
        if (k < 0.4) fill(ctx, pal.mid1, x, y, 9, 5), fill(ctx, pal.bg, x + 1, y + 1, 7, 2);
        else if (k < 0.75) fill(ctx, pal.paper, x, y, 4, 3);
        else fill(ctx, Math.floor(t * 4 + i) % 5 === 0 ? pal.white : pal.accent, x, y, 2, 2);
      }
      ditherFill(ctx, 0, 186, w, h - 186, pal.bg, (_x, y) => (y - 186) / 90);
      // hanging lamp cone
      fill(ctx, pal.mid2, w / 2 - 1, 0, 2, 14);
      fill(ctx, pal.paper, w / 2 - 4, 14, 8, 3);
      ditherFill(ctx, w / 2 - 70, 17, 140, 170, pal.mid2, (x, y) => 0.32 - Math.abs(x - w / 2) / (40 + (y - 17) * 0.45) * 0.3 - (y - 17) / 900);
      return true;
    }
    // ------------------------------------------------ crime: cross-section of the city (street, sewer, tunnel, vault)
    case 'sewer': {
      const dig = num('dig', 1); // 0..1 progress of the tunnel
      // night sky + buildings (street at y 68, everything stays above the captions)
      fill(ctx, pal.bg, 0, 0, w, 70);
      ditherFill(ctx, 0, 0, w, 70, pal.plum, (_x, y) => y / 90);
      const blds = [
        [0, 30, 26],
        [26, 22, 22],
        [48, 36, 28],
        [76, 26, 24],
        [104, 12, 66], // the bank, taller, on the right
        [170, 34, 20],
      ];
      blds.forEach(([bx, by, bw], i) => {
        const bank = i === 4;
        fill(ctx, bank ? pal.plum2 : pal.plum, bx, by, bw, 68 - by);
        fill(ctx, pal.mid1, bx, by, bw, 1);
        for (let wy = by + 4; wy < 62; wy += 8)
          for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) fill(ctx, rnd(`w${i}${wx}${wy}`) > (bank ? 0.85 : 0.7) ? pal.paper : pal.bg, wx, wy, 3, 4);
        if (bank) {
          for (let cx = bx + 6; cx < bx + bw - 4; cx += 12) fill(ctx, pal.mid2, cx, 50, 3, 18);
          fill(ctx, pal.accent, bx + 10, by + 4, bw - 20, 3);
        }
      });
      fill(ctx, pal.mid1, 0, 68, w, 3);
      fill(ctx, pal.plum2, 0, 71, w, 2);
      fill(ctx, pal.mid3, 20, 68, 10, 1); // manhole
      fill(ctx, pal.mid2, 60, 44, 1, 24);
      fill(ctx, pal.paper, 58, 42, 5, 2);
      // ground layers with stones
      for (let y = 73; y < h; y++) fill(ctx, y < 110 ? pal.plum2 : y < 170 ? pal.plum : pal.plum2, 0, y, w, 1);
      ditherFill(ctx, 0, 73, w, h - 73, pal.mid1, (x, y) => (rnd(`st${x >> 2}${y >> 2}`) > 0.93 ? 0.8 : 0.05));
      ditherFill(ctx, 0, 196, w, h - 196, pal.bg, (_x, y) => (y - 196) / 70);
      // access shaft with rungs
      fill(ctx, pal.bg, 22, 73, 7, 70);
      for (let y = 76; y < 142; y += 5) fill(ctx, pal.mid2, 23, y, 5, 1);
      // covered river (Paillon collector): arched tunnel, flowing water
      for (let y = 132; y < 190; y++)
        for (let x = 0; x < 92; x++) {
          const d = ((x - 46) / 46) ** 2 + ((y - 165) / 33) ** 2;
          if (y > 165 || d < 1) fill(ctx, d > 0.86 && y <= 165 ? pal.mid1 : pal.bg, x, y, 1, 1);
        }
      fill(ctx, pal.mid1, 0, 190, 92, 2);
      for (let y = 176; y < 190; y += 3)
        for (let x = 0; x < 92; x += 9) fill(ctx, pal.mid2, (x + Math.floor(t * 14) + y * 3) % 92, y, 5, 1);
      // bank basement: the vault room
      const vx = 128;
      const vy = 80;
      fill(ctx, pal.mid1, vx - 3, vy - 3, 50, 50);
      fill(ctx, pal.plum2, vx, vy, 44, 44);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) fill(ctx, pal.mid1, vx + 2 + c * 7, vy + 3 + r * 7, 6, 6);
      fill(ctx, pal.mid2, vx, vy + 42, 44, 2);
      // hand-dug tunnel from the collector up to the vault wall
      const sx0 = 88;
      const sy0 = 168;
      const sx1 = vx - 3;
      const sy1 = vy + 34;
      const len = Math.hypot(sx1 - sx0, sy1 - sy0);
      const reach = len * dig;
      for (let d = 0; d < reach; d += 0.5) {
        const x = sx0 + ((sx1 - sx0) * d) / len;
        const y = sy0 + ((sy1 - sy0) * d) / len;
        fill(ctx, pal.bg, x, y - 4, 2, 8);
        if (Math.floor(d) % 8 === 0) fill(ctx, pal.mid2, x, y - 4, 1, 8);
      }
      if (dig > 0 && dig < 1) {
        const x = sx0 + ((sx1 - sx0) * reach) / len;
        const y = sy0 + ((sy1 - sy0) * reach) / len;
        fill(ctx, Math.floor(t * 6) % 2 ? pal.accent : pal.white, x, y - 1, 2, 2);
      }
      if (dig >= 1) fill(ctx, pal.bg, vx - 3, sy1 - 4, 4, 8);
      return true;
    }
    // ------------------------------------------------ crime: courthouse facade, street below
    case 'courthouse': {
      fill(ctx, pal.plum2, 0, 0, w, 172);
      for (let y = 0; y < 172; y += 8) {
        fill(ctx, pal.plum, 0, y, w, 1);
        for (let x = (y / 8) % 2 ? 12 : 0; x < w; x += 24) fill(ctx, pal.plum, x, y, 1, 8);
      }
      ditherFill(ctx, 0, 0, w, 172, pal.mid1, (x, y) => 0.18 - Math.hypot(x - 30, y - 10) / 400);
      [40, 106].forEach((cy) => fill(ctx, pal.mid1, 0, cy + 50, w, 3));
      const open = !!args.open;
      [
        [20, 40],
        [80, 40],
        [140, 40],
        [20, 106],
        [80, 106],
        [140, 106],
      ].forEach(([x, y], i) => {
        fill(ctx, pal.mid2, x - 2, y - 2, 28, 46);
        const isOpen = open && i === 1;
        fill(ctx, isOpen ? pal.bg : pal.plum, x, y, 24, 42);
        if (!isOpen) {
          ditherFill(ctx, x, y, 24, 42, pal.accentDark, (xx, yy) => 0.25 - (yy - y) / 120 + (xx - x) / 200);
          fill(ctx, pal.mid2, x + 11, y, 2, 42);
          fill(ctx, pal.mid2, x, y + 20, 24, 2);
        } else {
          fill(ctx, pal.mid1, x - 8, y, 7, 42); // shutters swung open
          fill(ctx, pal.mid1, x + 25, y, 7, 42);
          ditherFill(ctx, x, y, 24, 42, pal.accentDark, (_xx, yy) => 0.4 - (yy - y) / 90);
        }
        fill(ctx, pal.mid3, x - 3, y + 42, 30, 2); // sill
      });
      // pavement + street
      fill(ctx, pal.mid1, 0, 172, w, 6);
      fill(ctx, pal.mid2, 0, 172, w, 1);
      fill(ctx, pal.plum, 0, 178, w, h - 178);
      for (let x = 0; x < w; x += 22) fill(ctx, pal.mid2, x + 4, 238, 10, 2);
      ditherFill(ctx, 0, 178, w, h - 178, pal.bg, (_x, y) => (y - 178) / 120);
      // lamppost
      fill(ctx, pal.mid1, 164, 120, 2, 52);
      fill(ctx, pal.paper, 160, 117, 9, 3);
      return true;
    }
    // ------------------------------------------------ crime: round vault door (bank basement)
    case 'vaultdoor': {
      fill(ctx, pal.plum, 0, 0, w, h);
      for (let y = 0; y < 190; y += 12) fill(ctx, pal.plum2, 0, y, w, 1);
      ditherFill(ctx, 0, 0, w, 190, pal.mid1, (x, y) => 0.3 - Math.hypot(x - w / 2, y - 105) / 260);
      const cx = w / 2;
      const cy = 105;
      const turn = num('turn', 0);
      for (let y = cy - 82; y < cy + 82; y++)
        for (let x = cx - 82; x < cx + 82; x++) {
          const d = Math.hypot(x - cx, y - cy) * 1.1;
          if (d < 80) fill(ctx, d > 74 ? pal.mid2 : d > 70 ? pal.plum2 : d > 40 ? (Math.atan2(y - cy, x - cx) * 6 + turn) % 1.2 < 0.1 ? pal.mid2 : pal.mid1 : pal.mid2, x, y, 1, 1);
        }
      ditherFill(ctx, cx - 80, cy - 80, 160, 160, pal.plum2, (x, y) => (Math.hypot(x - cx, y - cy) < 70 ? (x - cx + (y - cy)) / 160 : 0));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        fill(ctx, pal.mid3, cx + Math.cos(a) * 64 - 2, cy + Math.sin(a) * 64 - 2, 4, 4);
      }
      // handle wheel
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + turn;
        for (let r = -26; r <= 26; r++) fill(ctx, pal.paper, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2);
      }
      fill(ctx, pal.accent, cx - 5, cy - 5, 10, 10);
      fill(ctx, pal.plum2, 0, 190, w, h - 190);
      for (let x = 0; x < w; x += 14) fill(ctx, pal.plum, x, 190, 1, h - 190);
      ditherFill(ctx, 0, 190, w, h - 190, pal.bg, (_x, y) => (y - 190) / 90);
      return true;
    }
    // ------------------------------------------------ crime: inside the hand-dug tunnel (side view, wide)
    case 'tunnel': {
      fill(ctx, pal.plum2, 0, 0, w, h);
      ditherFill(ctx, 0, 0, w, h, pal.plum, (x, y) => (rnd(`e${x >> 2}${y >> 2}`) > 0.6 ? 0.7 : 0.1));
      // the bore: ceiling at 140, floor at 236
      fill(ctx, pal.bg, 0, 100, w, 90);
      ditherFill(ctx, 0, 100, w, 90, pal.plum, (x, y) => (rnd(`b${x >> 1}${y >> 1}`) > 0.75 ? 0.6 : 0));
      for (let x = 10; x < w; x += 40) {
        fill(ctx, pal.mid1, x, 100, 4, 90); // props
        fill(ctx, pal.mid2, x, 100, 1, 90);
        fill(ctx, pal.mid1, x - 8, 98, 20, 4); // beam
      }
      // lamp cable with bulbs
      for (let x = 0; x < w; x++) fill(ctx, pal.mid1, x, 106 + Math.round(Math.sin(x / 13) * 2), 1, 1);
      for (let x = 25; x < w; x += 60) {
        const flick = rnd(`fl${x}${Math.floor(t * 8)}`) > 0.92 ? pal.mid3 : pal.paper;
        fill(ctx, flick, x, 109, 3, 3);
        ditherFill(ctx, x - 30, 110, 63, 80, pal.mid1, (xx, yy) => 0.35 - Math.abs(xx - x) / 50 - (yy - 110) / 260);
      }
      // floor with puddles and spoil
      fill(ctx, pal.mid1, 0, 190, w, 3);
      fill(ctx, pal.plum, 0, 193, w, h - 193);
      for (let i = 0; i < 12; i++) fill(ctx, pal.mid2, Math.floor(rnd(`pd${i}`) * w), 190, 10 + Math.floor(rnd(`pw${i}`) * 14), 1);
      ditherFill(ctx, 0, 193, w, h - 193, pal.bg, (_x, y) => (y - 193) / 60);
      // rock face at the end of the tunnel
      const face = num('face', w - 20);
      fill(ctx, pal.plum2, face, 100, w - face, 90);
      ditherFill(ctx, face, 100, w - face, 90, pal.mid1, (x, y) => (rnd(`rf${x}${y}`) > 0.7 ? 0.8 : 0));
      return true;
    }
    // ------------------------------------------------ science: Lake Peigneur cross-section
    // args: water 1→0 (lake level), hole 0→1 (crater), flood 0→1 (mine level filling),
    //       vortex 0→1, fall 0→1 (canal waterfall), geyser 0→1, salt (lake turned salty)
    case 'lake': {
      const water = num('water', 1);
      const hole = num('hole', 0);
      const flood = num('flood', 0);
      const vortex = num('vortex', 0);
      const fallK = num('fall', 0);
      const geyser = num('geyser', 0);
      const deep = num('deep', 0); // the emptied lake bed collapses into a deep bowl
      const SURF = 72;
      const BED = 86;
      const DX = 95; // drill / hole x
      // sky at dusk
      fill(ctx, pal.bg, 0, 0, w, SURF);
      ditherFill(ctx, 0, 0, w, SURF, pal.plum2, (_x, y) => y / 80);
      for (let i = 0; i < 4; i++) {
        const cx = ((rnd(`c${i}`) * (w + 60) + t * 2) % (w + 60)) - 30;
        fill(ctx, pal.plum2, cx, 14 + i * 9, 26, 3);
        fill(ctx, pal.mid1, cx + 4, 13 + i * 9, 14, 1);
      }
      // ground under the lake: mud, then the salt dome with crystal texture and strata
      const bowl = (x: number) => (x > 40 && x < 152 ? deep * 62 * Math.max(0, Math.min(1, (58 - Math.abs(x - DX)) / 9)) : 0);
      fill(ctx, pal.plum2, 0, BED, w, 18);
      for (let y = BED + 18; y < h; y++) fill(ctx, pal.mid1, 0, y, w, 1);
      ditherFill(ctx, 0, BED + 18, w, h - BED - 18, pal.mid2, (x, y) => (rnd(`sd${x >> 1}${y >> 1}`) > 0.82 ? 0.9 : (y % 23 === 0 ? 0.8 : 0.08)));
      ditherFill(ctx, 0, BED + 18, w, h - BED - 18, pal.mid3, (x, y) => (rnd(`sx${x}${y}`) > 0.985 ? 1 : 0));
      if (deep > 0)
        for (let x = 41; x < 152; x++) {
          const b = bowl(x);
          if (b > 0.5) {
            fill(ctx, pal.bg, x, BED, 1, b);
            fill(ctx, pal.mid2, x, BED + b, 1, 2);
          }
        }
      ditherFill(ctx, 0, 196, w, h - 196, pal.bg, (_x, y) => (y - 196) / 90);
      // mine: rooms and pillars (level 3 just above the caption line, level 4 below)
      const level = (y0: number, hh: number) => {
        for (let x = 14; x < w - 8; x += 18) fill(ctx, pal.bg, x, y0, 13, hh);
        fill(ctx, pal.bg, 14, y0 + hh - 3, w - 22, 3);
      };
      level(156, 18);
      level(222, 16);
      // flooding of the upper level, spreading from the hole
      if (flood > 0) {
        const reach = flood * 100;
        for (let x = 14; x < w - 8; x++) {
          if (Math.abs(x - DX) > reach) continue;
          const lvl = Math.min(18, 4 + flood * 16 - Math.abs(x - DX) / 12);
          if (lvl > 0) fill(ctx, (x + Math.floor(t * 10)) % 7 === 0 ? pal.mid3 : pal.accentDark, x, 174 - lvl, 1, lvl);
        }
      }
      // shaft + headframe on the island (left)
      fill(ctx, pal.bg, 28, SURF, 4, 175 - SURF);
      fill(ctx, pal.mid2, 24, SURF - 22, 2, 22);
      fill(ctx, pal.mid2, 34, SURF - 22, 2, 22);
      fill(ctx, pal.mid2, 24, SURF - 22, 12, 2);
      fill(ctx, pal.mid2, 25, SURF - 14, 10, 1);
      fill(ctx, pal.paper, 29, SURF - 25, 2, 3);
      // the island (Jefferson Island): land, live oaks, house
      fill(ctx, pal.plum2, 0, SURF - 2, 40, BED - SURF + 2);
      fill(ctx, pal.mid1, 0, SURF - 2, 40, 1);
      for (let i = 0; i < 3; i++) {
        const tx = 6 + i * 6;
        fill(ctx, pal.plum, tx, SURF - 8, 1, 6);
        fill(ctx, pal.mid1, tx - 3, SURF - 13, 7, 5);
        fill(ctx, pal.mid2, tx - 2, SURF - 13, 3, 1);
      }
      // right shore with the canal to the Gulf
      fill(ctx, pal.plum2, 152, SURF - 2, w - 152, BED - SURF + 2);
      fill(ctx, pal.mid1, 152, SURF - 2, w - 152, 1);
      fill(ctx, pal.bg, 164, SURF - 2, 8, 6); // canal mouth
      // the crater opening under the lake
      if (hole > 0) {
        const top = 2 + hole * 13;
        for (let y = BED; y < 158; y++) {
          const k = (y - BED) / (158 - BED);
          const half = Math.max(0.5, top * (1 - k) ** 1.4 + 1.5 * k + (rnd(`cr${y}`) - 0.5) * 2 * hole);
          fill(ctx, pal.mid3, DX - half - 1, y, 1, 1);
          fill(ctx, pal.mid3, DX + half, y, 1, 1);
          fill(ctx, pal.bg, DX - half, y, half * 2, 1);
          // water rushing down the hole
          if (water < 0.98 || hole > 0.05)
            for (let x = -half; x < half; x += 3) if ((y + Math.floor(t * 18) + x * 5) % 6 === 0) fill(ctx, pal.mid3, DX + x, y, 1, 2);
        }
      }
      // lake water (drains towards the crater)
      const wl = SURF + (1 - water) * (BED - SURF - 1);
      if (water > 0.02)
        for (let x = 40; x < 152; x++) {
          const dip = vortex * 9 * Math.exp(-(((x - DX) / (14 + vortex * 10)) ** 2));
          const top = wl + dip;
          const bottom = BED + bowl(x);
          if (top < bottom) fill(ctx, pal.accentDark, x, top, 1, bottom - top);
          fill(ctx, pal.mid3, x, top, 1, 1);
        }
      // whirlpool rings
      if (vortex > 0.05 && water > 0.05)
        for (let i = 0; i < 3; i++) {
          const r = (6 + i * 7) * vortex;
          const a0 = t * (4 - i) + i;
          for (let a = 0; a < Math.PI * 1.3; a += 0.12) fill(ctx, pal.white, DX + Math.cos(a + a0) * r * 1.6, wl + 2 + Math.sin(a + a0) * r * 0.25, 1, 1);
        }
      // canal waterfall into the emptied lake
      if (fallK > 0) {
        for (let y = SURF; y < BED + bowl(146); y++)
          for (let x = 150; x < 154 + fallK * 4; x++) if ((y + x + Math.floor(t * 20)) % 3) fill(ctx, (y + Math.floor(t * 20)) % 5 === 0 ? pal.white : pal.mid3, x, y, 1, 1);
        ditherFill(ctx, 132, BED + bowl(146) - 8, 26, 10, pal.white, () => 0.45 * fallK);
      }
      // geysers out of the mine shaft
      if (geyser > 0) {
        const top = SURF - geyser * 45;
        for (let y = Math.floor(top); y < SURF - 22; y++) {
          const spread = 2 + (SURF - y) * 0.15;
          for (let x = -spread; x < spread; x++) if (rnd(`g${Math.floor(x)}${y}${Math.floor(t * 10)}`) > 0.45) fill(ctx, rnd(`gc${x}${y}`) > 0.6 ? pal.white : pal.mid3, 30 + x, y, 1, 1);
        }
      }
      // drill string from the rig down to the mine
      if (num('drill', 1) > 0) fill(ctx, pal.mid3, DX, SURF, 1, (158 - SURF) * num('drill', 1));
      return true;
    }
    // ------------------------------------------------ science: inside the salt mine (rooms and pillars)
    case 'mine': {
      const flood = num('flood', 0);
      fill(ctx, pal.mid2, 0, 0, w, h);
      for (let y = 0; y < h; y += 9) fill(ctx, y % 27 === 0 ? pal.mid3 : pal.mid1, 0, y, w, 1);
      ditherFill(ctx, 0, 0, w, h, pal.paper, (x, y) => (rnd(`m${x >> 2}${y >> 2}`) > 0.96 ? 0.5 : 0));
      // the room: ceiling 96, floor 186, two pillars
      fill(ctx, pal.plum, 0, 96, w, 90);
      ditherFill(ctx, 0, 96, w, 90, pal.plum2, (_x, y) => 0.6 - (y - 96) / 200);
      [26, 132].forEach((px) => {
        fill(ctx, pal.mid2, px, 96, 22, 90);
        fill(ctx, pal.mid3, px, 96, 3, 90);
        ditherFill(ctx, px, 96, 22, 90, pal.paper, (x, y) => (rnd(`pl${x >> 1}${y >> 1}`) > 0.94 ? 0.6 : 0));
      });
      fill(ctx, pal.mid1, 0, 186, w, 4);
      fill(ctx, pal.plum2, 0, 190, w, h - 190);
      ditherFill(ctx, 0, 190, w, h - 190, pal.bg, (_x, y) => (y - 190) / 70);
      // ceiling lamps
      for (let x = 15; x < w; x += 55) {
        fill(ctx, pal.paper, x, 97, 4, 2);
        ditherFill(ctx, x - 20, 99, 44, 86, pal.mid1, (xx, yy) => 0.3 - Math.abs(xx - x) / 40 - (yy - 99) / 300);
      }
      // the torrent: a stream from the ceiling, then water rising over the floor
      if (flood > 0) {
        const sx = 92;
        for (let y = 96; y < 186; y++)
          for (let x = sx - 4 - flood * 6; x < sx + 4 + flood * 6; x++) if ((y + Math.floor(t * 24) + x * 3) % 4) fill(ctx, (y + Math.floor(t * 24)) % 6 === 0 ? pal.white : pal.mid3, x, y, 1, 1);
        const lvl = flood * 40;
        fill(ctx, pal.accentDark, 0, 186 - lvl, w, lvl);
        for (let x = 0; x < w; x += 6) fill(ctx, pal.mid3, (x + Math.floor(t * 8)) % w, 186 - lvl, 3, 1);
        ditherFill(ctx, sx - 30, 150, 60, 36, pal.white, (x, y) => 0.35 - Math.abs(x - sx) / 60 - (186 - y) / 200);
      }
      return true;
    }
    // ------------------------------------------------ business: Paris at dusk with the Eiffel Tower
    case 'paris': {
      const tx = num('towerX', Math.round(w / 2)); // tower axis
      const base = 186;
      const TH = 148; // tower height (top stays under the HUD band)
      fill(ctx, pal.bg, 0, 0, w, h);
      ditherFill(ctx, 0, 0, w, base, pal.plum2, (_x, y) => y / 240);
      ditherFill(ctx, 0, 60, w, base - 60, pal.accentDark, (_x, y) => (y - 60) / 900);
      for (let i = 0; i < 40; i++) fill(ctx, pal.mid2, Math.floor(rnd(`s${i}`) * w), Math.floor(rnd(`sy${i}`) * 70), 1, 1);
      // far rooftops
      for (let x = 0; x < w; x += 9) {
        const hgt = 14 + Math.floor(rnd(`r${x}`) * 16);
        fill(ctx, pal.plum, x, base - hgt, 9, hgt);
        fill(ctx, pal.plum2, x, base - hgt, 9, 2);
      }
      // the tower: legs, arches, platforms, lattice, antenna
      const halfAt = (y: number) => {
        const k = (base - y) / TH; // 0 at the base, 1 at the top
        return Math.max(1, 30 * (1 - k) ** 2.2 + 1);
      };
      const top = base - TH;
      for (let y = top; y < base; y++) {
        const half = halfAt(y);
        const k = (base - y) / TH;
        const archOpen = y > base - 30;
        for (let x = Math.floor(tx - half); x <= tx + half; x++) {
          const edge = x - (tx - half) < 2 || tx + half - x < 2;
          const inArch = archOpen && Math.abs(x - tx) < half - 5 - ((y - (base - 34)) < 0 ? 0 : 0) && ((x - tx) / (half - 4)) ** 2 + ((base - y) / 27) ** 2 < 1;
          if (inArch) continue;
          const lattice = (x + y) % 4 === 0 || (x - y + 400) % 4 === 0;
          if (edge || lattice || k > 0.82) fill(ctx, edge ? pal.mid3 : (x + y) % 8 === 0 ? pal.mid2 : pal.mid1, x, y, 1, 1);
        }
      }
      [base - 30, base - 72, base - 115].forEach((py, i) => {
        const half = halfAt(py) + 2;
        fill(ctx, pal.mid3, tx - half, py, half * 2, 2);
        fill(ctx, pal.mid1, tx - half, py + 2, half * 2, 1);
        for (let x = Math.floor(tx - half) + 1; x < tx + half; x += 3) fill(ctx, Math.floor(t * 2 + x + i) % 7 === 0 ? pal.paper : pal.accentDark, x, py + 1, 1, 1);
      });
      fill(ctx, pal.mid3, tx, top - 12, 1, 12);
      fill(ctx, Math.floor(t * 2) % 2 ? pal.accent : pal.white, tx, top - 13, 1, 1);
      // Seine and quays
      fill(ctx, pal.mid1, 0, base, w, 3);
      fill(ctx, pal.plum, 0, base + 3, w, h - base - 3);
      for (let y = base + 6; y < h; y += 4)
        for (let x = 0; x < w; x += 11) fill(ctx, pal.plum2, (x + Math.floor(t * 6) + y * 2) % w, y, 6, 1);
      ditherFill(ctx, 0, base + 3, w, h - base - 3, pal.bg, (_x, y) => (y - base) / 110);
      // street lamps along the quay
      for (let x = 8; x < w; x += 38) {
        fill(ctx, pal.mid2, x, base - 16, 1, 16);
        fill(ctx, pal.paper, x - 1, base - 18, 3, 2);
        ditherFill(ctx, x - 8, base - 16, 17, 16, pal.accentDark, (xx, yy) => 0.4 - Math.abs(xx - x) / 14 - (yy - base + 16) / 60);
      }
      return true;
    }
    // ------------------------------------------------ business: grand hotel salon (window on the tower)
    case 'hotel': {
      fill(ctx, pal.plum2, 0, 0, w, h);
      // damask wallpaper
      for (let y = 0; y < 186; y += 12)
        for (let x = (y / 12) % 2 ? 6 : 0; x < w; x += 12) {
          fill(ctx, pal.mid1, x + 4, y + 3, 3, 5);
          fill(ctx, pal.mid1, x + 3, y + 5, 5, 1);
        }
      fill(ctx, pal.mid2, 0, 120, w, 3); // dado rail
      fill(ctx, pal.plum, 0, 123, w, 63);
      for (let x = 0; x < w; x += 30) fill(ctx, pal.plum2, x + 4, 128, 22, 52);
      // tall window with the tower outside
      const wx = num('windowX', 110);
      fill(ctx, pal.mid2, wx - 3, 22, 50, 96);
      fill(ctx, pal.bg, wx, 25, 44, 90);
      ditherFill(ctx, wx, 25, 44, 90, pal.accentDark, (_x, y) => (y - 25) / 160);
      for (let y = 40; y < 115; y++) {
        const half = Math.max(0.5, 9 * ((y - 40) / 75) ** 2);
        fill(ctx, pal.mid1, wx + 22 - half, y, half * 2 + 1, 1);
      }
      fill(ctx, pal.mid2, wx + 21, 115 - 2, 3, 2);
      fill(ctx, pal.mid2, wx + 21, 25, 2, 90);
      fill(ctx, pal.mid2, wx, 68, 44, 2);
      fill(ctx, pal.mid1, wx - 8, 20, 6, 100); // curtains
      fill(ctx, pal.mid1, wx + 46, 20, 6, 100);
      // painting
      fill(ctx, pal.accentDark, 18, 40, 36, 28);
      fill(ctx, pal.mid1, 21, 43, 30, 22);
      fill(ctx, pal.mid2, 24, 55, 24, 7);
      // chandelier with flickering candles
      const cx = num('chandelierX', 60);
      fill(ctx, pal.mid2, cx, 0, 1, 14);
      fill(ctx, pal.mid3, cx - 12, 14, 25, 2);
      for (let i = -2; i <= 2; i++) {
        fill(ctx, pal.mid3, cx + i * 6, 10, 1, 4);
        fill(ctx, rnd(`f${i}${Math.floor(t * 6)}`) > 0.3 ? pal.paper : pal.white, cx + i * 6, 8, 1, 2);
      }
      ditherFill(ctx, cx - 70, 16, 140, 170, pal.mid2, (x, y) => 0.42 - Math.hypot(x - cx, y - 16) / 170);
      // floor: parquet + carpet
      fill(ctx, pal.mid1, 0, 186, w, 3);
      for (let y = 189; y < h; y += 5) for (let x = (y % 10) * 2; x < w; x += 20) fill(ctx, pal.plum2, x, y, 18, 4);
      fill(ctx, pal.accentDark, 20, 192, w - 40, 20);
      ditherFill(ctx, 0, 189, w, h - 189, pal.bg, (_x, y) => (y - 189) / 90);
      return true;
    }
    // ------------------------------------------------ history: the ocean in cross-section (ships above, submarine below)
    // args: night (bool), lights 0→1 (searchlights from the ships), depth tint
    case 'ocean': {
      const SEA = 66;
      const night = args.night !== false;
      fill(ctx, pal.bg, 0, 0, w, SEA);
      ditherFill(ctx, 0, 0, w, SEA, night ? pal.plum : pal.plum2, (_x, y) => y / 90);
      for (let i = 0; i < 30; i++) fill(ctx, pal.mid2, Math.floor(rnd(`st${i}`) * w), Math.floor(rnd(`sy${i}`) * 40), 1, 1);
      // water body: darker with depth
      for (let y = SEA; y < h; y++) fill(ctx, y < SEA + 40 ? pal.plum2 : y < 160 ? pal.plum : pal.bg, 0, y, w, 1);
      ditherFill(ctx, 0, SEA, w, 110, pal.accentDark, (_x, y) => 0.45 - (y - SEA) / 140);
      // light rays from the surface
      for (let i = 0; i < 6; i++) {
        const rx = ((rnd(`ray${i}`) * w + t * 3) % (w + 40)) - 20;
        ditherFill(ctx, rx - 6, SEA, 30, 120, pal.mid1, (x, y) => (Math.abs(x - rx - (y - SEA) * 0.25) < 3 ? 0.35 - (y - SEA) / 300 : 0));
      }
      // waves
      for (let x = 0; x < w; x++) {
        const yy = SEA + Math.round(Math.sin(x / 7 + t * 2) * 1);
        fill(ctx, pal.mid2, x, yy, 1, 1);
      }
      // searchlights sweeping from the ships
      const lights = num('lights', 0);
      if (lights > 0)
        [40, 120].forEach((lx, i) => {
          const a = Math.sin(t * 0.8 + i * 2) * 0.5;
          ditherFill(ctx, 0, 0, w, SEA, pal.paper, (x, y) => {
            const dx = x - lx;
            const dy = SEA - 6 - y;
            if (dy < 0) return 0;
            const ang = Math.atan2(dx, dy);
            return Math.abs(ang - a) < 0.08 ? 0.5 * lights : 0;
          });
        });
      // drifting particles
      for (let i = 0; i < 40; i++) {
        const px = (rnd(`p${i}`) * w + Math.sin(t + i) * 3) % w;
        const py = SEA + 10 + ((rnd(`py${i}`) * (h - SEA) - t * 2) % (h - SEA) + (h - SEA)) % (h - SEA);
        fill(ctx, pal.mid1, px, py, 1, 1);
      }
      // sea bed
      for (let x = 0; x < w; x++) fill(ctx, pal.plum2, x, 232 + Math.round(Math.sin(x / 11) * 3), 1, h);
      return true;
    }
    // ------------------------------------------------ history: inside a diesel submarine
    // args: alarm 0→1 (red light pulsing), heat 0→1 (haze)
    case 'subInterior': {
      const alarm = num('alarm', 0);
      fill(ctx, pal.plum, 0, 0, w, h);
      // curved hull ribs
      for (let x = 0; x < w; x += 20) {
        fill(ctx, pal.plum2, x, 0, 4, 190);
        fill(ctx, pal.mid1, x, 0, 1, 190);
      }
      ditherFill(ctx, 0, 0, w, 60, pal.bg, (_x, y) => 0.7 - y / 80);
      // pipes along the ceiling
      [52, 58, 63].forEach((py, i) => {
        fill(ctx, i === 1 ? pal.mid2 : pal.mid1, 0, py, w, 3);
        fill(ctx, pal.mid3, 0, py, w, 1);
        for (let x = 10 + i * 7; x < w; x += 34) fill(ctx, pal.mid2, x, py - 1, 3, 5);
      });
      // panel with gauges and valves on the back wall
      fill(ctx, pal.plum2, 8, 76, w - 16, 70);
      fill(ctx, pal.mid1, 8, 76, w - 16, 1);
      for (let i = 0; i < 6; i++) {
        const gx = 20 + i * 26;
        const gy = 92 + (i % 2) * 22;
        ctx.fillStyle = pal.paper;
        ctx.beginPath();
        ctx.arc(gx, gy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.bg;
        ctx.beginPath();
        ctx.arc(gx, gy, 5, 0, Math.PI * 2);
        ctx.fill();
        const a = -2.2 + (Math.sin(t * (1 + i * 0.3) + i) * 0.3 + 0.5 + alarm * 0.6) * 3.5;
        for (let r = 0; r < 5; r++) fill(ctx, pal.accent, gx + Math.cos(a) * r, gy + Math.sin(a) * r, 1, 1);
        fill(ctx, pal.mid2, gx - 1, gy + 7, 2, 4);
      }
      for (let i = 0; i < 4; i++) {
        const vx = 32 + i * 40;
        fill(ctx, pal.mid3, vx - 4, 140, 9, 2);
        fill(ctx, pal.mid2, vx, 136, 1, 4);
      }
      // bunk + periscope column
      fill(ctx, pal.mid1, 150, 100, 26, 4);
      fill(ctx, pal.plum2, 152, 104, 22, 12);
      fill(ctx, pal.mid2, 86, 0, 6, 186);
      fill(ctx, pal.mid3, 86, 0, 1, 186);
      fill(ctx, pal.mid2, 80, 120, 18, 6);
      // floor grating
      fill(ctx, pal.mid1, 0, 186, w, 3);
      for (let x = 0; x < w; x += 5) fill(ctx, pal.plum2, x, 189, 3, 6);
      fill(ctx, pal.plum, 0, 195, w, h - 195);
      ditherFill(ctx, 0, 195, w, h - 195, pal.bg, (_x, y) => (y - 195) / 60);
      // emergency light: red wash pulsing
      if (alarm > 0) {
        const pulse = Math.max(0, Math.sin(t * 5));
        fill(ctx, pal.accent, 120, 44, 10, 5);
        ditherFill(ctx, 0, 0, w, 190, pal.accentDark, () => (0.15 + 0.35 * pulse) * alarm);
      }
      // heat haze
      const heat = num('heat', 0);
      if (heat > 0) ditherFill(ctx, 0, 0, w, 186, pal.mid1, (x, y) => (Math.sin(y / 3 + t * 6 + x / 20) > 0.92 ? heat * 0.6 : 0));
      return true;
    }
    default:
      return false;
  }
};
