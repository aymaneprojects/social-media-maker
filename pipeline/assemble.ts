// Storyboard + voice timings -> episode.json (what Remotion renders).
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {generateImage} from '../core/openrouter';
import {pixelize, RAMP_A, RAMP_B} from '../core/pixelize';
import type {Word} from '../core/voice';
import {paletteA} from '../src/shared/palette';
import type {Episode} from '../src/shared/schema';
import type {BrandConfig} from './brands';
import type {Storyboard} from './steps';

export const SCENES = {
  A: ['bigDate', 'counter', 'iconGrid', 'checklist', 'clock', 'gauge', 'stamp', 'bigWord', 'typedNote', 'dossier', 'portrait', 'map', 'backdrop', 'image', 'radar', 'inventory', 'thought'],
  B: ['prop', 'title', 'counter', 'map', 'nameTag', 'barCompare', 'balance', 'calendar', 'timeline', 'stamp', 'split', 'thought', 'icons', 'image', 'clues', 'versus', 'listing'],
} as const;

const SFX = ['beep', 'beep-low', 'blip', 'tick', 'type', 'stamp', 'boom', 'glitch', 'pixel', 'whoosh', 'counter', 'heartbeat', 'alarm', 'swell', 'splash', 'thunder', 'pop', 'ding', 'cash'];
const TRANSITIONS = ['cut', 'pixelDissolve', 'glitch', 'flash', 'pop'];

const tokens = (s: string) => s.trim().split(/\s+/).filter(Boolean);

export const validateStoryboard = (style: 'A' | 'B') => (sb: Storyboard): string[] => {
  const errors: string[] = [];
  if (!Array.isArray(sb.beats) || sb.beats.length < 8) errors.push('il faut au moins 8 beats');
  const words = sb.beats?.reduce((n, b) => n + tokens(b.text ?? '').length, 0) ?? 0;
  const [minW, maxW] = style === 'A' ? [140, 185] : [250, 360];
  if (words < minW || words > maxW) errors.push(`la voix off fait ${words} mots, il en faut entre ${minW} et ${maxW}`);
  const images = sb.beats?.filter((b) => b.imagePrompt).length ?? 0;
  const maxImages = style === 'A' ? 6 : 14;
  if (images > maxImages) errors.push(`${images} imagePrompt, maximum ${maxImages}`);
  sb.beats?.forEach((b, i) => {
    if (!b.text?.trim()) errors.push(`beat ${i} : texte vide`);
    if (!b.scene || !(SCENES[style] as readonly string[]).includes(b.scene.type)) errors.push(`beat ${i} : scène inconnue "${b.scene?.type}"`);
    if (b.scene?.type === 'image' && !b.imagePrompt) errors.push(`beat ${i} : une scène image exige imagePrompt`);
    if (b.transition && !TRANSITIONS.includes(b.transition)) errors.push(`beat ${i} : transition inconnue "${b.transition}"`);
    (b.sfx ?? []).forEach((s) => {
      if (!SFX.includes(s)) errors.push(`beat ${i} : son inconnu "${s}"`);
    });
    if (tokens(b.text ?? '').length > 14) errors.push(`beat ${i} : trop long (${tokens(b.text).length} mots, max 14)`);
  });
  if (style === 'A' && !sb.beats?.[0]?.hud) errors.push('le beat 0 doit définir hud.clock et hud.label');
  return errors;
};

// Beat i spans from its first word to the first word of beat i+1.
export const timeBeats = (sb: Storyboard, words: Word[]) => {
  let k = 0;
  const starts: number[] = [];
  sb.beats.forEach((b) => {
    starts.push(k);
    k += tokens(b.text).length;
  });
  if (k !== words.length) console.warn(`token mismatch: storyboard ${k} vs words ${words.length}`);
  const voiceEnd = words[words.length - 1]?.endMs ?? 0;
  return sb.beats.map((_, i) => {
    const s = i === 0 ? 0 : (words[Math.min(starts[i], words.length - 1)]?.startMs ?? 0) - 60;
    const e = i === sb.beats.length - 1 ? voiceEnd + 700 : (words[Math.min(starts[i + 1], words.length - 1)]?.startMs ?? voiceEnd) - 60;
    return {startMs: Math.max(0, s), endMs: Math.max(s + 400, e)};
  });
};

const IMAGE_STYLE = {
  A: 'Detailed pixel art illustration, 2D, dark moody night scene, strong silhouette, simple composition centered, high contrast between a few light areas and deep shadows, monochrome, no text, no letters, no frame, no border.',
  B: 'Detailed pixel art illustration, 2D, single subject centered on a pure black background, warm gold lighting, clean readable shapes, no text, no letters, no frame, no border, no background scenery.',
};

// Without an image, scenes fall back to code-drawn equivalents.
const applyImageFallback = (b: Storyboard['beats'][number]) => {
  const sc = b.scene as Record<string, unknown> & {type: string};
  if (sc.type !== 'image') return;
  const fb = sc.fallback as Record<string, unknown> | undefined;
  b.scene = (fb as never) ?? {type: 'backdrop', terrain: 'none', fx: sc.fx ?? ['stars'], pins: sc.pins};
};

export const makeImages = async (style: 'A' | 'B', brand: BrandConfig, sb: Storyboard, dir: string) => {
  mkdirSync(path.join(dir, 'img'), {recursive: true});
  const pal = paletteA(brand.accent);
  let n = 0;
  for (const [i, b] of sb.beats.entries()) {
    if (!b.imagePrompt) continue;
    n++;
    const file = `img/b${String(i).padStart(2, '0')}.png`;
    const abs = path.join(dir, file);
    if (!existsSync(abs)) {
      const isPortrait = b.scene.type === 'dossier' || b.scene.type === 'portrait' || b.scene.type === 'nameTag';
      const aspect = isPortrait ? '3:4' : b.scene.type === 'image' && b.scene.fit !== 'card' ? '9:16' : '1:1';
      const prompt = `${b.imagePrompt}. ${IMAGE_STYLE[style]}${isPortrait ? ' Head and shoulders portrait, facing camera, plain dark background.' : ''}`;
      console.log(`image ${n}: ${b.imagePrompt.slice(0, 70)}`);
      try {
        const raw = await generateImage(prompt, {aspect});
        writeFileSync(abs.replace('.png', '.raw.png'), raw);
        const [w, h] = aspect === '9:16' ? [180, 320] : aspect === '3:4' ? [120, 160] : [150, 150];
        const png =
          style === 'A'
            ? await pixelize(raw, {
                width: w,
                height: h,
                ramp: RAMP_A(pal),
                keep: [{hueMin: 330, hueMax: 30, minSat: 0.55, minLight: 0.35, color: pal.accent}],
              })
            : await pixelize(raw, {
                width: w,
                height: h,
                ramp: RAMP_B,
                keep: [
                  {hueMin: 345, hueMax: 15, minSat: 0.5, minLight: 0.3, color: '#D8312E'},
                  {hueMin: 90, hueMax: 160, minSat: 0.4, minLight: 0.3, color: '#3DBE5A'},
                  {hueMin: 190, hueMax: 250, minSat: 0.35, minLight: 0.2, color: '#2E5C9A'},
                ],
                transparentBelow: b.scene.type === 'prop' ? 0.06 : undefined,
                fit: 'contain',
              });
        writeFileSync(abs, png);
      } catch (e) {
        console.warn(`image failed for beat ${i}: ${(e as Error).message.slice(0, 160)}`);
        applyImageFallback(b);
        continue;
      }
    }
    if (b.scene.type === 'dossier' || b.scene.type === 'portrait' || b.scene.type === 'nameTag') b.scene.image = file;
    else b.scene.src = file;
  }
};

// Sound design: storyboard cues + automatic cues derived from the scenes.
export const buildAudio = (style: 'A' | 'B', sb: Storyboard, timing: {startMs: number; endMs: number}[], durationMs: number) => {
  const sfx: Episode['audio']['sfx'] = [];
  const add = (name: string, atMs: number, volume = 0.4) => sfx.push({src: `sfx/${name}.wav`, atMs: Math.max(0, Math.round(atMs)), volume});
  sb.beats.forEach((b, i) => {
    const t = timing[i].startMs;
    const dur = timing[i].endMs - t;
    (b.sfx ?? []).forEach((s) => add(s, t, 0.45));
    if (b.transition === 'pixelDissolve') add('pixel', t - 80, 0.35);
    if (b.transition === 'glitch') add('glitch', t, 0.35);
    if (b.transition === 'flash') add('boom', t, 0.5);
    switch (b.scene.type) {
      case 'stamp':
        add('stamp', t + 60, 0.55);
        break;
      case 'counter':
        add('counter', t + 50, 0.22);
        break;
      case 'dossier':
      case 'nameTag':
      case 'typedNote':
        for (let k = 0; k < 4; k++) add('type', t + 200 + k * 220, 0.22);
        break;
      case 'checklist':
        ((b.scene.items as unknown[]) ?? []).forEach((_, k, arr) => add('beep', t + (k * dur * 0.7) / arr.length + 60, 0.25));
        break;
      case 'iconGrid':
        for (let k = 0; k < 5; k++) add('tick', t + dur * (0.15 + k * 0.12), 0.25);
        break;
      case 'backdrop':
        ((b.scene.flashAt as number[]) ?? []).forEach((f) => add('thunder', t + f, 0.5));
        break;
      case 'prop':
      case 'title':
        if (style === 'B') add('pop', t, 0.3);
        break;
    }
  });
  add('sting', durationMs - 2000, 0.35);
  const ambience: Episode['audio']['ambience'] = (sb.ambience ?? []).map((a) => ({
    src: `sfx/${a.sound}.mp3`,
    fromMs: timing[Math.max(0, Math.min(timing.length - 1, a.fromBeat - 1))]?.startMs ?? 0,
    toMs: timing[Math.max(0, Math.min(timing.length - 1, a.toBeat - 1))]?.endMs ?? durationMs,
    volume: a.volume ?? 0.25,
  }));
  if (!ambience.length) ambience.push({src: 'sfx/amb-drone.mp3', fromMs: 0, toMs: durationMs - 2000, volume: 0.22});
  return {sfx, ambience};
};

export const assembleEpisode = (opts: {
  id: string;
  brand: BrandConfig;
  issue: number;
  sb: Storyboard;
  words: Word[];
  assetsBase: string;
  music?: string;
}): Episode => {
  const {brand, sb, words} = opts;
  const timing = timeBeats(sb, words);
  const endCardMs = 2000;
  const durationMs = timing[timing.length - 1].endMs + endCardMs;
  const audio = buildAudio(brand.style, sb, timing, durationMs);
  return {
    id: opts.id,
    brand: {slug: brand.slug, name: brand.name, handle: brand.handle, style: brand.style, accent: brand.accent, lang: brand.lang},
    issue: opts.issue,
    endCard: sb.endCard,
    durationMs,
    words,
    assetsBase: opts.assetsBase,
    beats: sb.beats.map((b, i) => ({
      id: `b${i}`,
      startMs: timing[i].startMs,
      endMs: timing[i].endMs,
      text: b.text,
      scene: b.scene,
      transition: (b.transition ?? 'cut') as Episode['beats'][number]['transition'],
      hud: b.hud,
      annotation: b.annotation,
      keyword: b.keyword,
    })),
    audio: {
      voice: 'voice.mp3',
      music: opts.music ? {src: opts.music, volume: 0.16} : undefined,
      ambience: audio.ambience,
      sfx: audio.sfx,
    },
  };
};
