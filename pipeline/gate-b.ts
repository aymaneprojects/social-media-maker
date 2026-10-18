// Style-B validation gate: generate a few illustrations with the style
// references, rebuild two sequences of the reference videos with the stage
// engine, and output a side-by-side comparison video (original | rebuild).
//   npx tsx pipeline/gate-b.ts <reference-video-hammer.mp4> <reference-video-fries.mp4>
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {illustrate, type AssetSpec} from '../core/illustrate';
import type {Episode} from '../src/shared/schema';
import {renderEpisode} from './render';

const ID = 'gate-b';
const DIR = path.join('public', 'ep', ID);

const ASSETS: AssetSpec[] = [
  {
    id: 'man',
    kind: 'character',
    prompt: 'a man in a grey 1940s suit and a dark fedora hat, holding a long wooden sledgehammer raised high above his head with both hands',
    poses: {strike: 'swinging the sledgehammer down and forward to his right, arms extended, the hammer head low in front of him'},
  },
  {id: 'pinball', kind: 'object', prompt: 'a vintage 1940s wooden pinball machine with a golden sunburst backbox, glass playfield and four turned wooden legs, three-quarter view facing left'},
  {id: 'fries', kind: 'object', prompt: 'a tall red cardboard fries box filled with golden french fries, a big yellow arch emblem on the front, front view'},
  {id: 'ticket', kind: 'prop', prompt: 'a small golden game ticket card with a dark band at the top, slightly tilted'},
  {id: 'hand', kind: 'hand', prompt: 'a brown-skinned hand coming out of a dark suit sleeve with a white shirt cuff, thumb and index finger pinching as if holding a small card'},
];

const beat = (i: number, startMs: number, endMs: number, scene: unknown, extra: Record<string, unknown> = {}) => ({
  id: `b${i}`,
  startMs,
  endMs,
  text: '',
  scene,
  transition: 'cut',
  ...extra,
});

const main = async () => {
  const [hammerRef, friesRef] = process.argv.slice(2);
  mkdirSync(DIR, {recursive: true});
  const assets: NonNullable<Episode['assets']> = {};
  for (const spec of ASSETS) {
    console.log(`illustration ${spec.id}`);
    assets[spec.id] = await illustrate(spec, path.join(DIR, 'assets'));
  }

  // Sequence 1 (reference: hammer smashes the pinball, 0-5 s)
  const s1 = [
    beat(0, 0, 1800, {
      type: 'stage',
      layers: [
        {id: 'pin', asset: 'pinball', x: 640, y: 900, h: 900, z: 1, acts: [{do: 'pop'}]},
        {id: 'man', asset: 'man', x: 300, y: 1180, h: 760, z: 2, anchor: 'bottom', acts: [{do: 'pose', name: 'strike', at: 0.45}, {do: 'hit', at: 0.5}]},
      ],
    }),
    beat(1, 1800, 5000, {
      type: 'stage',
      keep: true,
      layers: [{id: 'man', asset: 'man', acts: [{do: 'poses', seq: ['base', 'strike'], at: 1.2, every: 0.25}, {do: 'hit', at: 1.5}]}],
      title: {text: 'À la masse', at: 0},
      flashes: [
        {x: 250, y: 1320, at: 2.1},
        {x: 830, y: 1320, at: 2.5},
      ],
    }),
  ];
  // Sequence 2 (reference: a hand slides the ticket out, thought bubble, sparkles, 0-4 s)
  const o = 5000;
  const s2 = [
    beat(2, o, o + 4000, {
      type: 'stage',
      layers: [
        {id: 'fries', asset: 'fries', x: 540, y: 1050, h: 760, z: 1, acts: [{do: 'pop'}]},
        {id: 'ticket', asset: 'ticket', x: 520, y: 1230, h: 230, z: 2, acts: [{do: 'move', x: 680, y: 760, at: 1.4, dur: 0.7}]},
        {
          id: 'hand',
          asset: 'hand',
          x: 760,
          y: 1250,
          h: 400,
          z: 3,
          acts: [
            {do: 'enter', from: 'right', at: 0.4, dur: 0.6},
            {do: 'move', x: 900, y: 780, at: 1.4, dur: 0.7},
          ],
        },
      ],
      thought: {text: '1 000 000 $', x: 520, y: 430, at: 2.3},
      sparkles: [{x: 680, y: 760, at: 3.0}],
    }),
  ];
  const ep = {
    id: ID,
    issue: 1,
    brand: {slug: 'business-argent', name: 'Fortune Pixel', handle: '@fortune.pixel', style: 'B', accent: '#E2B04A', lang: 'FR'},
    endCard: {place: 'Test', year: '2026'},
    durationMs: o + 4000 + 2000,
    assetsBase: `ep/${ID}/`,
    words: [],
    beats: [...s1, ...s2],
    assets,
    audio: {
      ambience: [],
      sfx: [
        {src: 'sfx/boom.wav', atMs: 500, volume: 0.5},
        {src: 'sfx/boom.wav', atMs: 3300, volume: 0.5},
        {src: 'sfx/pop.wav', atMs: 1800, volume: 0.3},
        {src: 'sfx/blip.wav', atMs: 3900, volume: 0.35},
        {src: 'sfx/blip.wav', atMs: 4300, volume: 0.35},
        {src: 'sfx/whoosh.wav', atMs: o + 400, volume: 0.2},
        {src: 'sfx/pop.wav', atMs: o + 2300, volume: 0.3},
        {src: 'sfx/ding.wav', atMs: o + 3000, volume: 0.3},
      ],
    },
  };
  const epFile = path.join(DIR, 'episode.json');
  writeFileSync(epFile, JSON.stringify(ep, null, 1));
  const outDir = path.join('out', 'gate-b');
  const {final} = await renderEpisode(epFile, outDir);

  // side by side: original reference (left) | rebuild (right), 9 s
  if (hammerRef && friesRef) {
    const cmp = path.join(outDir, 'comparison.mp4');
    execFileSync('ffmpeg', [
      '-v', 'error', '-y',
      '-ss', '0', '-t', '5', '-i', hammerRef,
      '-ss', '5.5', '-t', '4', '-i', friesRef,
      '-t', '9', '-i', final,
      '-filter_complex',
      '[0:v]scale=540:960,setsar=1,fps=30[a];[1:v]scale=540:960,setsar=1,fps=30[b];[a][b]concat=n=2:v=1:a=0[ref];[2:v]scale=540:960,setsar=1,fps=30[new];[ref][new]hstack=2[v]',
      '-map', '[v]', '-map', '2:a?', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-shortest', cmp,
    ]);
    console.log(cmp);
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
