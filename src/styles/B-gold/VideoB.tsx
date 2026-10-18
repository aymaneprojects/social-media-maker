import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {FONT, loadFonts} from '../../shared/fonts';
import {paletteB} from '../../shared/palette';
import {type Episode, msToFrame} from '../../shared/schema';
import {beatAt, frameToMs} from '../../shared/timing';
import {BackgroundB, HudB, SCENES_B} from './scenes';
import {resolveStage, Stage, type StageScene} from './stage';
import {ThemeProviderB, useThemeB} from './theme';
import {Label, PixelTitle, popAt} from './ui';

loadFonts();

// Black dither curtain used by the "pixelDissolve" transition of style B.
const DitherCurtain: React.FC<{density: number}> = ({density}) => {
  if (density <= 0) return null;
  const levels = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const cell = 12;
  const rects: React.ReactNode[] = [];
  levels.forEach((lv, k) => {
    if ((lv + 0.5) / 16 < density) rects.push(<rect key={k} x={(k % 4) * cell} y={Math.floor(k / 4) * cell} width={cell} height={cell} fill="#000" />);
  });
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
      <defs>
        <pattern id={`dc-${Math.round(density * 16)}`} width={cell * 4} height={cell * 4} patternUnits="userSpaceOnUse">
          {rects}
        </pattern>
      </defs>
      <rect width={1080} height={1920} fill={`url(#dc-${Math.round(density * 16)})`} />
    </svg>
  );
};

const EndCardB: React.FC<{ms: number; name: string; handle: string; issue: number; place: string; year: string}> = ({ms, name, handle, issue, place, year}) => {
  const {pal} = useThemeB();
  const p = popAt(ms);
  return (
    <>
      <div style={{position: 'absolute', left: 140, top: 640, width: 800, height: 420, border: `8px solid ${pal.gold}`, outline: `4px solid ${pal.goldDark}`, outlineOffset: -22, transform: `scale(${p})`}} />
      <PixelTitle text={name.toUpperCase()} y={700} size={90} scaleIn={p} />
      {ms > 300 && <Label text={handle} y={880} size={26} color={pal.gold} />}
      {ms > 600 && <Label text={`N°${String(issue).padStart(2, '0')}  ${place}  ${year}`} y={950} size={20} color={pal.grey} />}
    </>
  );
};

type HudStateB = {clues: {sprite: string; crossed?: boolean}[]; date?: string};

const resolveHudB = (beats: Episode['beats'], index: number): HudStateB => {
  const st: HudStateB = {clues: []};
  for (let i = 0; i <= index; i++) {
    const h = beats[i].hud as Partial<HudStateB> | undefined;
    if (!h) continue;
    if (h.clues) st.clues = h.clues;
    if (h.date !== undefined) st.date = h.date || undefined;
  }
  return st;
};

export const VideoB: React.FC<Episode> = (ep) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = frameToMs(frame, fps);
  const pal = useMemo(() => paletteB(ep.brand.accent), [ep.brand.accent]);
  const lastEnd = ep.beats[ep.beats.length - 1]?.endMs ?? ep.durationMs;
  const inEnd = ms >= lastEnd;
  const {beat, index} = beatAt(ep.beats, ms);
  const next = ep.beats[index + 1];
  const beatMs = ms - beat.startMs;
  const beatDur = Math.max(1, beat.endMs - beat.startMs);
  const fIn = (beatMs / 1000) * fps;
  const fOut = next ? ((next.startMs - ms) / 1000) * fps : 99;
  const sceneType = (beat.scene as {type: string}).type;
  const Scene = SCENES_B[sceneType];
  const stage = sceneType === 'stage' ? resolveStage(ep.beats, index) : null;
  const hud = resolveHudB(ep.beats, index);
  let curtain = 0;
  if (beat.transition === 'pixelDissolve' && fIn < 8) curtain = 1 - fIn / 8;
  if (next?.transition === 'pixelDissolve' && fOut < 6) curtain = Math.max(curtain, 1 - fOut / 6);
  const flash = (beat.transition === 'flash' || beat.transition === 'glitch') && fIn < 3;
  const sceneHasTitle = Boolean((beat.scene as {title?: unknown}).title || sceneType === 'title');

  return (
    <ThemeProviderB value={{pal, brand: ep.brand, issue: ep.issue, assetsBase: ep.assetsBase, assets: ep.assets ?? {}}}>
      <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
        <BackgroundB ms={ms} seed="stars" />
        {!inEnd && (
          <>
            <AbsoluteFill>
              {stage ? (
                <Stage scene={beat.scene as StageScene} layers={stage.layers} bases={stage.bases} ms={beatMs} durationMs={beatDur} assets={ep.assets ?? {}} assetsBase={ep.assetsBase} />
              ) : Scene ? (
                <Scene params={beat.scene} ms={beatMs} durationMs={beatDur} />
              ) : null}
            </AbsoluteFill>
            {beat.keyword && !sceneHasTitle && <PixelTitle text={beat.keyword.toUpperCase()} y={190} size={100} scaleIn={popAt(beatMs)} />}
            {beat.annotation && <Label text={beat.annotation} y={1330} size={30} color={pal.gold} />}
            <HudB clues={hud.clues} date={hud.date} ms={ms} />
            <DitherCurtain density={curtain} />
            {flash && <AbsoluteFill style={{background: pal.cream, opacity: 0.7}} />}
          </>
        )}
        {inEnd && <EndCardB ms={ms - lastEnd} name={ep.brand.name} handle={ep.brand.handle} issue={ep.issue} place={ep.endCard.place} year={ep.endCard.year} />}
        <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 65% at 50% 45%, transparent 60%, rgba(0,0,0,0.55) 100%)'}} />
        <div style={{display: 'none', fontFamily: FONT.bTitle}}>.</div>
      </AbsoluteFill>

      {ep.audio.voice && <Audio src={staticFile(`${ep.assetsBase}${ep.audio.voice}`)} />}
      {ep.audio.music && <Audio src={staticFile(ep.audio.music.src)} volume={ep.audio.music.volume} loop />}
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
    </ThemeProviderB>
  );
};
