// Quick visual check without a full render: one still per beat (or per chosen
// beats), tiled into a contact sheet.
//   npx tsx pipeline/stills.ts public/ep/<id>/episode.json [beatIndex,...] [--at 0.6]
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import type {Episode} from '../src/shared/schema';

const main = async () => {
  const file = process.argv[2];
  const ep = JSON.parse(readFileSync(file, 'utf8')) as Episode;
  const pick = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3].split(',').map(Number) : ep.beats.map((_, i) => i);
  const atIdx = process.argv.indexOf('--at');
  const at = atIdx > 0 ? Number(process.argv[atIdx + 1]) : 0.6;
  const serveUrl = await bundle({entryPoint: path.resolve('src/remotion/index.ts'), publicDir: path.resolve('public')});
  const id = ep.brand.style === 'A' ? 'StyleA' : 'StyleB';
  const composition = await selectComposition({serveUrl, id, inputProps: ep});
  const dir = path.join('out', 'stills', ep.id);
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  for (const [k, i] of pick.entries()) {
    const b = ep.beats[i];
    const ms = b.startMs + (b.endMs - b.startMs) * at;
    const frame = Math.min(composition.durationInFrames - 1, Math.round((ms / 1000) * 30));
    await renderStill({composition, serveUrl, inputProps: ep, frame, output: path.join(dir, `s_${String(k).padStart(3, '0')}.png`), chromiumOptions: {gl: 'swangle'}});
  }
  const cols = Math.min(6, pick.length);
  execFileSync('bash', ['-c', `ffmpeg -v error -y -framerate 1 -i "${dir}/s_%03d.png" -vf "scale=270:480,tile=${cols}x${Math.ceil(pick.length / cols)}:padding=4:color=white" "${dir}/sheet.png"`]);
  console.log(path.join(dir, 'sheet.png'));
};

main();
