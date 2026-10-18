import React from 'react';

// Pixel-art helpers. Every drawing lives on an "art pixel" grid and is
// rendered as SVG rects with crisp edges, so it stays perfectly sharp at
// 1080x1920 whatever the scale.

export type ColorMap = Record<string, string>;

// Merge horizontal runs of the same character into a single rect.
const runs = (rows: string[]) => {
  const out: {x: number; y: number; w: number; c: string}[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === '.' || c === ' ') {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w++;
      out.push({x, y, w, c});
      x += w;
    }
  });
  return out;
};

const cache = new Map<string, ReturnType<typeof runs>>();
const runsCached = (art: string[]) => {
  const key = art.join('\n');
  let r = cache.get(key);
  if (!r) {
    r = runs(art);
    cache.set(key, r);
  }
  return r;
};

export const Sprite: React.FC<{
  art: string[];
  colors: ColorMap;
  x?: number;
  y?: number;
  scale?: number; // screen pixels per art pixel
  flipX?: boolean;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({art, colors, x = 0, y = 0, scale = 6, flipX = false, opacity = 1, style}) => {
  const w = Math.max(...art.map((r) => r.length));
  const h = art.length;
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: flipX ? 'scaleX(-1)' : undefined,
        overflow: 'visible',
        ...style,
      }}
    >
      {runsCached(art).map((r, i) =>
        colors[r.c] ? <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={colors[r.c]} /> : null,
      )}
    </svg>
  );
};

export const spriteSize = (art: string[]) => ({w: Math.max(...art.map((r) => r.length)), h: art.length});

// Ordered-dither (Bayer 4x4) threshold, used to fade shapes with a pixel "trame".
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)];

// SVG <pattern> producing a 50% checker / sparse dot trame.
export const DitherDefs: React.FC<{id: string; color: string; cell?: number; density?: 'checker' | 'sparse' | 'dense'}> = ({
  id,
  color,
  cell = 6,
  density = 'checker',
}) => {
  const c = cell;
  return (
    <defs>
      <pattern id={id} width={c * 2} height={c * 2} patternUnits="userSpaceOnUse">
        {density === 'checker' && (
          <>
            <rect x={0} y={0} width={c} height={c} fill={color} />
            <rect x={c} y={c} width={c} height={c} fill={color} />
          </>
        )}
        {density === 'sparse' && <rect x={0} y={0} width={c} height={c} fill={color} />}
        {density === 'dense' && (
          <>
            <rect x={0} y={0} width={c} height={c} fill={color} />
            <rect x={c} y={c} width={c} height={c} fill={color} />
            <rect x={c} y={0} width={c} height={c} fill={color} />
          </>
        )}
      </pattern>
    </defs>
  );
};

// Snap a value to the art-pixel grid so animated things move pixel by pixel.
export const snap = (v: number, grid = 6) => Math.round(v / grid) * grid;
