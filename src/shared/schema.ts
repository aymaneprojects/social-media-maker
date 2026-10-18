import {z} from 'zod';

// One spoken word with its timing in the final voice track.
export const wordSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});
export type Word = z.infer<typeof wordSchema>;

export const brandSchema = z.object({
  slug: z.string(),
  name: z.string(), // shown in the HUD badge / end card
  handle: z.string(),
  style: z.enum(['A', 'B']),
  accent: z.string(),
  lang: z.string().default('FR'),
});
export type Brand = z.infer<typeof brandSchema>;

export const sfxCueSchema = z.object({
  src: z.string(), // path relative to public/
  atMs: z.number(),
  volume: z.number().default(0.5),
});

export const ambienceSchema = z.object({
  src: z.string(),
  fromMs: z.number(),
  toMs: z.number(),
  volume: z.number().default(0.25),
});

export const audioSchema = z.object({
  voice: z.string().optional(),
  music: z.object({src: z.string(), volume: z.number().default(0.18)}).optional(),
  ambience: z.array(ambienceSchema).default([]),
  sfx: z.array(sfxCueSchema).default([]),
});

// A beat is one visual idea, bound to one phrase of the narration.
export const beatSchema = z.object({
  id: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  text: z.string(),
  scene: z.record(z.string(), z.any()).and(z.object({type: z.string()})),
  transition: z.enum(['cut', 'pixelDissolve', 'glitch', 'flash', 'pop']).default('cut'),
  // Style A only: overrides of the persistent HUD from this beat on.
  hud: z.record(z.string(), z.any()).optional(),
  // Small secondary line under the caption (style A) or keyword (style B).
  annotation: z.string().optional(),
  // Style B only: keyword titles shown instead of captions.
  keyword: z.string().optional(),
});
export type Beat = z.infer<typeof beatSchema>;

export const episodeSchema = z.object({
  id: z.string(),
  brand: brandSchema,
  issue: z.number(),
  endCard: z.object({place: z.string(), year: z.string()}),
  durationMs: z.number(),
  words: z.array(wordSchema),
  beats: z.array(beatSchema),
  audio: audioSchema,
  assetsBase: z.string().default(''), // e.g. "ep/<id>/" inside public/
  // style B: illustrated assets (pixelised PNGs in <assetsBase>assets/)
  assets: z.record(z.string(), z.object({poses: z.record(z.string(), z.object({file: z.string(), w: z.number(), h: z.number()}))})).optional(),
});
export type Episode = z.infer<typeof episodeSchema>;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);
