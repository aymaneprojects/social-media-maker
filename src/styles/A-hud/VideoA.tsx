import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {loadFonts} from '../../shared/fonts';
import {paletteA} from '../../shared/palette';
import {type Episode, msToFrame} from '../../shared/schema';
import {beatAt, frameToMs} from '../../shared/timing';
import {Captions} from './Captions';
import {Ambient, Grain, Scanlines, sceneTransform, TransitionOverlay, Vignette, type TransitionKind} from './fx';
import {Hud} from './Hud';
import {RenderSceneA} from './scenes';
import {EndCardA} from './scenes/misc';
import {ThemeProviderA} from './theme';

loadFonts();

export const VideoA: React.FC<Episode> = (ep) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = frameToMs(frame, fps);
  const pal = useMemo(() => paletteA(ep.brand.accent), [ep.brand.accent]);
  const lastEnd = ep.beats[ep.beats.length - 1]?.endMs ?? ep.durationMs;
  const inEndCard = ms >= lastEnd;
  const {beat, index} = beatAt(ep.beats, ms);
  const next = ep.beats[index + 1];
  const beatMs = ms - beat.startMs;
  const beatDur = Math.max(1, beat.endMs - beat.startMs);
  const fIn = Math.floor((beatMs / 1000) * fps);
  const fOutNext = next ? Math.floor(((next.startMs - ms) / 1000) * fps) : 999;
  const kind = beat.transition as TransitionKind;
  // slow camera push-in on every beat, in whole pixels
  const zoom = 1 + 0.035 * Math.min(1, beatMs / beatDur);

  const theme = {pal, brand: ep.brand, issue: ep.issue, assetsBase: ep.assetsBase};

  return (
    <ThemeProviderA value={theme}>
      <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
        {!inEndCard && (
          <>
            <Ambient ms={ms} />
            <AbsoluteFill style={{transform: [sceneTransform(kind, fIn, beat.id), `scale(${zoom})`].filter(Boolean).join(' ')}}>
              <RenderSceneA scene={beat.scene as never} ms={beatMs} durationMs={beatDur} />
            </AbsoluteFill>
            <TransitionOverlay kind={kind} fIn={fIn} nextKind={next?.transition as TransitionKind} fOutNext={fOutNext} seed={beat.id} />
            <Scanlines />
            <Vignette />
            <Grain frame={frame} />
            <Hud beats={ep.beats} index={index} ms={ms} />
            <Captions words={ep.words} beats={ep.beats} ms={ms} annotation={beat.annotation} />
          </>
        )}
        {inEndCard && (
          <>
            <EndCardA ms={ms - lastEnd} brandName={ep.brand.name} lang={ep.brand.lang} issue={ep.issue} place={ep.endCard.place} year={ep.endCard.year} />
            <Grain frame={frame} />
          </>
        )}
      </AbsoluteFill>

      {ep.audio.voice && <Audio src={staticFile(`${ep.assetsBase}${ep.audio.voice}`)} />}
      {ep.audio.ambience.map((a, i) => (
        <Sequence key={`amb-${i}`} from={msToFrame(a.fromMs)} durationInFrames={Math.max(1, msToFrame(a.toMs - a.fromMs))}>
          <Audio src={staticFile(a.src)} volume={a.volume} loop />
        </Sequence>
      ))}
      {ep.audio.sfx.map((s, i) => (
        <Sequence key={`sfx-${i}`} from={msToFrame(s.atMs)}>
          <Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </ThemeProviderA>
  );
};
