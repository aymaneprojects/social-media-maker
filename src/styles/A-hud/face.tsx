import React from 'react';
import {random} from 'remotion';
import {PixelCanvas} from '../../shared/PixelCanvas';
import type {PaletteA} from '../../shared/palette';
import {paletteList} from './figure';

// Procedural pixel portrait (head and shoulders) drawn on a 64x80 grid:
// four-tone skin shading lit from the left, accent rim light on the shadow
// side, expressive brows/eyes/mouth, hair styles, hats, facial hair, outfits.
// It lives: blinks, glances, breathes, sweats — redrawn on every frame.

export type FaceSpec = {
  tone?: 'light' | 'medium' | 'dark';
  hair?: 'short' | 'slick' | 'curly' | 'afro' | 'bald' | 'military' | 'long' | 'receding';
  hairColor?: 'dark' | 'grey' | 'light';
  hat?: 'none' | 'navy' | 'fedora' | 'tophat' | 'bowler' | 'cap';
  mustache?: 'none' | 'thin' | 'thick';
  beard?: 'none' | 'stubble' | 'full';
  glasses?: boolean;
  brows?: 'neutral' | 'worried' | 'angry' | 'raised';
  eyes?: 'open' | 'wide' | 'narrow' | 'closed';
  mouth?: 'neutral' | 'smile' | 'open' | 'tense' | 'shout' | 'smirk';
  outfit?: 'suit' | 'navy' | 'jersey' | 'tshirt' | 'coat' | 'sweater' | 'overalls';
  sweat?: boolean;
  look?: -1 | 0 | 1; // gaze left / centre / right
  age?: 'young' | 'adult' | 'old';
  jaw?: 'narrow' | 'normal' | 'wide';
  number?: string; // jersey number
  seed?: string;
};

export const FACE_W = 64;
export const FACE_H = 80;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const dith = (x: number, y: number, k: number) => k > BAYER[(y & 3) * 4 + (x & 3)];

export const drawFace = (ctx: CanvasRenderingContext2D, f: FaceSpec, pal: PaletteA, t: number) => {
  const px = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const ell = (cx: number, cy: number, rx: number, ry: number, c: string, a0 = 0, a1 = Math.PI * 2) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
    ctx.fill();
  };

  const tone = f.tone ?? 'medium';
  const skin = {
    light: {hi: pal.paper, base: pal.mid3, sh: pal.mid2, deep: pal.mid1},
    medium: {hi: pal.mid3, base: pal.mid2, sh: pal.mid1, deep: pal.plum2},
    dark: {hi: pal.mid2, base: pal.mid1, sh: pal.plum2, deep: pal.plum},
  }[tone];
  const hairC = f.hairColor === 'grey' ? pal.mid3 : f.hairColor === 'light' ? pal.paper : pal.black;
  const hairHi = f.hairColor === 'grey' ? pal.paper : f.hairColor === 'light' ? pal.white : pal.plum2;

  // living details
  const seed = f.seed ?? 'face';
  const period = 3.1 + random(`${seed}-blink`) * 1.4;
  const blink = (t + random(`${seed}-off`) * 3) % period < 0.12;
  const breath = Math.sin(t * Math.PI * 0.9) > 0.3 ? 1 : 0;
  const sway = Math.round(Math.sin(t * 0.7) * 0.6);
  const glance = f.look ?? (Math.floor(t / 1.7 + random(`${seed}-g`) * 5) % 4 === 2 ? 1 : 0);

  const cx = 32 + sway;
  const cy = 33;
  const rx = 14.5;
  const ry = 18.5;
  const jawK = f.jaw === 'wide' ? 0.12 : f.jaw === 'narrow' ? 0.32 : 0.22;
  const inHead = (x: number, y: number) => {
    const dy = (y - cy) / ry;
    const r = rx * (1 - jawK * Math.max(0, dy) ** 1.6);
    return ((x - cx) / r) ** 2 + dy * dy <= 1;
  };

  // ---------- shoulders / outfit
  const sy = 57 + breath;
  const outfit = f.outfit ?? 'suit';
  const jacket = outfit === 'jersey' ? skin.base : outfit === 'tshirt' ? pal.mid1 : outfit === 'sweater' ? pal.mid1 : outfit === 'overalls' ? pal.mid1 : pal.plum2;
  ell(32, sy + 22, 33, 22, jacket);
  // shoulder light on the left, shade on the right
  for (let y = sy; y < FACE_H; y++)
    for (let x = 0; x < FACE_W; x++) {
      const inS = ((x - 32) / 33) ** 2 + ((y - sy - 22) / 22) ** 2 <= 1;
      if (!inS) continue;
      if (x > 40 && dith(x, y, (x - 40) / 30)) px(x, y, outfit === 'jersey' ? pal.accentDark : pal.plum);
      if (x < 22 && y < sy + 8 && dith(x, y, 0.35)) px(x, y, outfit === 'jersey' ? pal.white : pal.mid1);
    }
  // neck
  rect(cx - 6, 46, 12, sy - 44, skin.base);
  for (let y = 46; y < sy + 2; y++) for (let x = cx; x < cx + 6; x++) if (dith(x, y, 0.6)) px(x, y, skin.sh);
  rect(cx - 6, 49, 12, 2, skin.deep); // chin shadow
  switch (outfit) {
    case 'suit':
    case 'coat': {
      // shirt V + lapels + tie
      for (let y = sy - 1; y < FACE_H; y++) {
        const half = Math.max(0, 7 - (y - sy) * 0.55);
        rect(32 - half, y, half * 2, 1, pal.white);
      }
      for (let y = sy; y < FACE_H; y++) {
        const off = 7 - (y - sy) * 0.55;
        if (off > 0) {
          rect(32 - off - 3, y, 3, 1, pal.mid1);
          rect(32 + off, y, 3, 1, pal.plum);
        }
      }
      rect(31, sy, 2, 2, pal.accentDark);
      rect(31, sy + 2, 2, 12, pal.accent);
      if (outfit === 'coat') {
        rect(16, sy - 4, 6, 10, pal.mid1);
        rect(42, sy - 4, 6, 10, pal.plum);
      }
      break;
    }
    case 'navy': {
      // officer tunic: stand collar, shoulder boards, two buttons
      rect(25, sy - 2, 14, 3, pal.plum);
      rect(25, sy - 2, 14, 1, pal.mid1);
      rect(6, sy + 4, 12, 3, pal.accent);
      rect(46, sy + 4, 12, 3, pal.accentDark);
      rect(31, sy + 6, 2, 2, pal.accent);
      rect(31, sy + 12, 2, 2, pal.accent);
      break;
    }
    case 'jersey': {
      // tank top: straps over bare shoulders, scooped neckline
      for (let y = sy + 1; y < FACE_H; y++) {
        const half = 9 + (y - sy) * 0.55;
        const neck = Math.max(0, 6 - (y - sy) * 0.8);
        rect(32 - half, y, half * 2, 1, pal.accent);
        if (neck > 0) rect(32 - neck, y, neck * 2, 1, skin.base);
        rect(32 + half - 4, y, 4, 1, pal.accentDark);
      }
      if (f.number) {
        rect(26, sy + 9, 12, 9, pal.white);
        ctx.fillStyle = pal.bg;
        ctx.font = '7px monospace';
        ctx.fillText(f.number.slice(0, 3), 27, sy + 16);
      }
      break;
    }
    case 'sweater':
      rect(26, sy - 2, 12, 3, pal.mid2);
      break;
    case 'overalls':
      rect(22, sy + 2, 3, 20, pal.mid3);
      rect(39, sy + 2, 3, 20, pal.mid3);
      break;
    default:
      for (let y = sy - 1; y < sy + 3; y++) rect(26, y, 12, 1, skin.base);
  }

  // ---------- long hair behind the head
  if (f.hair === 'long') ell(cx, cy + 6, rx + 3, ry + 4, hairC);

  // ---------- head with shading
  for (let y = 10; y < 52; y++)
    for (let x = 10; x < 54; x++) {
      if (!inHead(x, y)) continue;
      let c = skin.base;
      const lx = (x - cx) / rx;
      const ly = (y - cy) / ry;
      if (lx < -0.42 && ly > -0.55 && ly < 0.25) c = skin.hi;
      else if (lx < -0.3 && ly > -0.6 && ly < 0.35 && dith(x, y, 0.45)) c = skin.hi;
      if (lx > 0.2 && dith(x, y, (lx - 0.2) * 1.6)) c = skin.sh;
      if (lx > 0.7 || ly > 0.86) c = skin.deep;
      px(x, y, c);
    }
  // rim light: last skin pixel of each row on the right
  for (let y = 14; y < 50; y++) {
    let last = -1;
    for (let x = 10; x < 54; x++) if (inHead(x, y)) last = x;
    if (last > 0 && y > 18) px(last, y, pal.accent);
  }
  // ears
  ell(cx - rx - 0.5, cy + 2, 2, 3.2, skin.base);
  ell(cx + rx + 0.5, cy + 2, 2, 3.2, skin.sh);
  px(cx + rx + 2, cy + 1, pal.accent);

  // ---------- facial features
  const ey = cy + 1;
  const eL = cx - 7;
  const eR = cx + 4;
  const browY = ey - 4 - (f.brows === 'raised' ? 1 : 0);
  const eyeH = f.eyes === 'wide' ? 3 : f.eyes === 'narrow' ? 1 : 2;
  // sockets
  rect(eL - 1, ey - 1, 5, eyeH + 2, skin.sh);
  rect(eR - 1, ey - 1, 5, eyeH + 2, skin.deep);
  if (blink || f.eyes === 'closed') {
    rect(eL, ey + 1, 3, 1, pal.bg);
    rect(eR, ey + 1, 3, 1, pal.bg);
  } else {
    rect(eL, ey, 3, eyeH, pal.paper);
    rect(eR, ey, 3, eyeH, pal.mid3);
    const ix = 1 + glance;
    rect(eL + ix, ey, 1, eyeH, pal.bg);
    rect(eR + ix, ey, 1, eyeH, pal.bg);
    if (eyeH > 1) {
      px(eL + ix, ey, pal.white);
      rect(eL, ey - 1, 3, 1, pal.bg); // upper lid line
      rect(eR, ey - 1, 3, 1, pal.bg);
    }
  }
  // brows
  const brow = (x0: number, side: 1 | -1) => {
    for (let i = 0; i < 5; i++) {
      const inner = side === 1 ? i / 4 : 1 - i / 4;
      let dy = 0;
      if (f.brows === 'worried') dy = -Math.round(inner * 2);
      if (f.brows === 'angry') dy = Math.round(inner * 2) - 1;
      rect(x0 + i, browY + dy, 1, f.age === 'old' ? 1 : 2, f.hairColor === 'light' ? pal.mid2 : hairC);
    }
  };
  brow(eL - 1, 1);
  brow(eR - 1, -1);
  // nose
  rect(cx, ey + 1, 1, 7, skin.sh);
  px(cx - 1, ey + 2, skin.hi);
  rect(cx - 2, ey + 8, 5, 1, skin.deep);
  px(cx + 1, ey + 8, pal.bg);
  // facial hair
  const my = ey + 12;
  if (f.beard === 'stubble' || f.beard === 'full')
    for (let y = ey + 7; y < 50; y++)
      for (let x = 14; x < 50; x++) if (inHead(x, y) && (f.beard === 'full' || dith(x, y, 0.35))) px(x, y, f.beard === 'full' ? hairC : skin.deep);
  if (f.mustache === 'thin') rect(cx - 4, my - 2, 9, 1, hairC);
  if (f.mustache === 'thick') {
    rect(cx - 5, my - 2, 11, 2, hairC);
    px(cx - 6, my - 1, hairC);
    px(cx + 6, my - 1, hairC);
  }
  // mouth
  const mouth = f.mouth ?? 'neutral';
  if (mouth === 'open' || mouth === 'shout') {
    const h = mouth === 'shout' ? 5 : 3;
    rect(cx - 3, my, 7, h, pal.bg);
    rect(cx - 2, my, 5, 1, pal.paper);
    rect(cx - 3, my + h, 7, 1, skin.sh);
  } else if (mouth === 'smile' || mouth === 'smirk') {
    rect(cx - 3, my, 7, 1, pal.bg);
    px(cx - 4, my - 1, mouth === 'smile' ? pal.bg : skin.sh);
    px(cx + 4, my - 1, pal.bg);
    rect(cx - 2, my + 1, 5, 1, skin.sh);
  } else {
    rect(cx - 3, my, 7, 1, mouth === 'tense' ? pal.bg : skin.deep);
    rect(cx - 2, my + 1, 5, 1, skin.hi);
    if (mouth === 'tense') {
      px(cx - 4, my + 1, skin.deep);
      px(cx + 4, my + 1, skin.deep);
    }
  }
  // age lines
  if (f.age === 'old') {
    rect(eL - 2, ey + 4, 2, 1, skin.deep);
    rect(eR + 4, ey + 4, 2, 1, skin.deep);
    rect(cx - 6, my - 3, 1, 3, skin.sh);
    rect(cx + 6, my - 3, 1, 3, skin.deep);
  }
  if (f.glasses) {
    ctx.strokeStyle = pal.black;
    ctx.lineWidth = 1;
    ctx.strokeRect(eL - 1.5, ey - 1.5, 6, 5);
    ctx.strokeRect(eR - 1.5, ey - 1.5, 6, 5);
    rect(cx - 1, ey, 2, 1, pal.black);
    px(eL, ey - 1, pal.white);
  }

  // ---------- hair on top
  const style = f.hair ?? 'short';
  const hairLine = (x: number) => cy - ry * (style === 'receding' ? 0.62 : 0.45) + Math.abs(x - cx) * 0.12 + (style === 'slick' ? 0 : Math.sin(x * 1.3) * 0.6);
  if (style !== 'bald') {
    for (let y = 8; y < cy + 6; y++)
      for (let x = 12; x < 52; x++) {
        const top = y < hairLine(x);
        const side = (x < cx - rx + 2.5 || x > cx + rx - 2.5) && y < cy - 2 && y > cy - ry * 0.5;
        const bigger = style === 'curly' || style === 'afro' ? ((x - cx) / (rx + (style === 'afro' ? 6 : 2))) ** 2 + ((y - cy + 3) / (ry + (style === 'afro' ? 4 : 1))) ** 2 <= 1 : inHead(x, y + 1);
        if (!bigger) continue;
        if (style === 'military') {
          if (top && dith(x, y, 0.55)) px(x, y, hairC);
          continue;
        }
        if (top || side) px(x, y, (style === 'curly' || style === 'afro') && (x + y) % 3 === 0 ? hairHi : hairC);
      }
    if (style === 'slick') for (let i = 0; i < 4; i++) rect(cx - 8 + i * 4, cy - ry + 4 + i, 3, 1, hairHi);
  } else {
    rect(cx - 6, cy - ry + 3, 4, 2, skin.hi); // shine
    rect(cx - rx, cy - 4, 3, 5, hairC);
    rect(cx + rx - 2, cy - 4, 3, 5, hairC);
  }

  // ---------- hats
  const hat = f.hat ?? 'none';
  const hy = cy - ry + 3;
  if (hat === 'navy') {
    ell(cx, hy - 3, rx + 5, 5, pal.paper);
    ell(cx, hy - 4, rx + 4, 3.5, pal.white);
    rect(cx - rx, hy - 2, rx * 2, 5, pal.bg);
    rect(cx - rx, hy - 1, rx * 2, 1, pal.accentDark);
    rect(cx - 2, hy - 2, 4, 4, pal.accent);
    ell(cx + 2, hy + 4, rx - 1, 2.5, pal.black, 0, Math.PI);
  } else if (hat === 'fedora' || hat === 'bowler') {
    ell(cx, hy + 1, rx + (hat === 'fedora' ? 7 : 4), 3, pal.black);
    if (hat === 'fedora') rect(cx - rx + 2, hy - 9, rx * 2 - 4, 10, pal.black);
    else ell(cx, hy - 2, rx - 1, 8, pal.black, Math.PI, Math.PI * 2);
    rect(cx - rx + 2, hy - 2, rx * 2 - 4, 2, pal.accent);
  } else if (hat === 'tophat') {
    ell(cx, hy + 1, rx + 6, 3, pal.black);
    rect(cx - rx + 3, hy - 16, rx * 2 - 6, 17, pal.black);
    rect(cx - rx + 3, hy - 3, rx * 2 - 6, 3, pal.accent);
    rect(cx - rx + 4, hy - 15, 2, 10, pal.plum2);
  } else if (hat === 'cap') {
    ell(cx, hy, rx + 1, 7, pal.accent, Math.PI, Math.PI * 2);
    rect(cx, hy - 1, rx + 7, 2, pal.accentDark);
  }

  // ---------- sweat drops sliding down
  if (f.sweat) {
    for (let i = 0; i < 3; i++) {
      const sx = [cx - 10, cx + 9, cx + 11][i];
      const ph = ((t * 0.55 + i * 0.37) % 1 + 1) % 1;
      const yy = cy - 10 + ph * 22;
      if (inHead(sx, yy)) {
        px(sx, yy, pal.white);
        px(sx, yy + 1, pal.paper);
      }
    }
  }
};

export const Face: React.FC<{spec: FaceSpec; pal: PaletteA; ms: number; scale: number; style?: React.CSSProperties}> = ({spec, pal, ms, scale, style}) => {
  const t = Math.floor(ms / (1000 / 15)) / 15; // features animate at 15 fps
  return (
    <PixelCanvas w={FACE_W} h={FACE_H} scale={scale} deps={[JSON.stringify(spec), pal, t]} draw={(ctx) => drawFace(ctx, spec, pal, t)} style={{left: 0, top: 0, ...style}} quantize={paletteList(pal)} />
  );
};
