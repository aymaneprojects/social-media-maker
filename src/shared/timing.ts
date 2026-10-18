import type {Beat, Word} from './schema';

export const frameToMs = (frame: number, fps: number) => (frame / fps) * 1000;

export const beatAt = (beats: Beat[], ms: number) => {
  for (let i = beats.length - 1; i >= 0; i--) if (ms >= beats[i].startMs) return {beat: beats[i], index: i};
  return {beat: beats[0], index: 0};
};

// Caption "pages": 1 to 3 words, cut on punctuation and on beat boundaries,
// like the reference videos (max ~16 characters per line).
export type CaptionPage = {words: Word[]; startMs: number; endMs: number};

export const buildCaptionPages = (rawWords: Word[], beats: Beat[], maxChars = 16, maxWords = 3): CaptionPage[] => {
  // French typography puts a space before ":;!?" — never show such a token alone
  const words: Word[] = [];
  let opener = '';
  for (const raw of rawWords) {
    // opening marks (« “ ( [) belong to the next word
    if (/^[«“(\[]+$/.test(raw.text)) {
      opener += `${raw.text}\u00a0`;
      continue;
    }
    const w = opener ? {...raw, text: `${opener}${raw.text}`} : raw;
    opener = '';
    const prev = words[words.length - 1];
    const punct = !/[\p{L}\p{N}]/u.test(w.text);
    // "50 000" is one number: glue thousand groups to the digits before
    const thousands = prev && /^\d{1,3}$/.test(prev.text.replace(/^\D+/, '')) && /^\d{3}\b/.test(w.text);
    if ((punct || thousands) && prev) words[words.length - 1] = {...prev, text: `${prev.text}\u00a0${w.text}`, endMs: w.endMs};
    else words.push(w);
  }
  const pages: CaptionPage[] = [];
  const beatIndexOf = (ms: number) => {
    let idx = 0;
    beats.forEach((b, i) => {
      if (ms >= b.startMs - 30) idx = i;
    });
    return idx;
  };
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    pages.push({words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs});
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = cur[cur.length - 1];
    const len = cur.reduce((a, x) => a + x.text.length + 1, 0) + w.text.length;
    const newBeat = prev && beatIndexOf(w.startMs) !== beatIndexOf(prev.startMs);
    if (cur.length && (len > maxChars || cur.length >= maxWords || newBeat)) flush();
    cur.push(w);
    // hard stop after punctuation
    if (/[.,!?;:…]$/.test(w.text)) flush();
    // a long pause also ends a page
    const next = words[i + 1];
    if (next && next.startMs - w.endMs > 350) flush();
  });
  flush();
  // pages stay on screen until the next one starts
  for (let i = 0; i < pages.length - 1; i++) pages[i].endMs = Math.max(pages[i].endMs, pages[i + 1].startMs);
  return pages;
};
