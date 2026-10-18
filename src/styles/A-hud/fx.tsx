import React from 'react';
import {random} from 'remotion';
import {withAlpha} from '../../shared/palette';
import {useThemeA} from './theme';

// Film grain: an SVG turbulence whose seed changes every frame.
export const Grain: React.FC<{frame: number; opacity?: number}> = ({frame, opacity = 0.09}) => (
  <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, mixBlendMode: 'screen'}}>
    <filter id={`grain-${frame}`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={frame % 97} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter={`url(#grain-${frame})`} />
  </svg>
);

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.75}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse 75% 60% at 50% 45%, transparent 55%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

// Thin horizontal scanlines (very subtle, like the reference's CRT feel).
export const Scanlines: React.FC<{opacity?: number}> = ({opacity = 0.12}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity,
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0 2px, transparent 2px 6px)',
    }}
  />
);

const CELL = 60;
const COLS = 1080 / CELL;
const ROWS = 1920 / CELL;

// Random block storm used by the pixel dissolve (density 0..1).
export const BlockStorm: React.FC<{density: number; seed: string}> = ({density, seed}) => {
  const {pal} = useThemeA();
  if (density <= 0) return null;
  const colors = [pal.bg, pal.bg, pal.plum, pal.plum2, pal.mid1, pal.mid2, pal.accent, pal.white];
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const r = random(`${seed}-${x}-${y}`);
      if (r > density) continue;
      const c = colors[Math.floor(random(`${seed}-c-${x}-${y}`) * colors.length)];
      const small = random(`${seed}-s-${x}-${y}`) > 0.6;
      cells.push(
        <rect
          key={`${x}-${y}`}
          x={x * CELL + (small ? CELL / 4 : 0)}
          y={y * CELL + (small ? CELL / 4 : 0)}
          width={small ? CELL / 2 : CELL}
          height={small ? CELL / 2 : CELL}
          fill={c}
        />,
      );
    }
  }
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
      {cells}
    </svg>
  );
};

// Noise frame used by "flash" (pale dithered screen) and glitch borders.
export const NoiseFrame: React.FC<{seed: string; tone: 'light' | 'border'}> = ({seed, tone}) => {
  const {pal} = useThemeA();
  const cells: React.ReactNode[] = [];
  const cell = 15;
  for (let y = 0; y < 1920 / cell; y++) {
    for (let x = 0; x < 1080 / cell; x++) {
      const edge = Math.min(x, y, 1080 / cell - 1 - x, 1920 / cell - 1 - y);
      const r = random(`${seed}-${x}-${y}`);
      if (tone === 'border') {
        if (edge > 3 || r > 0.55 - edge * 0.12) continue;
        cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={r < 0.2 ? pal.white : pal.mid3} />);
      } else {
        if (r > 0.5) continue;
        cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={r < 0.15 ? pal.mid3 : pal.white} />);
      }
    }
  }
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
      {tone === 'light' && <rect width={1080} height={1920} fill={withAlpha(pal.paper, 0.95)} />}
      {cells}
    </svg>
  );
};

export type TransitionKind = 'cut' | 'pixelDissolve' | 'glitch' | 'flash' | 'pop';

const IN_FRAMES: Record<TransitionKind, number> = {cut: 0, pixelDissolve: 9, glitch: 7, flash: 4, pop: 8};
export const OUT_FRAMES: Record<TransitionKind, number> = {cut: 0, pixelDissolve: 5, glitch: 2, flash: 0, pop: 0};

// Overlay drawn on top of the scene. `fIn` = frames since the beat started,
// `fOutNext` = frames left before a beat whose transition is `nextKind`.
export const TransitionOverlay: React.FC<{
  kind: TransitionKind;
  fIn: number;
  nextKind?: TransitionKind;
  fOutNext: number;
  seed: string;
}> = ({kind, fIn, nextKind, fOutNext, seed}) => {
  const layers: React.ReactNode[] = [];
  if (kind === 'pixelDissolve' && fIn < IN_FRAMES.pixelDissolve) {
    layers.push(<BlockStorm key="in" density={1 - fIn / IN_FRAMES.pixelDissolve} seed={`${seed}-${fIn}`} />);
  }
  if (kind === 'flash' && fIn < IN_FRAMES.flash) layers.push(<NoiseFrame key="fl" tone="light" seed={`${seed}-${fIn}`} />);
  if (kind === 'glitch' && fIn < IN_FRAMES.glitch) layers.push(<NoiseFrame key="gl" tone="border" seed={`${seed}-${fIn}`} />);
  if (nextKind === 'pixelDissolve' && fOutNext < OUT_FRAMES.pixelDissolve) {
    layers.push(<BlockStorm key="out" density={(OUT_FRAMES.pixelDissolve - fOutNext) / (OUT_FRAMES.pixelDissolve + 1)} seed={`${seed}-o-${fOutNext}`} />);
  }
  if (nextKind === 'glitch' && fOutNext < OUT_FRAMES.glitch) layers.push(<NoiseFrame key="go" tone="border" seed={`${seed}-go-${fOutNext}`} />);
  return <>{layers}</>;
};

// Transform applied to the scene container (shake for glitch, pop-in scale).
export const sceneTransform = (kind: TransitionKind, fIn: number, seed: string) => {
  if (kind === 'glitch' && fIn < IN_FRAMES.glitch) {
    const dx = (random(`${seed}-dx-${fIn}`) - 0.5) * 60;
    return `translateX(${Math.round(dx / 6) * 6}px)`;
  }
  if (kind === 'pop' && fIn < IN_FRAMES.pop) {
    const s = 0.9 + 0.1 * (fIn / IN_FRAMES.pop);
    return `scale(${s})`;
  }
  return undefined;
};
