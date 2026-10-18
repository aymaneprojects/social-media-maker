import React from 'react';
import {Easing, interpolate} from 'remotion';
import {FONT} from '../../shared/fonts';
import type {Beat} from '../../shared/schema';
import {LAYOUT, useThemeA} from './theme';

// HUD clock modes, all driven by the storyboard:
//  time     "04:30" -> "04:31"            (wall clock, HH:MM)
//  elapsed  0s -> 216000s                (HH:MM:SS, can race forward)
//  date     "17.10.2026" -> "17.10.1814"  (rewinds / advances with easing)
//  text     "1983"                        (static)
export type ClockSpec =
  | {mode: 'time'; from: string; to?: string}
  | {mode: 'elapsed'; fromSec: number; toSec: number}
  | {mode: 'date'; from: string; to?: string}
  | {mode: 'text'; value: string};

export type HudSpec = {
  clock?: ClockSpec;
  label?: string;
  gauge?: {label: string; from: number; to: number} | null;
  hidden?: boolean;
};

const pad = (n: number, l = 2) => String(Math.max(0, Math.floor(n))).padStart(l, '0');

const parseHM = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

const parseDate = (s: string) => {
  const parts = s.split('.').map(Number);
  if (parts.length === 3) return {d: parts[0], m: parts[1], y: parts[2]};
  if (parts.length === 2) return {d: 0, m: parts[0], y: parts[1]};
  return {d: 0, m: 0, y: parts[0]};
};

const formatClock = (spec: ClockSpec, p: number): string => {
  switch (spec.mode) {
    case 'time': {
      const a = parseHM(spec.from);
      const b = spec.to ? parseHM(spec.to) : a;
      const v = Math.floor(a + (b - a) * p);
      return `${pad(v / 60)}:${pad(v % 60)}`;
    }
    case 'elapsed': {
      const s = spec.fromSec + (spec.toSec - spec.fromSec) * p;
      return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
    }
    case 'date': {
      const a = parseDate(spec.from);
      const b = spec.to ? parseDate(spec.to) : a;
      const e = Easing.inOut(Easing.cubic)(p);
      const y = Math.round(a.y + (b.y - a.y) * e);
      const m = Math.round(a.m + (b.m - a.m) * e);
      const d = Math.round(a.d + (b.d - a.d) * e);
      if (a.d) return `${pad(d)}.${pad(m)}.${y}`;
      if (a.m) return `${pad(m)}.${y}`;
      return `${y}`;
    }
    case 'text':
      return spec.value;
  }
};

const resolveHud = (beats: Beat[], index: number, ms: number) => {
  let clock: ClockSpec = {mode: 'text', value: ''};
  let clockP = 1;
  let label = '';
  let gauge: HudSpec['gauge'] = null;
  let gaugeP = 1;
  let hidden = false;
  for (let i = 0; i <= index; i++) {
    const h = beats[i].hud as HudSpec | undefined;
    if (!h) continue;
    const b = beats[i];
    const p = i === index ? Math.min(1, Math.max(0, (ms - b.startMs) / Math.max(1, b.endMs - b.startMs))) : 1;
    if (h.clock) {
      clock = h.clock;
      clockP = p;
    }
    if (h.label !== undefined) label = h.label;
    if (h.gauge !== undefined) {
      gauge = h.gauge;
      gaugeP = p;
    }
    if (h.hidden !== undefined) hidden = h.hidden;
  }
  return {text: formatClock(clock, clockP), label, gauge, gaugeP, hidden};
};

const Bracket: React.FC<{x: number; y: number; flipX?: boolean; flipY?: boolean; color: string}> = ({x, y, flipX, flipY, color}) => {
  const arm = 38;
  const t = 3;
  return (
    <div style={{position: 'absolute', left: flipX ? x - arm : x, top: flipY ? y - arm : y, width: arm, height: arm}}>
      <div style={{position: 'absolute', left: 0, top: flipY ? arm - t : 0, width: arm, height: t, background: color}} />
      <div style={{position: 'absolute', left: flipX ? arm - t : 0, top: 0, width: t, height: arm, background: color}} />
    </div>
  );
};

export const Hud: React.FC<{beats: Beat[]; index: number; ms: number}> = ({beats, index, ms}) => {
  const {pal, brand, issue} = useThemeA();
  const st = resolveHud(beats, index, ms);
  if (st.hidden) return null;
  const blink = Math.floor(ms / 500) % 2 === 0;
  const {bracketInset: bi, badge} = LAYOUT;
  const gaugeValue = st.gauge ? interpolate(st.gaugeP, [0, 1], [st.gauge.from, st.gauge.to]) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <Bracket x={bi.x} y={bi.top} color={pal.accent} />
      <Bracket x={1080 - bi.x} y={bi.top} flipX color={pal.accent} />
      <Bracket x={bi.x} y={bi.bottom} flipY color={pal.accent} />
      <Bracket x={1080 - bi.x} y={bi.bottom} flipX flipY color={pal.accent} />

      {/* badge + issue number */}
      <div style={{position: 'absolute', left: badge.x, top: badge.y, display: 'flex', gap: 12, height: badge.h}}>
        <div
          style={{
            background: pal.accent,
            color: pal.bg,
            fontFamily: FONT.digits,
            fontSize: 36,
            lineHeight: `${badge.h}px`,
            padding: '0 14px',
            letterSpacing: 3,
            whiteSpace: 'nowrap',
          }}
        >
          {brand.name.toUpperCase()}
        </div>
        <div
          style={{
            border: `3px solid ${pal.accent}`,
            color: pal.accent,
            fontFamily: FONT.digits,
            fontSize: 36,
            lineHeight: `${badge.h - 6}px`,
            padding: '0 10px',
            letterSpacing: 3,
          }}
        >
          N°{String(issue).padStart(2, '0')}
        </div>
      </div>

      {st.gauge && (
        <div style={{position: 'absolute', left: badge.x - 25, top: badge.y + badge.h + 12, display: 'flex', alignItems: 'center', gap: 8}}>
          <div style={{fontFamily: FONT.hud, fontSize: 18, color: pal.white}}>{st.gauge.label}</div>
          <div style={{width: 150, height: 15, border: `3px solid ${pal.accent}`, padding: 3, boxSizing: 'border-box'}}>
            <div
              style={{
                width: `${Math.max(0, Math.min(1, gaugeValue)) * 100}%`,
                height: '100%',
                backgroundImage: `repeating-linear-gradient(90deg, ${pal.accent} 0 6px, transparent 6px 9px)`,
              }}
            />
          </div>
        </div>
      )}

      {/* clock */}
      <div style={{position: 'absolute', right: 45, top: 186, textAlign: 'right'}}>
        <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 9}}>
          <div style={{width: 9, height: 9, marginTop: 6, background: blink ? pal.accent : 'transparent'}} />
          <div style={{fontFamily: FONT.digits, fontSize: 48, lineHeight: '40px', color: pal.white, letterSpacing: 3}}>{st.text}</div>
        </div>
        {st.label && (
          <div style={{fontFamily: FONT.hud, fontSize: 16, color: pal.white, opacity: 0.75, marginTop: 8, letterSpacing: 2}}>
            {st.label.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
};
