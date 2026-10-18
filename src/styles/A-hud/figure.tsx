import React from 'react';
import {PixelCanvas} from '../../shared/PixelCanvas';
import type {PaletteA} from '../../shared/palette';

// Procedural pixel-art character rig. A small skeleton (torso, head, two-part
// arms and legs) is posed with joint angles and drawn on a low-res canvas, so
// every frame is a genuine pixel drawing: smooth motion, crisp pixels.
//
// Angles are in degrees, measured from "hanging straight down"; positive
// values swing towards the facing direction. Elbows/knees are relative to the
// upper segment (knees bend backwards with negative values).

export type Joints = {
  torso: number; // lean of the torso (0 upright, + forward)
  head: number; // extra head tilt
  ua: [number, number]; // upper arms [front, back]
  fa: [number, number]; // forearms (relative)
  th: [number, number]; // thighs
  sh: [number, number]; // shins (relative, negative = knee bent back)
  dy: number; // vertical offset of the hips (art px, + = down)
  dx?: number;
};

export type Outfit = {
  top?: string; // colour keys of the palette: accent, accentDark, white, paper, mid1, mid2, mid3, plum, plum2, black
  bottom?: string;
  skin?: string;
  hair?: string;
  shoes?: string;
  hairStyle?: 'short' | 'long' | 'bald' | 'afro' | 'none';
  hat?: 'cap' | 'tophat' | 'helmet' | 'beret' | 'police' | 'bowler' | 'none';
  hatColor?: string;
  mustache?: boolean;
  sleeves?: 'long' | 'short' | 'none';
  coat?: boolean; // long coat over the thighs
  prop?: 'briefcase' | 'shovel' | 'torch' | 'paper' | 'cane' | 'flag' | 'drill' | 'none';
  tie?: boolean;
  number?: boolean; // athlete bib on the chest
  shorts?: boolean; // bare shins (athletes, summer)
};

const sin = (d: number) => Math.sin((d * Math.PI) / 180);
const cos = (d: number) => Math.cos((d * Math.PI) / 180);

// --------------------------------------------------------------- poses
const P = (j: Partial<Joints>): Joints => ({torso: 0, head: 0, ua: [6, -6], fa: [12, 8], th: [2, -2], sh: [0, 0], dy: 0, ...j});

// Cyclic poses take a phase 0..1, static poses ignore it.
export const POSES: Record<string, (ph: number) => Joints> = {
  stand: (ph) => P({ua: [5 + Math.sin(ph * 6.28) * 2, -5], dy: Math.sin(ph * 6.28) > 0.95 ? 0 : 0}),
  idle: (ph) => P({torso: Math.sin(ph * 6.28) * 2, ua: [8, -4], fa: [14, 10], dy: Math.round(Math.sin(ph * 6.28) * 0.5)}),
  walk: (ph) => {
    const s = Math.sin(ph * 6.28);
    return P({torso: 4, ua: [-s * 28, s * 28], fa: [18, 18], th: [s * 26, -s * 26], sh: [Math.min(0, -s * 30) - 6, Math.min(0, s * 30) - 6], dy: Math.abs(Math.cos(ph * 6.28)) * -1 + 1});
  },
  run: (ph) => {
    const s = Math.sin(ph * 6.28);
    const c = Math.cos(ph * 6.28);
    return P({
      torso: 16,
      head: -8,
      ua: [-s * 55, s * 55],
      fa: [95, 95],
      th: [s * 48 + 8, -s * 48 + 8],
      sh: [-(45 + c * 40), -(45 - c * 40)],
      dy: -Math.abs(c) * 2 + 1,
    });
  },
  sprint: (ph) => {
    const s = Math.sin(ph * 6.28);
    const c = Math.cos(ph * 6.28);
    return P({
      torso: 24,
      head: -14,
      ua: [-s * 70, s * 70],
      fa: [100, 100],
      th: [s * 58 + 12, -s * 58 + 12],
      sh: [-(55 + c * 50), -(55 - c * 50)],
      dy: -Math.abs(c) * 2.5 + 1,
    });
  },
  takeoff: () => P({torso: 10, head: -10, ua: [150, 40], fa: [10, 20], th: [70, -20], sh: [-80, -10], dy: -1}),
  hang: () => P({torso: -14, head: -6, ua: [165, 160], fa: [15, 15], th: [20, 10], sh: [-95, -100], dy: -2}),
  flight: () => P({torso: 6, head: -4, ua: [120, 100], fa: [20, 20], th: [60, 50], sh: [-70, -60], dy: -1}),
  land: () => P({torso: 38, head: -18, ua: [70, 50], fa: [30, 30], th: [85, 80], sh: [-10, -5], dy: 4}),
  crouch: () => P({torso: 30, head: -20, ua: [40, 10], fa: [50, 40], th: [80, 70], sh: [-120, -115], dy: 9}),
  kneel: () => P({torso: 6, head: 6, ua: [10, 0], fa: [30, 20], th: [80, -5], sh: [-85, -90], dy: 8}),
  kneelDown: () => P({torso: 24, head: 22, ua: [-10, -20], fa: [20, 10], th: [-5, -5], sh: [-90, -90], dy: 8}),
  fall: () => P({torso: 75, head: -30, ua: [150, 120], fa: [10, 20], th: [40, -30], sh: [-20, -40], dy: 6}),
  lie: () => P({torso: 90, head: -80, ua: [170, 10], fa: [0, 0], th: [90, 85], sh: [0, 0], dy: 14}),
  sit: () => P({torso: -4, ua: [20, 10], fa: [60, 50], th: [90, 85], sh: [-90, -85], dy: 7}),
  dig: (ph) => {
    const s = Math.sin(ph * 6.28);
    return P({torso: 30 + s * 12, head: -10, ua: [60 + s * 50, 50 + s * 50], fa: [20, 30], th: [30, -10], sh: [-30, -10], dy: 2});
  },
  crawl: (ph) => {
    const s = Math.sin(ph * 6.28);
    return P({torso: 82, head: -70, ua: [90 + s * 30, 90 - s * 30], fa: [-10, -10], th: [70 - s * 20, 70 + s * 20], sh: [-90, -90], dy: 13});
  },
  swim: (ph) => {
    const s = Math.sin(ph * 6.28);
    return P({torso: 88, head: -60, ua: [160 + s * 60, 160 - s * 60], fa: [10, 10], th: [s * 15, -s * 15], sh: [-10, -10], dy: 6});
  },
  point: () => P({ua: [90, -6], fa: [0, 10]}),
  wave: (ph) => P({ua: [150, -6], fa: [30 + Math.sin(ph * 6.28) * 30, 10]}),
  celebrate: (ph) => P({torso: -6, head: -12, ua: [160 + Math.sin(ph * 6.28) * 10, 160 - Math.sin(ph * 6.28) * 10], fa: [10, 10], dy: Math.round(-Math.abs(Math.sin(ph * 6.28)) * 2)}),
  push: () => P({torso: 30, ua: [85, 80], fa: [5, 5], th: [35, -30], sh: [-20, -5]}),
  talk: (ph) => P({ua: [35 + Math.sin(ph * 6.28) * 12, -6], fa: [70, 10]}),
  shrug: () => P({ua: [30, 30], fa: [100, 100], head: 8}),
  salute: () => P({ua: [120, -6], fa: [130, 10]}),
  hold: () => P({ua: [40, 30], fa: [60, 60]}),
  climb: (ph) => {
    const s = Math.sin(ph * 6.28);
    return P({torso: 4, ua: [150 + s * 20, 150 - s * 20], fa: [20, 20], th: [40 + s * 30, 40 - s * 30], sh: [-70, -70], dy: 0});
  },
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const blendJoints = (a: Joints, b: Joints, k: number): Joints => ({
  torso: lerp(a.torso, b.torso, k),
  head: lerp(a.head, b.head, k),
  ua: [lerp(a.ua[0], b.ua[0], k), lerp(a.ua[1], b.ua[1], k)],
  fa: [lerp(a.fa[0], b.fa[0], k), lerp(a.fa[1], b.fa[1], k)],
  th: [lerp(a.th[0], b.th[0], k), lerp(a.th[1], b.th[1], k)],
  sh: [lerp(a.sh[0], b.sh[0], k), lerp(a.sh[1], b.sh[1], k)],
  dy: lerp(a.dy, b.dy, k),
  dx: lerp(a.dx ?? 0, b.dx ?? 0, k),
});

// --------------------------------------------------------------- drawing
export const FIG_W = 48;
export const FIG_H = 56;
const HIP = {x: 24, y: 34}; // standing hip position in the canvas
const T = 12; // torso length
const UA = 6.5;
const FA = 6;
const TH = 8.5;
const SH = 9;

type Pt = {x: number; y: number};
const seg = (o: Pt, angle: number, len: number): Pt => ({x: o.x + sin(angle) * len, y: o.y + cos(angle) * len});

const col = (pal: PaletteA, k: string | undefined, fallback: string) => {
  if (!k) return fallback;
  return (pal as unknown as Record<string, string>)[k] ?? k;
};

export const drawFigure = (ctx: CanvasRenderingContext2D, j: Joints, o: Outfit, pal: PaletteA) => {
  const top = col(pal, o.top, pal.accent);
  const bottom = col(pal, o.bottom, pal.mid1);
  const skin = col(pal, o.skin, pal.mid3);
  const hair = col(pal, o.hair, pal.black);
  const shoes = col(pal, o.shoes, pal.black);
  const line = pal.bg;
  const shade = (c: string) => (c === pal.accent ? pal.accentDark : c === pal.white || c === pal.paper ? pal.mid3 : c === pal.mid3 ? pal.mid2 : c === pal.mid2 ? pal.mid1 : pal.plum2);

  const hip = {x: HIP.x + (j.dx ?? 0), y: HIP.y + j.dy};
  const neck = seg(hip, 180 + j.torso, T); // torso goes up
  const shoulder = seg(neck, 180 + j.torso, -1.5);
  const headC = seg(neck, 180 + j.torso + j.head, 4.2);

  const limb = (from: Pt, a1: number, l1: number, a2: number, l2: number) => {
    const mid = seg(from, a1, l1);
    const end = seg(mid, a1 + a2, l2);
    return {mid, end};
  };
  const arm = (i: 0 | 1) => limb(shoulder, j.ua[i], UA, j.fa[i], FA);
  const leg = (i: 0 | 1) => limb(hip, j.th[i], TH, j.sh[i], SH);

  const stroke = (a: Pt, b: Pt, w: number, c: string) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  const disc = (c: Pt, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawLeg = (i: 0 | 1, outline: boolean) => {
    const {mid, end} = leg(i);
    const back = i === 1;
    const pants = back ? shade(bottom) : bottom;
    if (outline) {
      stroke(hip, mid, 5.8, line);
      stroke(mid, end, 5, line);
      stroke(end, seg(end, j.th[i] + j.sh[i] + 90, 2.2), 4.2, line);
      return;
    }
    stroke(hip, mid, 3.4, pants);
    stroke(mid, end, 2.6, o.shorts ? (back ? shade(skin) : skin) : pants);
    // shoe pointing forward
    const toe = seg(end, j.th[i] + j.sh[i] + 90, 2.2);
    stroke(end, toe, 2.2, back ? pal.plum : shoes);
  };
  const drawArm = (i: 0 | 1, outline: boolean) => {
    const {mid, end} = arm(i);
    const back = i === 1;
    if (outline) {
      stroke(shoulder, mid, 5, line);
      stroke(mid, end, 4.4, line);
      return;
    }
    const sleeve = o.sleeves === 'none' ? skin : top;
    const fore = o.sleeves === 'long' ? top : skin;
    stroke(shoulder, mid, 2.6, back ? shade(sleeve) : sleeve);
    stroke(mid, end, 2.2, back ? shade(fore) : fore);
    disc(end, 1.2, back ? shade(skin) : skin);
    if (!back && o.prop && o.prop !== 'none') drawProp(end, j.ua[0] + j.fa[0]);
  };
  const drawProp = (hand: Pt, angle: number) => {
    switch (o.prop) {
      case 'briefcase':
        ctx.fillStyle = pal.plum2;
        ctx.fillRect(Math.round(hand.x - 3), Math.round(hand.y + 1), 6, 4);
        ctx.fillStyle = pal.mid1;
        ctx.fillRect(Math.round(hand.x - 3), Math.round(hand.y + 1), 6, 1);
        break;
      case 'shovel': {
        const tip = seg(hand, angle, 9);
        const back = seg(hand, angle, -5);
        stroke(back, tip, 1.4, pal.mid2);
        disc(tip, 2, pal.white);
        break;
      }
      case 'torch': {
        const beam = seg(hand, angle - 90, 2);
        disc(beam, 1.5, pal.white);
        break;
      }
      case 'paper':
        ctx.fillStyle = pal.paper;
        ctx.fillRect(Math.round(hand.x - 2), Math.round(hand.y - 4), 4, 5);
        break;
      case 'cane': {
        const tip = seg(hand, 0, 9);
        stroke(hand, tip, 1.2, pal.black);
        break;
      }
      case 'flag': {
        const tip = seg(hand, 180, 10);
        stroke(hand, tip, 1, pal.white);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(Math.round(tip.x), Math.round(tip.y), 6, 4);
        break;
      }
      case 'drill': {
        const tip = seg(hand, angle, 7);
        stroke(hand, tip, 2.4, pal.mid2);
        stroke(seg(hand, angle, 5), seg(hand, angle, 9), 1, pal.white);
        break;
      }
    }
  };

  // 1) outline pass, 2) back limbs, 3) torso, 4) front leg, 5) head, 6) front arm
  drawArm(1, true);
  drawLeg(1, true);
  drawLeg(0, true);
  stroke(hip, neck, 7.4, line);
  disc(headC, 4.6, line);
  drawArm(0, true);

  drawArm(1, false);
  drawLeg(1, false);
  // torso (+ coat tails over the thighs)
  stroke(hip, neck, 5, top);
  const chest = seg(hip, 180 + j.torso, T * 0.55);
  stroke(seg(chest, 90 + j.torso, 1.6), seg(neck, 90 + j.torso, 1.2), 1.4, shade(top) === top ? pal.mid2 : shade(top));
  if (o.coat) {
    const tail = seg(hip, j.th[0] * 0.5, 6);
    stroke(hip, tail, 5, top);
  }
  if (o.tie) stroke(seg(neck, 180 + j.torso, -0.5), seg(neck, j.torso, 5), 1, pal.accent === top ? pal.white : pal.accent);
  if (o.number) {
    const c = seg(hip, 180 + j.torso, T * 0.6);
    ctx.fillStyle = pal.white;
    ctx.fillRect(Math.round(c.x - 1), Math.round(c.y - 1), 3, 3);
  }
  drawLeg(0, false);

  // head: skin disc, hair on the back half, eye towards the facing side
  disc(headC, 3.4, skin);
  const style = o.hairStyle ?? 'short';
  if (style !== 'bald' && style !== 'none') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(headC.x, headC.y, style === 'afro' ? 4.6 : 3.6, Math.PI * 0.95 + (j.torso + j.head) * 0.0174, Math.PI * 2.05 + (j.torso + j.head) * 0.0174);
    ctx.fill();
    if (style === 'long') stroke(seg(headC, -90 + j.torso, 2.5), seg(seg(headC, -90 + j.torso, 2.5), j.torso * 0.3, 6), 2.4, hair);
  }
  const eye = seg(headC, 90 + j.torso + j.head, 1.8);
  ctx.fillStyle = pal.black;
  ctx.fillRect(Math.round(eye.x), Math.round(eye.y - 0.5), 1, 1);
  if (o.mustache) {
    const m = seg(seg(headC, 90 + j.torso + j.head, 2), j.torso, 1.6);
    ctx.fillRect(Math.round(m.x - 1), Math.round(m.y), 2, 1);
  }
  const hatColor = col(pal, o.hatColor, pal.black);
  const crown = seg(headC, 180 + j.torso + j.head, 3);
  switch (o.hat) {
    case 'tophat':
      stroke(seg(crown, 90 + j.torso, -3.5), seg(crown, 90 + j.torso, 3.5), 1.4, hatColor);
      stroke(crown, seg(crown, 180 + j.torso + j.head, 5), 5, hatColor);
      stroke(seg(crown, 180 + j.torso, 1.2), seg(crown, 180 + j.torso, 1.2), 5, pal.accent);
      break;
    case 'bowler':
      stroke(seg(crown, 90 + j.torso, -3.2), seg(crown, 90 + j.torso, 3.2), 1.2, hatColor);
      disc(seg(crown, 180 + j.torso, 1), 2.8, hatColor);
      break;
    case 'cap':
    case 'police':
      disc(crown, 3.2, hatColor);
      stroke(crown, seg(crown, 90 + j.torso + j.head, 4.5), 1.2, hatColor);
      if (o.hat === 'police') ctx.fillStyle = pal.white, ctx.fillRect(Math.round(crown.x), Math.round(crown.y - 1), 1, 1);
      break;
    case 'helmet':
      disc(seg(headC, 180 + j.torso, 0.6), 4, hatColor);
      break;
    case 'beret':
      disc(seg(crown, 180 + j.torso, 0.4), 3, hatColor);
      break;
  }
  drawArm(0, false);
};

// A figure as a positioned element (centre-bottom anchor at x,y screen px).
export const Figure: React.FC<{
  joints: Joints;
  outfit: Outfit;
  pal: PaletteA;
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  rot?: number;
  opacity?: number;
}> = ({joints, outfit, pal, x, y, scale = 6, flip, rot = 0, opacity = 1}) => {
  const key = JSON.stringify(joints) + JSON.stringify(outfit);
  const w = FIG_W * scale;
  const h = FIG_H * scale;
  // anchor = the feet of a standing figure (hip y + leg length)
  const ax = HIP.x * scale;
  const ay = (HIP.y + TH + SH + 1) * scale;
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round((x - ax) / 3) * 3,
        top: Math.round((y - ay) / 3) * 3,
        width: w,
        height: h,
        opacity,
        transformOrigin: `${ax}px ${ay}px`,
        transform: `${flip ? 'scaleX(-1) ' : ''}rotate(${rot}deg)`,
      }}
    >
      <PixelCanvas w={FIG_W} h={FIG_H} scale={scale} deps={[key, pal]} draw={(ctx) => drawFigure(ctx, joints, outfit, pal)} />
    </div>
  );
};
