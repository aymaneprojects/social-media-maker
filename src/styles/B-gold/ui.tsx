import React from 'react';
import {interpolate, spring} from 'remotion';
import {FPS} from '../../shared/schema';
import {FONT} from '../../shared/fonts';
import {PixelCanvas} from '../../shared/PixelCanvas';
import {useThemeB} from './theme';

// Pop-in scale with a small overshoot (how every element of style B appears).
// Pure function (not a hook) so it can be used inside conditional JSX.
export const popAt = (ms: number, delayMs = 0) => {
  const f = Math.max(0, ((ms - delayMs) / 1000) * FPS);
  return spring({frame: f, fps: FPS, config: {damping: 11, stiffness: 170, mass: 0.6}});
};

// Big bold title rasterised on a low-res canvas -> real pixel edges, gold
// vertical gradient and a dark drop shadow (like "LOURDE", "NEW YORK").
export const PixelTitle: React.FC<{text: string; y: number; size?: number; color?: 'gold' | 'red' | 'green' | 'cream' | 'accent'; scaleIn?: number}> = ({
  text,
  y,
  size = 120,
  color = 'gold',
  scaleIn = 1,
}) => {
  const {pal} = useThemeB();
  const px = 4; // screen px per art pixel
  const W = Math.round(1080 / px);
  const H = Math.round((size * 1.5) / px);
  const fs = size / px;
  const top = {gold: pal.cream, red: '#FF6B5E', green: '#8BE69B', cream: '#FFFFFF', accent: pal.accent}[color];
  const bottom = {gold: pal.gold, red: pal.red, green: pal.green, cream: pal.cream, accent: pal.accent}[color];
  return (
    <div style={{position: 'absolute', left: 0, top: y, width: 1080, height: H * px, transform: `scale(${scaleIn})`, transformOrigin: '50% 50%'}}>
      <PixelCanvas
        w={W}
        h={H}
        scale={px}
        deps={[text, size, color]}
        style={{left: 0, top: 0}}
        draw={(ctx) => {
          ctx.font = `${fs}px 'Archivo Black'`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let s = fs;
          while (ctx.measureText(text).width > W * 0.92 && s > 6) {
            s -= 1;
            ctx.font = `${s}px 'Archivo Black'`;
          }
          ctx.fillStyle = '#000000';
          ctx.fillText(text, W / 2 + 2, H / 2 + 2);
          const g = ctx.createLinearGradient(0, H / 2 - s / 2, 0, H / 2 + s / 2);
          g.addColorStop(0, top);
          g.addColorStop(0.55, bottom);
          g.addColorStop(1, bottom);
          ctx.fillStyle = g;
          ctx.fillText(text, W / 2, H / 2);
        }}
      />
    </div>
  );
};

// Pixel-font label (Press Start 2P), letter-spaced, centred by default.
export const Label: React.FC<{text: string; y: number; x?: number; size?: number; color?: string; align?: 'left' | 'center' | 'right'; width?: number; opacity?: number}> = ({
  text,
  y,
  x,
  size = 30,
  color,
  align = 'center',
  width,
  opacity = 1,
}) => {
  const {pal} = useThemeB();
  return (
    <div
      style={{
        position: 'absolute',
        left: x ?? 0,
        right: x === undefined ? 0 : undefined,
        width,
        top: y,
        textAlign: align,
        fontFamily: FONT.bLabel,
        fontSize: size,
        lineHeight: `${size * 1.4}px`,
        color: color ?? pal.cream,
        letterSpacing: size * 0.18,
        textShadow: `${size / 8}px ${size / 8}px 0 #000`,
        opacity,
        whiteSpace: 'pre-line',
      }}
    >
      {text.toUpperCase()}
    </div>
  );
};

// Small framed label ("SECRET", "LAC NYOS", "ANTI-FRAUDE").
export const Tag: React.FC<{text: string; x: number; y: number; size?: number; color?: string; pop?: number; anchor?: 'center' | 'left'}> = ({
  text,
  x,
  y,
  size = 22,
  color,
  pop = 1,
  anchor = 'center',
}) => {
  const {pal} = useThemeB();
  const c = color ?? pal.cream;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(${anchor === 'center' ? '-50%' : '0'}, -50%) scale(${pop})`,
        border: `4px solid ${c}`,
        outline: `3px solid #000`,
        background: '#000',
        padding: `${size * 0.45}px ${size * 0.7}px`,
        fontFamily: FONT.bLabel,
        fontSize: size,
        color: c,
        letterSpacing: size * 0.15,
        whiteSpace: 'nowrap',
      }}
    >
      {text.toUpperCase()}
    </div>
  );
};

// Rubber stamp (INTERDIT / AUTORISÉ / FAUX / 3 ANS).
export const StampB: React.FC<{text: string; x: number; y: number; color?: 'red' | 'green' | 'gold'; ms: number; delayMs?: number; size?: number; rotate?: number}> = ({
  text,
  x,
  y,
  color = 'red',
  ms,
  delayMs = 0,
  size = 64,
  rotate = -8,
}) => {
  const {pal} = useThemeB();
  if (ms < delayMs) return null;
  const s = interpolate(ms - delayMs, [0, 120], [1.8, 1], {extrapolateRight: 'clamp'});
  const c = color === 'red' ? pal.red : color === 'green' ? pal.green : pal.gold;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${s})`,
        border: `8px solid ${c}`,
        padding: `${size * 0.1}px ${size * 0.35}px`,
        fontFamily: FONT.bTitle,
        fontSize: size,
        color: c,
        background: 'rgba(0,0,0,0.75)',
        letterSpacing: size * 0.06,
        whiteSpace: 'nowrap',
        boxShadow: '6px 6px 0 #000',
      }}
    >
      {text.toUpperCase()}
    </div>
  );
};
