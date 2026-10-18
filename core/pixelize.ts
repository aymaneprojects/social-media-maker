// Turns any AI illustration into on-palette pixel art:
// downscale -> luminance ramp with ordered (Bayer) dithering -> optional
// "light" colour kept for saturated highlights -> optional transparent black.
// The low-res PNG is upscaled in the browser with image-rendering: pixelated.
import sharp from 'sharp';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

const hex = (h: string) => {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
};

export type PixelizeOptions = {
  width: number; // art pixels
  height: number;
  ramp: string[]; // dark -> light
  // saturated pixels whose hue falls in a band are painted with a fixed colour
  keep?: {hueMin: number; hueMax: number; minSat: number; minLight?: number; color: string}[];
  dither?: number; // 0..1 (default 0.9)
  contrast?: number; // >1 increases contrast before mapping
  transparentBelow?: number; // luminance (0..1) under which pixels become transparent
  fit?: 'cover' | 'contain';
};

export const pixelize = async (input: Buffer, o: PixelizeOptions): Promise<Buffer> => {
  const {data, info} = await sharp(input)
    .resize(o.width, o.height, {fit: o.fit ?? 'cover', kernel: 'lanczos3', background: {r: 0, g: 0, b: 0, alpha: 1}})
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  const ramp = o.ramp.map(hex);
  const keep = (o.keep ?? []).map((k) => ({...k, rgb: hex(k.color)}));
  const out = Buffer.alloc(info.width * info.height * 4);
  const dither = o.dither ?? 0.9;
  const contrast = o.contrast ?? 1.15;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      lum = Math.min(1, Math.max(0, (lum - 0.5) * contrast + 0.5));
      const j = (y * info.width + x) * 4;
      if (o.transparentBelow !== undefined && lum < o.transparentBelow) {
        out[j + 3] = 0;
        continue;
      }
      const [h, s, l] = rgbToHsl(r, g, b);
      const k = keep.find((kk) => s >= kk.minSat && l >= (kk.minLight ?? 0.25) && (kk.hueMin <= kk.hueMax ? h >= kk.hueMin && h <= kk.hueMax : h >= kk.hueMin || h <= kk.hueMax));
      let rgb: number[];
      if (k) rgb = k.rgb;
      else {
        const pos = lum * (ramp.length - 1) + BAYER4[(y & 3) * 4 + (x & 3)] * dither;
        const idx = Math.max(0, Math.min(ramp.length - 1, Math.round(pos)));
        rgb = ramp[idx];
      }
      out[j] = rgb[0];
      out[j + 1] = rgb[1];
      out[j + 2] = rgb[2];
      out[j + 3] = 255;
    }
  }
  return sharp(out, {raw: {width: info.width, height: info.height, channels: 4}}).png().toBuffer();
};

// Style B: keeps the colours of the illustration but snaps them onto the
// palette measured on the reference videos, on a coarse pixel grid, and cuts
// the black background out (flood fill from the borders, inner blacks stay).
export const pixelizeColor = async (
  input: Buffer,
  o: {maxSide: number; palette: string[]; dither?: number; bgLum?: number},
): Promise<{png: Buffer; width: number; height: number}> => {
  const {data, info} = await sharp(input)
    .resize(o.maxSide, o.maxSide, {fit: 'inside', kernel: 'lanczos3'})
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  const W = info.width;
  const H = info.height;
  const pal = o.palette.map(hex);
  const dither = (o.dither ?? 0.22) * 48;
  const rgba = Buffer.alloc(W * H * 4);
  const lum = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const off = BAYER4[(y & 3) * 4 + (x & 3)] * dither;
      const r = data[i] + off;
      const g = data[i + 1] + off;
      const b = data[i + 2] + off;
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < pal.length; k++) {
        const dr = r - pal[k][0];
        const dg = g - pal[k][1];
        const db = b - pal[k][2];
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      const j = (y * W + x) * 4;
      rgba[j] = pal[best][0];
      rgba[j + 1] = pal[best][1];
      rgba[j + 2] = pal[best][2];
      rgba[j + 3] = 255;
      lum[y * W + x] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }
  }
  // flood fill the background from the borders. The background colour is
  // read on the border (usually black, sometimes white or grey).
  const borderIdx: number[] = [];
  for (let x = 0; x < W; x++) borderIdx.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) borderIdx.push(y * W, y * W + W - 1);
  const counts = new Map<number, number>();
  borderIdx.forEach((p) => {
    const i = p * 3;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const bgKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const bgRgb = [((bgKey >> 8) & 15) * 16 + 8, ((bgKey >> 4) & 15) * 16 + 8, (bgKey & 15) * 16 + 8];
  const darkBg = (0.2126 * bgRgb[0] + 0.7152 * bgRgb[1] + 0.0722 * bgRgb[2]) / 255 < 0.15;
  const isBg = (p: number) => {
    if (darkBg) return lum[p] <= (o.bgLum ?? 0.085);
    const i = p * 3;
    const d = Math.abs(data[i] - bgRgb[0]) + Math.abs(data[i + 1] - bgRgb[1]) + Math.abs(data[i + 2] - bgRgb[2]);
    return d < 60;
  };
  const seen = new Uint8Array(W * H);
  const stack: number[] = [...borderIdx];
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p] || !isBg(p)) continue;
    seen[p] = 1;
    rgba[p * 4 + 3] = 0;
    const x = p % W;
    const y = (p / W) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  // trim to the opaque bounding box
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (rgba[(y * W + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) throw new Error('illustration is empty after background removal');
  const png = await sharp(rgba, {raw: {width: W, height: H, channels: 4}})
    .extract({left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1})
    .png()
    .toBuffer();
  return {png, width: x1 - x0 + 1, height: y1 - y0 + 1};
};

// Palettes tuned on the reference frames.
export const RAMP_A = (pal: {bg: string; plum: string; plum2: string; mid1: string; mid2: string; mid3: string; paper: string; white: string}) => [
  pal.bg,
  pal.plum,
  pal.plum2,
  pal.mid1,
  pal.mid2,
  pal.mid3,
  pal.paper,
  pal.white,
];

export const RAMP_B = ['#040200', '#1A1003', '#553A16', '#A67A30', '#E2B04A', '#F1E6CF', '#FFFFFF'];
