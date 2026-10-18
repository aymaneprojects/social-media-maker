// Palettes are derived from a single accent colour so every brand keeps the
// contrast ratios measured on the reference videos.

export type PaletteA = {
  bg: string; // near-black, hue-tinted (#060309 on the magenta reference)
  plum: string; // dark panels (#1E101C)
  plum2: string; // slightly lighter panels (#261427)
  mid1: string; // shadows of illustrations (#5E334F)
  mid2: string; // mid tones (#75465C)
  mid3: string; // light mid tones (#94617B)
  paper: string; // dossier paper (#F2D0DF)
  accent: string;
  accentDark: string; // caption echo / outlines
  white: string;
  black: string;
};

export type PaletteB = {
  bg: string; // warm black (#040200)
  halo: string; // radial glow centre (#0E0801)
  gold: string; // main gold (#E2B04A)
  goldDark: string; // dithered shadows (#A67A30)
  goldDeep: string; // deep brown (#553A16)
  cream: string; // objects / text (#F1E6CF)
  grey: string; // secondary objects (#9A9590)
  accent: string; // brand accent (gold for business, ice blue for science…)
  red: string; // stamps INTERDIT / RATÉ
  green: string; // AUTORISÉ / ✓
  water: string; // night blue water
  white: string;
  black: string;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const rgbToHsl = ([r, g, b]: [number, number, number]): [number, number, number] => {
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

export const hsl = (h: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const accentHue = (accent: string) => rgbToHsl(hexToRgb(accent))[0];

export const withAlpha = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

const REFERENCE_A: PaletteA = {
  bg: '#060309',
  plum: '#1E101C',
  plum2: '#261427',
  mid1: '#5E334F',
  mid2: '#75465C',
  mid3: '#94617B',
  paper: '#F2D0DF',
  accent: '#FF448D',
  accentDark: '#6B1638',
  white: '#FFFFFF',
  black: '#000000',
};

export const paletteA = (accent: string): PaletteA => {
  if (accent.toUpperCase() === REFERENCE_A.accent) return REFERENCE_A;
  const h = accentHue(accent);
  return {
    bg: hsl(h, 0.5, 0.025),
    plum: hsl(h, 0.3, 0.09),
    plum2: hsl(h, 0.32, 0.12),
    mid1: hsl(h, 0.28, 0.28),
    mid2: hsl(h, 0.25, 0.37),
    mid3: hsl(h, 0.22, 0.48),
    paper: hsl(h, 0.6, 0.88),
    accent,
    accentDark: hsl(h, 0.66, 0.25),
    white: '#FFFFFF',
    black: '#000000',
  };
};

export const paletteB = (accent: string): PaletteB => ({
  bg: '#040200',
  halo: '#120A02',
  gold: '#E2B04A',
  goldDark: '#A67A30',
  goldDeep: '#553A16',
  cream: '#F1E6CF',
  grey: '#9A9590',
  accent,
  red: '#D8312E',
  green: '#3DBE5A',
  water: '#1B2A4A',
  white: '#FFFFFF',
  black: '#000000',
});
