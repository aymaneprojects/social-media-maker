// Style-B illustrations: generated with the reference sheets cut from the
// original videos as style references, then snapped onto the measured
// palette and pixel grid (pixelizeColor). Character poses are made by editing
// the base image, so the same character stays consistent across a video.
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {generateImage, MODELS} from './openrouter';
import {pixelizeColor} from './pixelize';

const STYLE_DIR = 'assets/style-b';
const CACHE = 'data/cache/illustrations';

export type AssetKind = 'character' | 'object' | 'hand' | 'prop' | 'scene';

export type AssetSpec = {
  id: string;
  kind: AssetKind;
  prompt: string; // English description of the subject
  poses?: Record<string, string>; // poseName -> how it differs from the base ("raising a sledgehammer above his head")
};

export type AssetFiles = {poses: Record<string, {file: string; w: number; h: number}>};

const STYLE = `Pixel art illustration in EXACTLY the art style of the reference sheet: chunky visible square pixels, the subject is about 130 pixels tall on the pixel grid, warm limited palette (ochre, gold, mustard, brown, cream, warm greys, charcoal suits) plus at most one local colour when the subject needs it, flat shading with ordered dithering for gradients, crisp edges, no anti-aliasing, no outline glow.
Composition: ONE isolated subject, centred, fully visible with a margin, on a PURE BLACK background. No floor, no scenery, no shadow on the ground.
Never draw text, letters, numbers, logos, watermarks, frames or borders.`;

const KIND_HINT: Record<AssetKind, string> = {
  character: 'Full body character, standing, three-quarter view, simple readable face.',
  object: 'Single object, three-quarter view, large and readable.',
  hand: 'A single hand and forearm with a sleeve cuff, coming from the right edge, fingers relaxed as if about to grab something.',
  prop: 'Small single prop, front view, large in frame.',
  scene: 'Small self-contained scene (a building, a landscape element) floating on black, no horizon line.',
};

const sheetFor = (kind: AssetKind) => readFileSync(path.join(STYLE_DIR, kind === 'character' || kind === 'hand' ? 'sheet-characters.png' : 'sheet-objects.png'));

const palette = () => JSON.parse(readFileSync(path.join(STYLE_DIR, 'palette.json'), 'utf8')) as string[];

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);

const MAX_SIDE: Record<AssetKind, number> = {character: 150, object: 140, hand: 110, prop: 80, scene: 170};

// Raw generation with a disk cache (same prompt => same image, no extra cost).
const generateRaw = async (key: string, prompt: string, images: Buffer[]) => {
  mkdirSync(CACHE, {recursive: true});
  const file = path.join(CACHE, `${hash(`${MODELS.image}|${key}`)}.png`);
  if (existsSync(file)) return readFileSync(file);
  const buf = await generateImage(prompt, {images, aspect: '1:1'});
  writeFileSync(file, buf);
  return buf;
};

export const illustrate = async (spec: AssetSpec, outDir: string): Promise<AssetFiles> => {
  mkdirSync(outDir, {recursive: true});
  const pal = palette();
  const basePrompt = `${STYLE}\n${KIND_HINT[spec.kind]}\nSubject: ${spec.prompt}`;
  const baseRaw = await generateRaw(`base|${spec.kind}|${spec.prompt}`, basePrompt, [sheetFor(spec.kind)]);
  const out: AssetFiles = {poses: {}};
  const save = async (pose: string, raw: Buffer) => {
    const {png, width, height} = await pixelizeColor(raw, {maxSide: MAX_SIDE[spec.kind], palette: pal});
    const file = `${spec.id}_${pose}.png`;
    writeFileSync(path.join(outDir, file), png);
    out.poses[pose] = {file, w: width, h: height};
  };
  await save('base', baseRaw);
  for (const [pose, change] of Object.entries(spec.poses ?? {})) {
    const editPrompt = `Edit the second image: keep EXACTLY the same character/object, same pixel size, same palette, same scale and same position in the frame, same pure black background. Only change: ${change}. The first image is the style reference. No text.`;
    const raw = await generateRaw(`pose|${spec.prompt}|${pose}|${change}`, editPrompt, [sheetFor(spec.kind), baseRaw]);
    await save(pose, raw);
  }
  return out;
};
