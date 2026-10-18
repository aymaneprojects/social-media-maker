// Renders an episode JSON to MP4, normalises loudness and builds a QA sheet.
//   npx tsx pipeline/render.ts public/ep/<id>/episode.json
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import type {Episode} from '../src/shared/schema';

let bundled: string | null = null;
const getBundle = async () => {
  if (!bundled) {
    bundled = await bundle({entryPoint: path.resolve('src/remotion/index.ts'), publicDir: path.resolve('public')});
  }
  return bundled;
};

export const renderEpisode = async (episodeFile: string, outDir: string) => {
  const ep = JSON.parse(readFileSync(episodeFile, 'utf8')) as Episode;
  mkdirSync(outDir, {recursive: true});
  const serveUrl = await getBundle();
  const id = ep.brand.style === 'A' ? 'StyleA' : 'StyleB';
  const composition = await selectComposition({serveUrl, id, inputProps: ep});
  const raw = path.join(outDir, 'raw.mp4');
  const t0 = Date.now();
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 18,
    audioCodec: 'aac',
    audioBitrate: '192k',
    outputLocation: raw,
    inputProps: ep,
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? 4),
    chromiumOptions: {gl: 'swangle'},
    onProgress: ({progress}) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== lastPct) {
        lastPct = pct;
        console.log(`render ${pct}%`);
      }
    },
  });
  console.log(`rendered in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const final = path.join(outDir, 'final.mp4');
  loudnorm(raw, final);
  const qa = qaReport(final, outDir, ep);
  writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(qa, null, 2));
  return {final, qa};
};

// Two-pass EBU R128 normalisation to -14 LUFS / -1 dBTP (social platforms).
export const loudnorm = (input: string, output: string) => {
  const res = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${input}" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p'`]).toString();
  const m = JSON.parse(res) as Record<string, string>;
  const af = `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-c:v', 'copy', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
};

// QA: technical checks + contact sheet (2 frames/s, same layout used to study the references).
export const qaReport = (file: string, outDir: string, ep: Episode) => {
  const probe = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate', '-of', 'json', file]).toString(),
  );
  const loud = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${file}" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2`]).toString();
  const sheetDir = path.join(outDir, 'qa');
  mkdirSync(sheetDir, {recursive: true});
  execFileSync('bash', [
    '-c',
    `ffmpeg -v error -y -i "${file}" -vf "fps=2,scale=216:384" "${sheetDir}/f_%04d.jpg" && ffmpeg -v error -y -framerate 1 -i "${sheetDir}/f_%04d.jpg" -vf "tile=9x4:padding=3:color=white" "${sheetDir}/sheet_%02d.jpg" && rm "${sheetDir}"/f_*.jpg`,
  ]);
  const duration = parseFloat(probe.format.duration);
  const video = probe.streams.find((s: {codec_name: string}) => s.codec_name === 'h264');
  const issues: string[] = [];
  if (!video || video.width !== 1080 || video.height !== 1920) issues.push('resolution is not 1080x1920');
  if (Math.abs(duration * 1000 - ep.durationMs) > 600) issues.push(`duration ${duration}s differs from storyboard ${ep.durationMs / 1000}s`);
  const minS = ep.brand.style === 'A' ? 40 : 75;
  const maxS = ep.brand.style === 'A' ? 95 : 160;
  if (duration < minS || duration > maxS) issues.push(`duration ${duration.toFixed(1)}s outside ${minS}-${maxS}s`);
  return {file, duration, video, loudness: loud.trim().split('\n').map((s) => s.trim()), issues};
};

if (process.argv[1]?.endsWith('render.ts')) {
  const file = process.argv[2];
  const ep = JSON.parse(readFileSync(file, 'utf8')) as Episode;
  const outDir = process.argv[3] ?? path.join('out', ep.brand.slug, ep.id);
  renderEpisode(file, outDir).then(({final, qa}) => {
    console.log(final);
    console.log(JSON.stringify(qa, null, 2));
  });
}
