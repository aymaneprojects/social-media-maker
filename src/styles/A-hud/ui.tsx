import React from 'react';
import {FONT} from '../../shared/fonts';
import {useThemeA} from './theme';

// Shared building blocks for style-A scenes.

export const useEcho = () => {
  const {pal} = useThemeA();
  const outline = `-3px 0 0 ${pal.black}, 3px 0 0 ${pal.black}, 0 -3px 0 ${pal.black}, 0 3px 0 ${pal.black}`;
  return {outline, echo: `${outline}, 6px 6px 0 ${pal.accentDark}, 9px 9px 0 ${pal.black}`};
};

// Big pixel text (dates, numbers, "24 H"), centred horizontally.
export const BigText: React.FC<{
  text: string;
  y: number;
  size?: number;
  color?: string;
  echo?: boolean;
  letterSpacing?: number;
}> = ({text, y, size = 150, color, echo = true, letterSpacing = 6}) => {
  const {pal} = useThemeA();
  const {echo: echoShadow, outline} = useEcho();
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        textAlign: 'center',
        fontFamily: FONT.caption,
        fontSize: size,
        lineHeight: `${size}px`,
        color: color ?? pal.white,
        letterSpacing,
        textShadow: echo ? echoShadow : outline,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

export const SmallText: React.FC<{
  text: string;
  x?: number;
  y: number;
  color?: string;
  size?: number;
  align?: 'left' | 'center' | 'right';
  width?: number;
}> = ({text, x, y, color, size = 22, align = 'center', width}) => {
  const {pal} = useThemeA();
  return (
    <div
      style={{
        position: 'absolute',
        left: x ?? 0,
        right: x === undefined ? 0 : undefined,
        width,
        top: y,
        textAlign: align,
        fontFamily: FONT.hud,
        fontSize: size,
        color: color ?? pal.white,
        letterSpacing: 2,
        whiteSpace: 'nowrap',
      }}
    >
      {text.toUpperCase()}
    </div>
  );
};

// Map / location tag: framed label on a stick with a dot (like "GOLFE DE GUINÉE").
export const PinLabel: React.FC<{x: number; y: number; title: string; sub?: string; stick?: number; visible?: number}> = ({
  x,
  y,
  title,
  sub,
  stick = 60,
  visible = 1,
}) => {
  const {pal} = useThemeA();
  if (visible <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y - stick, opacity: visible >= 1 ? 1 : 0.999}}>
      <div style={{position: 'absolute', left: -9, top: stick - 9, width: 18, height: 18, background: pal.accent}} />
      <div style={{position: 'absolute', left: -2, top: 0, width: 3, height: stick, background: pal.white}} />
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: -66,
          border: `3px solid ${pal.white}`,
          background: pal.bg,
          padding: '8px 14px',
          whiteSpace: 'nowrap',
          clipPath: `inset(0 ${(1 - Math.min(1, visible)) * 100}% 0 0)`,
        }}
      >
        <div style={{fontFamily: FONT.hud, fontSize: 24, color: pal.white, letterSpacing: 2}}>{title.toUpperCase()}</div>
        {sub && <div style={{fontFamily: FONT.hud, fontSize: 13, color: pal.white, opacity: 0.7, letterSpacing: 2}}>{sub.toUpperCase()}</div>}
      </div>
    </div>
  );
};

// Bordered panel with accent frame and corner dots.
export const Panel: React.FC<{x: number; y: number; w: number; h: number; children?: React.ReactNode; fill?: string; border?: string}> = ({
  x,
  y,
  w,
  h,
  children,
  fill,
  border,
}) => {
  const {pal} = useThemeA();
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        border: `3px solid ${border ?? pal.accent}`,
        background: fill ?? pal.bg,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
};

// Typewriter helper: how many characters of `text` are visible.
export const typed = (text: string, ms: number, startMs = 0, cps = 22) =>
  text.slice(0, Math.max(0, Math.floor(((ms - startMs) / 1000) * cps)));
