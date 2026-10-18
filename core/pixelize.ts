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
