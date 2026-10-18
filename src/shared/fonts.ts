import {continueRender, delayRender, staticFile} from 'remotion';

// Pixel fonts (OFL). "latin" covers é è à ç ù ê…, "latin-ext" adds Œ and friends.
const FACES: {family: string; file: string; weight: string; range?: string}[] = [
  {family: 'VT323', file: 'vt323-latin-400-normal.woff2', weight: '400'},
  {family: 'VT323', file: 'vt323-latin-ext-400-normal.woff2', weight: '400', range: 'U+0100-024F'},
  {family: 'Silkscreen', file: 'silkscreen-latin-400-normal.woff2', weight: '400'},
  {family: 'Silkscreen', file: 'silkscreen-latin-ext-400-normal.woff2', weight: '400', range: 'U+0100-024F'},
  {family: 'Silkscreen', file: 'silkscreen-latin-700-normal.woff2', weight: '700'},
  {family: 'Silkscreen', file: 'silkscreen-latin-ext-700-normal.woff2', weight: '700', range: 'U+0100-024F'},
  {family: 'Tiny5', file: 'tiny5-latin-400-normal.woff2', weight: '400'},
  {family: 'Tiny5', file: 'tiny5-latin-ext-400-normal.woff2', weight: '400', range: 'U+0100-024F'},
  {family: 'Pixelify Sans', file: 'pixelify-sans-latin-400-normal.woff2', weight: '400'},
  {family: 'Pixelify Sans', file: 'pixelify-sans-latin-700-normal.woff2', weight: '700'},
  {family: 'Pixelify Sans', file: 'pixelify-sans-latin-ext-700-normal.woff2', weight: '700', range: 'U+0100-024F'},
  {family: 'Press Start 2P', file: 'press-start-2p-latin-400-normal.woff2', weight: '400'},
  {family: 'Press Start 2P', file: 'press-start-2p-latin-ext-400-normal.woff2', weight: '400', range: 'U+0100-024F'},
  {family: 'Archivo Black', file: 'archivo-black-latin-400-normal.woff2', weight: '400'},
  {family: 'Archivo Black', file: 'archivo-black-latin-ext-400-normal.woff2', weight: '400', range: 'U+0100-024F'},
];

let loaded = false;

export const loadFonts = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('pixel fonts');
  Promise.all(
    FACES.map((f) => {
      const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format('woff2')`, {
        weight: f.weight,
        ...(f.range ? {unicodeRange: f.range} : {}),
      });
      return face.load().then((ff) => document.fonts.add(ff));
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};

export const FONT = {
  caption: "'VT323', monospace",
  hud: "'Silkscreen', monospace",
  digits: "'Tiny5', monospace",
  title: "'Pixelify Sans', sans-serif",
  // style B
  bLabel: "'Press Start 2P', monospace",
  bTitle: "'Archivo Black', sans-serif",
} as const;
