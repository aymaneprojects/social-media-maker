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
}> = ({w, h, scale, draw, deps, style}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    // Kill anti-aliasing: every pixel becomes fully opaque or transparent.
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    // (getImageData is not premultiplied, so only alpha needs snapping)
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
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
