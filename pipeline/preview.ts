// Silent preview of a hand-written storyboard, before paying for the voice:
// words are timed at a fixed speech rate, then the episode is assembled and
// filmstrips of the chosen beats are rendered with pipeline/stills.ts.
//   npx tsx pipeline/preview.ts --brand <slug> --storyboard storyboards/x.json
//   then: npx tsx pipeline/stills.ts public/ep/preview-<slug>/episode.json 0,4,8 --strip 6
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {assembleEpisode, validateStoryboard} from './assemble';
import {loadBrand} from './brands';
import type {Storyboard} from './steps';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const brand = loadBrand(arg('brand')!);
const sb = JSON.parse(readFileSync(arg('storyboard')!, 'utf8')) as Storyboard;
const errors = validateStoryboard(brand.style)(sb);
if (errors.length) console.warn('storyboard warnings:\n- ' + errors.join('\n- '));
const rate = Number(arg('rate') ?? 2.7); // words per second
let t = 300;
const words = sb.beats
  .flatMap((b) => b.text.trim().split(/\s+/))
  .map((w) => {
    const dur = Math.max(180, (w.length / 6) * (1000 / rate));
    const word = {text: w, startMs: Math.round(t), endMs: Math.round(t + dur * 0.85)};
    t += dur + (/[.,:;!?…]$/.test(w) ? 220 : 0);
    return word;
  });
const id = `preview-${brand.slug}`;
const ep = assembleEpisode({id, brand, issue: 1, sb, words, assetsBase: `ep/${id}/`});
ep.audio.voice = undefined as never;
mkdirSync(`public/ep/${id}`, {recursive: true});
writeFileSync(`public/ep/${id}/episode.json`, JSON.stringify(ep));
console.log(`public/ep/${id}/episode.json (${(ep.durationMs / 1000).toFixed(1)}s, ${ep.beats.length} beats)`);
