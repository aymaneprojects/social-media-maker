// Narration: TTS through OpenRouter (ElevenLabs voice) + word timings.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {speech, transcribeWords} from './openrouter';

export type Word = {text: string; startMs: number; endMs: number};

export const VOICE_ID = process.env.VOICE_ID ?? 'F9KUTOne5xOKqAbIU7yg';

export const audioDurationMs = (file: string) =>
  Math.round(
    parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()) * 1000,
  );

// Text sent to the voice: the script as written (digits stay digits, the
// voice model reads them correctly in French) with a few cleanups.
export const ttsText = (script: string) =>
  script
    .replace(/\s+/g, ' ')
    .replace(/«\s*/g, '« ')
    .replace(/\s*»/g, ' »')
    .trim();

// Measured on the reference videos: ~2.6 words/s, punchy delivery.
export const VOICE_SETTINGS = {speed: 1.12, stability: 0.45, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true};

export const synthesize = async (script: string, outMp3: string, opts: {voice?: string; model?: string} = {}) => {
  const audio = await speech(ttsText(script), opts.voice ?? VOICE_ID, {model: opts.model, settings: VOICE_SETTINGS});
  writeFileSync(outMp3, audio);
  return audioDurationMs(outMp3);
};

// Word timings: local faster-whisper aligned on the script (free), with the
// OpenRouter Scribe model as a fallback.
export const alignWords = async (mp3: string, script: string, workDir: string): Promise<Word[]> => {
  const scriptFile = `${workDir}/script.txt`;
  const out = `${workDir}/words.json`;
  writeFileSync(scriptFile, script);
  try {
    execFileSync('python3', ['core/align.py', mp3, scriptFile, out, '--model', process.env.WHISPER_MODEL ?? 'small'], {stdio: 'inherit'});
    return JSON.parse(readFileSync(out, 'utf8')).words as Word[];
  } catch (err) {
    console.warn('local alignment failed, falling back to Scribe:', (err as Error).message);
    const res = await transcribeWords(readFileSync(mp3));
    const words = (res.words ?? []).map((w) => ({text: w.word.trim(), startMs: Math.round(w.start * 1000), endMs: Math.round(w.end * 1000)}));
    writeFileSync(out, JSON.stringify({words}, null, 1));
    return words;
  }
};
