import React, {useMemo} from 'react';
import {FONT} from '../../shared/fonts';
import type {Beat, Word} from '../../shared/schema';
import {buildCaptionPages} from '../../shared/timing';
import {LAYOUT, useThemeA} from './theme';

// Karaoke captions: 1-3 uppercase words, the word being spoken turns accent,
// with the reference "echo" shadow (dark accent offset + black outline).
export const Captions: React.FC<{words: Word[]; beats: Beat[]; ms: number; annotation?: string}> = ({
  words,
  beats,
  ms,
  annotation,
}) => {
  const {pal} = useThemeA();
  const pages = useMemo(() => buildCaptionPages(words, beats), [words, beats]);
  const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
  const outline = `-3px 0 0 ${pal.black}, 3px 0 0 ${pal.black}, 0 -3px 0 ${pal.black}, 0 3px 0 ${pal.black}`;
  const textShadow = `${outline}, 6px 6px 0 ${pal.accentDark}, 9px 9px 0 ${pal.black}`;

  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: LAYOUT.captionY - 60,
        height: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      {page && (
        <div style={{display: 'flex', gap: 30, fontFamily: FONT.caption, fontSize: 104, lineHeight: '104px', whiteSpace: 'nowrap'}}>
          {page.words.map((w, i) => {
            const next = page.words[i + 1];
            const active = ms >= w.startMs && (next ? ms < next.startMs : true);
            return (
              <span key={i} style={{color: active ? pal.accent : pal.white, textShadow}}>
                {w.text.toUpperCase()}
              </span>
            );
          })}
        </div>
      )}
      {annotation && (
        <div
          style={{
            fontFamily: FONT.caption,
            fontSize: 72,
            color: pal.accent,
            marginTop: 26,
            textShadow: outline,
            letterSpacing: 2,
          }}
        >
          {annotation.toUpperCase()}
        </div>
      )}
    </div>
  );
};
