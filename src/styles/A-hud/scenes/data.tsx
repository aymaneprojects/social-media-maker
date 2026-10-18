import React from 'react';
import {Easing, interpolate, random} from 'remotion';
import {FONT} from '../../../shared/fonts';
import {Sprite, spriteSize} from '../../../shared/pixel';
import {colorsA, SPRITES} from '../sprites';
import {type SceneProps, useThemeA} from '../theme';
import {BigText, Panel, SmallText, typed, useEcho} from '../ui';

export const fmtNumber = (n: number, decimals = 0) => {
  const s = n.toFixed(decimals);
  const [int, dec] = s.split('.');
  const spaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec ? `${spaced},${dec}` : spaced;
};

const ease = (ms: number, from: number, to: number) =>
  interpolate(ms, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});

// ---------------------------------------------------------------- bigDate
// "26.05" -> "26.05.2013": the date is typed group by group.
export const BigDate: React.FC<SceneProps<{date: string; label?: string; y?: number}>> = ({params, ms}) => {
  const {pal} = useThemeA();
  const groups = params.date.split('.');
  const shown = Math.min(groups.length, 1 + Math.floor(ms / 280));
  const text = groups.slice(0, shown).join('.');
  const y = params.y ?? 330;
  return (
    <>
      <BigText text={text} y={y} size={150} />
      {params.label && ms > 500 && <SmallText text={params.label} y={y + 175} color={pal.accent} size={26} />}
    </>
  );
};

// ---------------------------------------------------------------- counter
// Big animated number with optional unit, label and a block grid that fills.
export const Counter: React.FC<
  SceneProps<{
    from: number;
    to: number;
    suffix?: string;
    prefix?: string;
    label?: string;
    decimals?: number;
    blocks?: number; // number of blocks in the grid (fills with the counter)
    y?: number;
    color?: 'accent' | 'white';
    durationRatio?: number; // part of the beat used by the count (default 0.8)
  }>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const p = ease(ms, 0, durationMs * (params.durationRatio ?? 0.8));
  const v = params.from + (params.to - params.from) * p;
  const text = `${params.prefix ?? ''}${fmtNumber(v, params.decimals ?? 0)}${params.suffix ? ` ${params.suffix}` : ''}`;
  const size = text.length > 9 ? 150 : text.length > 6 ? 190 : 230;
  const y = params.y ?? 560;
  const color = params.color === 'white' ? pal.white : pal.accent;
  const n = params.blocks ?? 0;
  const cols = Math.min(n, 13);
  const filled = Math.round(n * Math.max(0, Math.min(1, (v - Math.min(params.from, 0)) / (params.to || 1))));
  return (
    <>
      <BigText text={text} y={y} size={size} color={color} />
      {params.label && <SmallText text={params.label} y={y + size + 20} size={24} />}
      {n > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 540 - (cols * 30) / 2,
            top: y + size + 80,
            width: cols * 30,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 30px)`,
            gap: 0,
          }}
        >
          {Array.from({length: n}, (_, i) => (
            <div key={i} style={{width: 21, height: 21, margin: 4, background: i < filled ? color : pal.plum2}} />
          ))}
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------- iconGrid
// Grid of people; `crossed` of them get struck out one after the other.
export const IconGrid: React.FC<
  SceneProps<{
    total: number;
    crossed?: number;
    survivor?: number; // index drawn as an outline (the one who lives)
    survivorLabel?: string;
    label?: string; // big label under the grid ("1 / 12")
    sub?: string;
    cols?: number;
  }>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const total = params.total;
  const cols = params.cols ?? (total <= 12 ? 4 : total <= 30 ? 6 : Math.ceil(Math.sqrt(total * 0.8)));
  const rows = Math.ceil(total / cols);
  const {w, h} = spriteSize(SPRITES.person);
  const maxW = 860;
  const maxH = params.label ? 600 : 760;
  const cellW = maxW / cols;
  const scale = Math.max(2, Math.floor(Math.min(cellW / (w * 1.9), maxH / rows / (h * 1.5))));
  const gridW = cols * w * scale * 1.9;
  const gridH = rows * h * scale * 1.5;
  const x0 = 540 - gridW / 2;
  const y0 = 300 + Math.max(0, (maxH - gridH) / 2);
  const crossed = params.crossed ?? 0;
  const order = Array.from({length: total}, (_, i) => i).filter((i) => i !== params.survivor);
  // deterministic shuffle so crosses appear scattered
  order.sort((a, b) => random(`ig-${a}`) - random(`ig-${b}`));
  const crossStart = durationMs * 0.15;
  const crossEnd = durationMs * 0.75;
  const shownCrossed = Math.floor(interpolate(ms, [crossStart, crossEnd], [0, crossed], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const crossedSet = new Set(order.slice(0, shownCrossed));
  const colors = colorsA(pal);
  return (
    <>
      {Array.from({length: total}, (_, i) => {
        const cx = x0 + (i % cols) * w * scale * 1.9 + (w * scale * 0.45);
        const cy = y0 + Math.floor(i / cols) * h * scale * 1.5;
        const isSurvivor = i === params.survivor;
        const isCrossed = crossedSet.has(i);
        return (
          <React.Fragment key={i}>
            <Sprite
              art={isSurvivor ? SPRITES.personOutline : SPRITES.person}
              colors={isCrossed ? {...colors, A: pal.mid1} : colors}
              x={cx}
              y={cy}
              scale={scale}
            />
            {isCrossed && (
              <div
                style={{
                  position: 'absolute',
                  left: cx - scale,
                  top: cy + (h * scale) / 2 - scale,
                  width: w * scale + scale * 2,
                  height: scale * 1.2,
                  background: pal.accent,
                  transform: 'rotate(-55deg)',
                }}
              />
            )}
            {isSurvivor && params.survivorLabel && (
              <div
                style={{
                  position: 'absolute',
                  left: cx - 40,
                  width: w * scale + 80,
                  textAlign: 'center',
                  top: cy + h * scale + 6,
                  fontFamily: FONT.hud,
                  fontSize: 14,
                  color: pal.accent,
                }}
              >
                {params.survivorLabel.toUpperCase()}
              </div>
            )}
          </React.Fragment>
        );
      })}
      {params.label && ms > durationMs * 0.5 && <BigText text={params.label} y={Math.min(y0 + gridH + 30, 960)} size={110} color={pal.accent} />}
      {params.sub && ms > durationMs * 0.5 && <SmallText text={params.sub} y={Math.min(y0 + gridH + 150, 1080)} size={22} />}
    </>
  );
};

// ---------------------------------------------------------------- checklist
// Protocol / suspects / responsibles list. Items appear, get ticked or struck.
export const Checklist: React.FC<
  SceneProps<{
    title: string;
    items: {text: string; state?: 'check' | 'todo' | 'strike' | 'lock'}[];
    status?: string;
    final?: string;
  }>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const n = params.items.length;
  const step = (durationMs * 0.7) / Math.max(1, n);
  const top = 360;
  const height = 150 + n * 92 + (params.final || params.status ? 110 : 30);
  return (
    <>
      <Panel x={70} y={top} w={940} h={height} fill={pal.bg}>
        <div style={{background: pal.accent, height: 36, textAlign: 'center', fontFamily: FONT.hud, fontSize: 18, lineHeight: '36px', color: pal.bg, letterSpacing: 3}}>
          {params.title.toUpperCase()}
        </div>
        {params.items.map((it, i) => {
          const appear = i * step;
          if (ms < appear) return null;
          const done = ms > appear + step * 0.6;
          const active = !done && ms >= appear;
          const strikeW = it.state === 'strike' && done ? interpolate(ms, [appear + step * 0.6, appear + step], [0, 100], {extrapolateRight: 'clamp'}) : 0;
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                margin: '22px 30px 0',
                height: 70,
                display: 'flex',
                alignItems: 'center',
                background: active ? pal.plum2 : 'transparent',
                fontFamily: FONT.caption,
                fontSize: 64,
                color: it.state === 'lock' ? pal.mid2 : pal.white,
              }}
            >
              <span style={{width: 50, color: pal.accent}}>{active ? '▸' : ''}</span>
              <span style={{color: pal.accent, marginRight: 16}}>{i + 1}</span>
              <span style={{flex: 1, position: 'relative'}}>
                {it.text.toUpperCase()}
                {strikeW > 0 && <span style={{position: 'absolute', left: 0, top: 34, height: 6, width: `${strikeW}%`, background: pal.white}} />}
              </span>
              <span
                style={{
                  width: 44,
                  height: 44,
                  border: `3px solid ${pal.mid3}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: pal.accent,
                  fontSize: 56,
                }}
              >
                {it.state === 'check' && done ? '✓' : it.state === 'lock' ? '·' : ''}
              </span>
            </div>
          );
        })}
        {params.final && ms > durationMs * 0.75 && (
          <div style={{textAlign: 'center', marginTop: 26, fontFamily: FONT.caption, fontSize: 90, color: pal.accent}}>{params.final.toUpperCase()}</div>
        )}
        {params.status && !params.final && (
          <div style={{position: 'absolute', left: 40, bottom: 26, fontFamily: FONT.hud, fontSize: 16, color: pal.white}}>
            STATUT : <span style={{color: pal.accent}}>{params.status.toUpperCase()}</span>
          </div>
        )}
      </Panel>
    </>
  );
};

// ---------------------------------------------------------------- clock
// Analog wall clock whose hands sweep from `from` to `to`.
export const Clock: React.FC<SceneProps<{from: string; to: string; add?: string}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  let a = toMin(params.from);
  let b = toMin(params.to);
  if (b < a) b += 24 * 60;
  const p = ease(ms, 0, durationMs * 0.7);
  const t = a + (b - a) * p;
  const minAngle = (t % 60) * 6;
  const hourAngle = ((t / 60) % 12) * 30;
  const secAngle = (ms / 1000) * 360 * 0.5;
  const R = 300;
  const cx = 540;
  const cy = 620;
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: `radial-gradient(circle at 50% 33%, ${pal.mid1} 0%, ${pal.plum} 45%, ${pal.bg} 80%)`}} />
      <svg width={1080} height={1300} style={{position: 'absolute', left: 0, top: 0}}>
        <circle cx={cx + 18} cy={cy + 24} r={R + 26} fill={pal.black} opacity={0.5} />
        <circle cx={cx} cy={cy} r={R + 26} fill={pal.plum2} stroke={pal.mid1} strokeWidth={6} />
        <circle cx={cx} cy={cy} r={R} fill={pal.paper} />
        <circle cx={cx} cy={cy} r={R} fill="url(#clockShade)" />
        <defs>
          <radialGradient id="clockShade" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0.5" stopColor={pal.paper} stopOpacity={0} />
            <stop offset="1" stopColor={pal.mid2} stopOpacity={0.9} />
          </radialGradient>
        </defs>
        {Array.from({length: 60}, (_, i) => {
          const ang = (i * 6 * Math.PI) / 180;
          const big = i % 5 === 0;
          const r1 = R - (big ? 46 : 22);
          return (
            <line
              key={i}
              x1={cx + Math.sin(ang) * r1}
              y1={cy - Math.cos(ang) * r1}
              x2={cx + Math.sin(ang) * (R - 10)}
              y2={cy - Math.cos(ang) * (R - 10)}
              stroke={pal.bg}
              strokeWidth={big ? 9 : 4}
            />
          );
        })}
        <line x1={cx} y1={cy} x2={cx + Math.sin((hourAngle * Math.PI) / 180) * 150} y2={cy - Math.cos((hourAngle * Math.PI) / 180) * 150} stroke={pal.bg} strokeWidth={18} />
        <line x1={cx} y1={cy} x2={cx + Math.sin((minAngle * Math.PI) / 180) * 240} y2={cy - Math.cos((minAngle * Math.PI) / 180) * 240} stroke={pal.bg} strokeWidth={11} />
        <line x1={cx} y1={cy} x2={cx + Math.sin((secAngle * Math.PI) / 180) * 260} y2={cy - Math.cos((secAngle * Math.PI) / 180) * 260} stroke={pal.accent} strokeWidth={4} />
        <circle cx={cx} cy={cy} r={14} fill={pal.accent} />
      </svg>
      {params.add && ms > 300 && <BigText text={params.add} y={1340} size={100} color={pal.accent} echo={false} />}
    </>
  );
};

// ---------------------------------------------------------------- gauge
// Vertical ruler (depth, altitude, temperature…) with a moving marker and an
// optional sprite travelling with the value.
export const Gauge: React.FC<
  SceneProps<{
    from: number;
    to: number;
    unit: string;
    label?: string;
    sprite?: string;
    min?: number;
    max?: number;
    trail?: 'bubbles' | 'wind' | 'none';
  }>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const p = ease(ms, 0, durationMs * 0.85);
  const v = params.from + (params.to - params.from) * p;
  const min = params.min ?? Math.min(params.from, params.to);
  const max = params.max ?? Math.max(params.from, params.to);
  const topY = 330;
  const botY = 1420;
  // altitude: high values at the top. depth: put max at the bottom.
  const descending = params.unit.toUpperCase() === 'M' && params.label?.toUpperCase().includes('PROF');
  const valToY = (val: number) => {
    const t = (val - min) / Math.max(1, max - min);
    return descending ? topY + t * (botY - topY) : botY - t * (botY - topY);
  };
  const y = valToY(v);
  const colors = colorsA(pal);
  const art = params.sprite ? SPRITES[params.sprite] : undefined;
  const ticks = 10;
  return (
    <>
      {/* ruler */}
      <div style={{position: 'absolute', left: 900, top: topY, width: 3, height: botY - topY, background: pal.mid2}} />
      {Array.from({length: ticks + 1}, (_, i) => {
        const val = min + ((max - min) * i) / ticks;
        const ty = valToY(val);
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: 885, top: ty, width: 18, height: 3, background: pal.mid2}} />
            <div style={{position: 'absolute', left: 935, top: ty - 9, fontFamily: FONT.hud, fontSize: 14, color: pal.mid3}}>{fmtNumber(val)}</div>
          </React.Fragment>
        );
      })}
      {/* filled portion */}
      <div
        style={{
          position: 'absolute',
          left: 897,
          top: Math.min(y, valToY(params.from)),
          width: 9,
          height: Math.abs(y - valToY(params.from)),
          background: pal.accent,
        }}
      />
      <div style={{position: 'absolute', left: 860, top: y - 12, width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: `24px solid ${pal.accent}`}} />
      <div style={{position: 'absolute', right: 230, top: y - 30, fontFamily: FONT.caption, fontSize: 64, color: pal.white, textAlign: 'right'}}>
        {fmtNumber(v)} {params.unit}
      </div>
      {params.label && <SmallText text={params.label} x={700} width={360} align="center" y={topY - 60} size={18} color={pal.accent} />}
      {art && (
        <Sprite
          art={art}
          colors={colors}
          scale={9}
          x={330 - (spriteSize(art).w * 9) / 2 + Math.sin(ms / 300) * 12}
          y={y - (spriteSize(art).h * 9) / 2}
          style={{transform: `rotate(${Math.sin(ms / 260) * 14}deg)`}}
        />
      )}
      {params.trail !== 'none' &&
        Array.from({length: 26}, (_, i) => {
          const r = random(`gt-${i}`);
          const speed = 0.4 + random(`gs-${i}`) * 0.8;
          const yy = (((r * 1600 + (ms * speed * (params.to < params.from ? -1 : 1))) % 1600) + 1600) % 1600 + 250;
          const xx = 120 + random(`gx-${i}`) * 520;
          return params.trail === 'bubbles' ? (
            <div key={i} style={{position: 'absolute', left: xx, top: yy, width: 15, height: 15, border: `3px solid ${pal.white}`, borderRadius: 9, opacity: 0.6}} />
          ) : (
            <div key={i} style={{position: 'absolute', left: xx, top: yy, width: 3, height: 60 + r * 90, background: pal.mid2, opacity: 0.7}} />
          );
        })}
    </>
  );
};

// ---------------------------------------------------------------- stamp
// "VIVANT" / "BLÂME" / "AUCUN ESPOIR": a framed stamp slams onto the screen.
export const Stamp: React.FC<SceneProps<{text: string; sub?: string; heart?: boolean; line?: boolean; y?: number}>> = ({params, ms}) => {
  const {pal} = useThemeA();
  const s = interpolate(ms, [0, 140], [1.7, 1], {extrapolateRight: 'clamp'});
  const y = params.y ?? 420;
  const colors = colorsA(pal);
  const beat = Math.floor(ms / 430) % 2 === 0 ? 1 : 0.85;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 40%, ${pal.plum2} 0%, ${pal.bg} 70%)`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center'}}>
        <div
          style={{
            transform: `scale(${s}) rotate(-2deg)`,
            border: `9px solid ${pal.accent}`,
            outline: `3px solid ${pal.accent}`,
            outlineOffset: 6,
            padding: '10px 36px',
            fontFamily: FONT.caption,
            fontSize: 170,
            lineHeight: '170px',
            color: pal.accent,
            letterSpacing: 10,
          }}
        >
          {params.text.toUpperCase()}
        </div>
      </div>
      {params.line !== false && <div style={{position: 'absolute', left: 150, right: 150, top: y + 330, height: 4, background: pal.accent}} />}
      {params.heart !== false && (
        <div style={{position: 'absolute', left: 540 - 42 * beat, top: y + 420, transform: `scale(${beat})`}}>
          <Sprite art={SPRITES.heart} colors={colors} scale={12} />
        </div>
      )}
      {params.sub && <SmallText text={params.sub} y={y + 260} size={22} />}
    </>
  );
};

// ---------------------------------------------------------------- bigWord
// One heavy word in the void ("PERSONNE"), with falling dither streaks.
export const BigWord: React.FC<SceneProps<{text: string; sub?: string; color?: 'grey' | 'accent' | 'white'; streaks?: boolean}>> = ({params, ms}) => {
  const {pal} = useThemeA();
  const color = params.color === 'accent' ? pal.accent : params.color === 'white' ? pal.white : pal.mid3;
  return (
    <>
      {params.streaks !== false &&
        Array.from({length: 14}, (_, i) => {
          const x = 60 + i * 72;
          const off = ((ms / 6 + random(`bw-${i}`) * 900) % 900) - 300;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: 250 + off,
                width: 12,
                height: 600,
                backgroundImage: `repeating-linear-gradient(0deg, ${pal.plum2} 0 6px, transparent 6px 18px)`,
                opacity: 0.6,
              }}
            />
          );
        })}
      <BigText text={params.text.toUpperCase()} y={560} size={params.text.length > 9 ? 110 : 140} color={color} echo={false} />
      {params.sub && <SmallText text={params.sub} y={720} size={24} color={pal.accent} />}
    </>
  );
};

// ---------------------------------------------------------------- heart rate
// Pulse monitor (bottom left): heart, BPM value rising, scrolling ECG line.
export const HeartRateOverlay: React.FC<{bpmFrom: number; bpmTo: number; ms: number; durationMs: number}> = ({bpmFrom, bpmTo, ms, durationMs}) => {
  const {pal} = useThemeA();
  const bpm = Math.round(interpolate(ms, [0, durationMs], [bpmFrom, bpmTo], {extrapolateRight: 'clamp'}));
  const period = 60000 / bpm;
  const phase = (ms % period) / period;
  const big = phase < 0.15;
  const colors = colorsA(pal);
  const pts: string[] = [];
  for (let x = 0; x <= 300; x += 6) {
    const t = ((x / 300) * 2 + ms / period) % 1;
    const yv = t > 0.45 && t < 0.5 ? -30 : t >= 0.5 && t < 0.55 ? 22 : t > 0.6 && t < 0.68 ? -8 : 0;
    pts.push(`${x},${40 + yv}`);
  }
  return (
    <div style={{position: 'absolute', left: 50, top: 1560}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{transform: `scale(${big ? 1.25 : 1})`}}>
          <Sprite art={SPRITES.heart} colors={colors} scale={6} style={{position: 'relative'}} />
        </div>
        <div style={{fontFamily: FONT.hud, fontSize: 24, color: pal.white}}>{bpm} BPM</div>
      </div>
      <svg width={300} height={80} style={{marginTop: 6}}>
        <polyline points={pts.join(' ')} fill="none" stroke={pal.accent} strokeWidth={3} />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------- typed note
// Terminal-like report line typed under a portrait (e.g. "FAUSSE ALERTE").
export const TypedNote: React.FC<SceneProps<{title?: string; text: string; sub?: string}>> = ({params, ms}) => {
  const {pal} = useThemeA();
  const {outline} = useEcho();
  return (
    <Panel x={70} y={760} w={940} h={230}>
      {params.title && (
        <div style={{position: 'absolute', top: -24, left: 20, background: pal.accent, color: pal.bg, fontFamily: FONT.hud, fontSize: 14, padding: '2px 10px'}}>
          {params.title.toUpperCase()}
        </div>
      )}
      <div style={{padding: '40px 36px', fontFamily: FONT.caption, fontSize: 72, color: pal.white, textShadow: outline}}>{typed(params.text.toUpperCase(), ms, 100, 18)}</div>
      {params.sub && <div style={{position: 'absolute', left: 36, bottom: 24, fontFamily: FONT.hud, fontSize: 14, color: pal.accent}}>{typed(params.sub.toUpperCase(), ms, 800, 30)}</div>}
    </Panel>
  );
};
