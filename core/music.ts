// Synthesised music bed for style B (curious, light, loopable): plucked
// pentatonic arpeggio + soft bass + feedback-delay "room". Written as raw PCM
// then encoded with ffmpeg.  npx tsx core/music.ts
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';

const SR = 44100;
const BPM = 96;
const BARS = 16;
const beat = 60 / BPM;
const dur = BARS * 4 * beat;
const n = Math.floor(dur * SR);
const out = new Float32Array(n);

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// A minor pentatonic arpeggios over Am - F - C - G
const chords = [
  [57, 60, 64, 69, 72, 69, 64, 60],
  [53, 57, 60, 65, 69, 65, 60, 57],
  [48, 52, 55, 60, 64, 60, 55, 52],
  [55, 59, 62, 67, 71, 67, 62, 59],
];
const bass = [45, 41, 36, 43];

const pluck = (t0: number, f: number, amp: number, decay: number) => {
  const start = Math.floor(t0 * SR);
  const len = Math.floor(SR * 1.6);
  for (let i = 0; i < len && start + i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t * decay) * Math.min(1, t * 400);
    out[start + i] += amp * env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t));
  }
};

for (let bar = 0; bar < BARS; bar++) {
  const c = chords[bar % 4];
  for (let s = 0; s < 8; s++) {
    // skip a few notes for groove
    if ((bar + s) % 7 === 6) continue;
    pluck((bar * 4 + s * 0.5) * beat, midi(c[s] + 12), 0.11, 5.5);
  }
  pluck(bar * 4 * beat, midi(bass[bar % 4]), 0.22, 1.8);
  pluck((bar * 4 + 2.5) * beat, midi(bass[bar % 4]), 0.14, 2.5);
  // soft tick on beats 2 and 4
  for (const b of [1, 3]) {
    const st = Math.floor((bar * 4 + b) * beat * SR);
    for (let i = 0; i < 900 && st + i < n; i++) out[st + i] += 0.05 * (Math.random() * 2 - 1) * Math.exp(-i / 120);
  }
}
// feedback delay
const d = Math.floor(beat * 0.75 * SR);
for (let i = d; i < n; i++) out[i] += out[i - d] * 0.28;
// fade loop edges slightly and normalise
let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
const pcm = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round((out[i] / peak) * 0.8 * 32767), i * 2);
mkdirSync('public/music', {recursive: true});
mkdirSync('data/cache', {recursive: true});
writeFileSync('data/cache/bed.raw', pcm);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', 'data/cache/bed.raw', '-af', 'lowpass=f=6000,afade=t=in:d=0.05', '-b:a', '160k', 'public/music/bed-b.mp3']);
console.log(`music bed ${dur.toFixed(1)}s -> public/music/bed-b.mp3`);
