import React, {useLayoutEffect, useRef} from 'react';

// Low-resolution canvas scaled up with nearest-neighbour: anything drawn in
// it (maps, terrain, gradients) becomes genuine pixel art.
export const PixelCanvas: React.FC<{
  w: number; // art pixels
  h: number;
  scale: number; // screen px per art pixel
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  deps: unknown[];
  style?: React.CSSProperties;
  quantize?: string[]; // snap every pixel to the nearest of these colours (no blended edge colours)
}> = ({w, h, scale, draw, deps, style, quantize}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d', {willReadFrequently: true});
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    // Kill anti-aliasing: every pixel becomes fully opaque or transparent.
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    // (getImageData is not premultiplied, so only alpha needs snapping)
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
    if (quantize?.length) {
      const pal = quantize.map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < pal.length; k++) {
          const dr = d[i] - pal[k][0];
          const dg = d[i + 1] - pal[k][1];
          const db = d[i + 2] - pal[k][2];
          const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
          if (dist < bd) {
            bd = dist;
            best = k;
          }
        }
        d[i] = pal[best][0];
        d[i + 1] = pal[best][1];
        d[i + 2] = pal[best][2];
      }
    }
    ctx.putImageData(img, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{width: w * scale, height: h * scale, imageRendering: 'pixelated', position: 'absolute', ...style}}
    />
  );
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// Fill a rect with an ordered-dither gradient between transparent and color.
export const ditherFill = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: string,
  amount: (x: number, y: number) => number, // 0..1 coverage
) => {
  ctx.fillStyle = color;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (amount(x, y) > BAYER4[(y & 3) * 4 + (x & 3)]) ctx.fillRect(x, y, 1, 1);
    }
  }
};
