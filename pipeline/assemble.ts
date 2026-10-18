// Storyboard + voice timings -> episode.json (what Remotion renders).
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {illustrate} from '../core/illustrate';
import {generateImage} from '../core/openrouter';
import {pixelize, RAMP_A, RAMP_B} from '../core/pixelize';
import type {Word} from '../core/voice';
import {paletteA} from '../src/shared/palette';
import type {Episode} from '../src/shared/schema';
import type {BrandConfig} from './brands';
import type {Storyboard} from './steps';

export const SCENES = {
  A: ['bigDate', 'counter', 'iconGrid', 'checklist', 'clock', 'gauge', 'stamp', 'bigWord', 'typedNote', 'dossier', 'portrait', 'map', 'backdrop', 'image', 'radar', 'inventory', 'thought', 'scoreboard', 'lineChart', 'versus', 'timeline', 'podium', 'newspaper', 'action'],
  B: ['stage', 'prop', 'title', 'counter', 'map', 'nameTag', 'barCompare', 'balance', 'calendar', 'timeline', 'split', 'thought', 'icons', 'listing'],
} as const;

const SFX = ['beep', 'beep-low', 'blip', 'tick', 'type', 'stamp', 'boom', 'glitch', 'pixel', 'whoosh', 'counter', 'heartbeat', 'alarm', 'swell', 'splash', 'thunder', 'pop', 'ding', 'cash', 'sting'];
const TRANSITIONS = ['cut', 'pixelDissolve', 'glitch', 'flash', 'pop'];

const tokens = (s: string) => s.trim().split(/\s+/).filter(Boolean);

// Mechanical fixes applied before validation (never worth an LLM round trip).
export const autofixStoryboard = (style: 'A' | 'B', sb: Storyboard) => {
  const maxImages = style === 'A' ? 6 : 14;
  let images = 0;
  sb.beats?.forEach((b) => {
    if (b.transition && !TRANSITIONS.includes(b.transition)) b.transition = 'cut';
    if (b.sfx) b.sfx = b.sfx.filter((x) => SFX.includes(x.split('@')[0]));
    if (b.imagePrompt) {
      images++;
      if (images > maxImages && b.scene?.type !== 'image') delete b.imagePrompt;
    }
    if (typeof b.text === 'string') b.text = b.text.replace(/\s+([:;!?])/g, '\u00a0$1').trim();
  });
  return sb;
};

// Hard errors only: these go back to the model for a rewrite.
export const validateStoryboard = (style: 'A' | 'B') => (sb: Storyboard): string[] => {
  autofixStoryboard(style, sb);
  const errors: string[] = [];
  if (!Array.isArray(sb.beats) || sb.beats.length < 8) errors.push('il faut au moins 8 beats');
  const words = sb.beats?.reduce((n, b) => n + tokens(b.text ?? '').length, 0) ?? 0;
  const [minW, maxW] = style === 'A' ? [130, 195] : [240, 380];
  if (words < minW || words > maxW) errors.push(`la voix off fait ${words} mots, il en faut entre ${minW} et ${maxW}`);
  sb.beats?.forEach((b, i) => {
    if (!b.text?.trim()) errors.push(`beat ${i} : texte vide`);
    if (!b.scene || !(SCENES[style] as readonly string[]).includes(b.scene.type)) errors.push(`beat ${i} : scène inconnue "${b.scene?.type}" (autorisées : ${SCENES[style].join(', ')})`);
    if (b.scene?.type === 'image' && !b.imagePrompt) errors.push(`beat ${i} : une scène image exige imagePrompt`);
    if (tokens(b.text ?? '').length > 18) errors.push(`beat ${i} : trop long (${tokens(b.text).length} mots, max 14)`);
  });
  if (style === 'A' && !sb.beats?.[0]?.hud) errors.push('le beat 0 doit définir hud.clock et hud.label');
  const count = (t: string) => sb.beats?.filter((b) => b.scene?.type === t).length ?? 0;
  if (style === 'A' && count('bigWord') > 3) errors.push(`bigWord utilisé ${count('bigWord')} fois (max 3) : remplace par des scènes visuelles`);
  sb.beats?.forEach((b, i) => {
    if (i > 0 && b.scene?.type && b.scene.type === sb.beats[i - 1].scene?.type && !['prop', 'backdrop', 'image', 'stage', 'action'].includes(b.scene.type)) errors.push(`beats ${i - 1} et ${i} : même scène "${b.scene.type}" deux fois de suite`);
  });
  if (!sb.endCard?.place || !sb.post?.caption) errors.push('endCard et post sont obligatoires');
  if (style === 'B') errors.push(...validateAssetsB(sb));
  return errors;
};

// Style B: every asset id used by a scene must be declared, and the stage
// (illustrated layers) must carry most of the video.
const assetRefs = (v: unknown, out: Set<string>) => {
  if (Array.isArray(v)) v.forEach((x) => assetRefs(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if ((k === 'asset' || k === 'portrait') && typeof x === 'string') out.add(x);
      else assetRefs(x, out);
    }
  }
};

export const validateAssetsB = (sb: Storyboard): string[] => {
  const errors: string[] = [];
  const declared = new Set((sb.assets ?? []).map((a) => a.id));
  if (!declared.size) errors.push('aucun asset déclaré dans "assets"');
  if ((sb.assets ?? []).length > 22) errors.push(`${sb.assets!.length} assets déclarés, maximum 22`);
  const poses = (sb.assets ?? []).reduce((n, a) => n + Object.keys(a.poses ?? {}).length, 0);
  if (poses > 14) errors.push(`${poses} poses au total, maximum 14`);
  const used = new Set<string>();
  sb.beats?.forEach((b, i) => {
    const refs = new Set<string>();
    assetRefs(b.scene, refs);
    refs.forEach((r) => {
      used.add(r);
      if (!declared.has(r)) errors.push(`beat ${i} : asset "${r}" non déclaré`);
    });
    const sc = b.scene as {type: string; layers?: unknown[]; keep?: boolean};
    if (sc?.type === 'stage' && !sc.keep && !(sc.layers ?? []).length) errors.push(`beat ${i} : stage sans calque`);
  });
  const stages = sb.beats?.filter((b) => b.scene?.type === 'stage').length ?? 0;
  if (sb.beats?.length && stages / sb.beats.length < 0.5) errors.push(`seulement ${stages} scènes stage sur ${sb.beats.length} (il en faut au moins 50 %)`);
  return errors;
};

// "@mot" in an `at` field = the moment that word is spoken in the beat.
export const resolveWordTimes = (sb: Storyboard, timing: {startMs: number; endMs: number}[], words: Word[]) => {
  const norm = (w: string) =>
    w
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  sb.beats.forEach((b, i) => {
    const beatWords = words.filter((w) => w.startMs >= timing[i].startMs - 80 && w.startMs < timing[i].endMs);
    const walk = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        const o: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v)) {
          if (k === 'at' && typeof x === 'string' && x.startsWith('@')) {
            const target = norm(x.slice(1));
            const w = beatWords.find((bw) => norm(bw.text).startsWith(target)) ?? beatWords.find((bw) => norm(bw.text).includes(target));
            o[k] = w ? Math.max(0, (w.startMs - timing[i].startMs) / 1000) : 0.3;
          } else o[k] = walk(x);
        }
        return o;
      }
      return v;
    };
    b.scene = walk(b.scene) as Storyboard['beats'][number]['scene'];
  });
};

// Generates every declared illustration (with its poses). No fallback: a
// style-B video is never produced with missing illustrations.
export const makeAssetsB = async (sb: Storyboard, dir: string) => {
  const out: NonNullable<Episode['assets']> = {};
  for (const spec of sb.assets ?? []) {
    console.log(`illustration ${spec.id} (${spec.kind}${spec.poses ? `, poses: ${Object.keys(spec.poses).join(', ')}` : ''})`);
    out[spec.id] = await illustrate(spec, path.join(dir, 'assets'));
  }
  return out;
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
export const applyImageFallback = (b: Storyboard['beats'][number]) => {
  const sc = b.scene as Record<string, unknown> & {type: string};
  if (sc.type !== 'image') return;
  const fb = sc.fallback as Record<string, unknown> | undefined;
  b.scene = (fb as never) ?? {type: 'backdrop', terrain: 'none', fx: sc.fx ?? ['stars'], pins: sc.pins};
};

// Pages without AI illustrations: drop every image request, image scenes
// become their code-drawn fallback, portraits use the drawn bust.
export const stripImages = (sb: Storyboard) => {
  sb.beats.forEach((b) => {
    delete b.imagePrompt;
    applyImageFallback(b);
  });
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
  // effects and ambiences sit well under the narrator (user feedback: halve them at least)
const FX_GAIN = 0.4;
  const add = (name: string, atMs: number, volume = 0.4) => sfx.push({src: `sfx/${name}.wav`, atMs: Math.max(0, Math.round(atMs)), volume: volume * FX_GAIN});
  sb.beats.forEach((b, i) => {
    const t = timing[i].startMs;
    const dur = timing[i].endMs - t;
    // "name" plays at the beat start, "name@0.55" at 55 % of the beat, "name@0.55:0.3" with volume 0.3
    (b.sfx ?? []).forEach((s) => {
      const [name, at] = s.split('@');
      const [frac, vol] = (at ?? '0').split(':').map(Number);
      add(name, t + dur * (frac || 0), vol || 0.45);
    });
    // action scenes: bursts make their own sound (landing, impact, splash…)
    if (b.scene.type === 'action')
      for (const bu of (b.scene.bursts as {at: number; kind: string}[] | undefined) ?? []) {
        const snd: Record<string, [string, number]> = {dust: ['whoosh', 0.25], sand: ['stamp', 0.4], splash: ['splash', 0.45], water: ['splash', 0.5], debris: ['boom', 0.5], spark: ['blip', 0.2], impact: ['boom', 0.45], bubbles: ['blip', 0.15], confetti: ['ding', 0.3], smoke: ['whoosh', 0.2], sonar: ['beep-low', 0.3]};
        const m = snd[bu.kind];
        if (m) add(m[0], t + dur * bu.at, m[1]);
      }
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
      case 'scoreboard':
        add('counter', t + dur * 0.1, 0.22);
        add('beep', t + dur * 0.75, 0.3);
        break;
      case 'lineChart': {
        const n = ((b.scene.points as unknown[]) ?? []).length;
        for (let k = 1; k < n; k++) add('blip', t + (k * dur * 0.7) / Math.max(1, n - 1), 0.2);
        break;
      }
      case 'versus':
        add('whoosh', t, 0.3);
        add('whoosh', t + 250, 0.3);
        if ((b.scene.left as {crossed?: boolean})?.crossed || (b.scene.right as {crossed?: boolean})?.crossed) add('stamp', t + dur * 0.6, 0.45);
        break;
      case 'timeline': {
        const n = ((b.scene.events as unknown[]) ?? []).length;
        for (let k = 0; k < n; k++) add('beep', t + (k * dur * 0.75) / Math.max(1, n) + 60, 0.25);
        break;
      }
      case 'podium':
        [0, 0.2, 0.45].forEach((f) => add('pop', t + dur * f, 0.3));
        add('ding', t + dur * 0.6, 0.35);
        break;
      case 'newspaper':
        add('whoosh', t, 0.35);
        add('stamp', t + 250, 0.3);
        break;
      case 'prop':
      case 'title':
        if (style === 'B') add('pop', t, 0.3);
        break;
      case 'stage': {
        // sound every action of the illustrated layers (style B)
        const sc = b.scene as {layers?: {acts?: {do: string; at?: number}[]}[]; stamp?: {at?: number}; sparkles?: {at: number}[]; flashes?: {at: number}[]; thought?: {at?: number}; counter?: unknown; title?: {at?: number}};
        (sc.layers ?? []).forEach((L) =>
          (L.acts ?? []).forEach((a) => {
            const at = t + (a.at ?? 0) * 1000;
            if (a.do === 'pop') add('pop', at, 0.3);
            if (a.do === 'enter' || a.do === 'exit') add('whoosh', at, 0.18);
            if (a.do === 'hit') add('boom', at, 0.4);
          }),
        );
        if (sc.stamp) add('stamp', t + (sc.stamp.at ?? dur / 2000) * 1000, 0.45);
        (sc.sparkles ?? []).forEach((x) => add('ding', t + x.at * 1000, 0.25));
        (sc.flashes ?? []).forEach((x) => add('blip', t + x.at * 1000, 0.35));
        if (sc.thought) add('pop', t + (sc.thought.at ?? 0) * 1000, 0.3);
        if (sc.counter) add('counter', t + 50, 0.2);
        if (sc.title) add('pop', t + (sc.title.at ?? 0) * 1000, 0.22);
        break;
      }
    }
  });
  add('sting', durationMs - 2000, 0.35);
  // beats are 0-based; an ambience reaching the last beat runs to the very end (fades out there)
  const last = timing.length - 1;
  const ambience: Episode['audio']['ambience'] = (sb.ambience ?? []).map((a) => ({
    src: `sfx/${a.sound}.wav`,
    fromMs: a.fromBeat <= 0 ? 0 : timing[Math.min(last, a.fromBeat)].startMs,
    toMs: a.toBeat >= last ? durationMs : timing[Math.max(0, a.toBeat)].endMs,
    volume: (a.volume ?? 0.25) * FX_GAIN,
  }));
  if (!ambience.length) ambience.push({src: 'sfx/amb-drone.wav', fromMs: 0, toMs: durationMs, volume: 0.22 * FX_GAIN});
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
  assets?: Episode['assets'];
}): Episode => {
  const {brand, sb, words} = opts;
  const timing = timeBeats(sb, words);
  resolveWordTimes(sb, timing, words);
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
    assets: opts.assets,
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
