import React from 'react';
import {Easing, interpolate} from 'remotion';
import {FONT} from '../../../shared/fonts';
import {Sprite} from '../../../shared/pixel';
import {colorsA, SPRITES} from '../sprites';
import {type SceneProps, useThemeA} from '../theme';
import {BigText, Panel, SmallText, typed, useEcho} from '../ui';
import {fmtNumber} from './data';

const ease = (ms: number, a: number, b: number) =>
  interpolate(ms, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});

// ---------------------------------------------------------------- scoreboard
// LED scoreboard: two sides, scores ticking, match clock, period label.
export const Scoreboard: React.FC<
  SceneProps<{left: {name: string; from?: number; to: number}; right: {name: string; from?: number; to: number}; time?: string; label?: string}>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const {echo} = useEcho();
  const p = ease(ms, durationMs * 0.1, durationMs * 0.75);
  const score = (s: {from?: number; to: number}) => Math.round((s.from ?? 0) + (s.to - (s.from ?? 0)) * p);
  const led = (text: string, size: number, color: string) => (
    <div style={{fontFamily: FONT.digits, fontSize: size, color, letterSpacing: 6, textShadow: `0 0 18px ${color}`}}>{text}</div>
  );
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: 380,
          height: 560,
          background: pal.black,
          border: `9px solid ${pal.mid1}`,
          outline: `3px solid ${pal.accent}`,
          outlineOffset: -24,
          backgroundImage: `radial-gradient(${pal.plum2} 2px, transparent 2px)`,
          backgroundSize: '12px 12px',
        }}
      >
        <div style={{position: 'absolute', left: 0, right: 0, top: 40, display: 'flex', justifyContent: 'center'}}>{params.time && led(params.time, 90, pal.white)}</div>
        <div style={{position: 'absolute', left: 40, right: 40, top: 190, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{width: 360, textAlign: 'center'}}>{led(String(score(params.left)), 200, pal.accent)}</div>
          <div style={{width: 44, height: 16, background: pal.mid3}} />
          <div style={{width: 360, textAlign: 'center'}}>{led(String(score(params.right)), 200, pal.accent)}</div>
        </div>
        <div style={{position: 'absolute', left: 40, right: 40, top: 440, display: 'flex', justifyContent: 'space-between'}}>
          <div style={{width: 380, textAlign: 'center', fontFamily: FONT.caption, fontSize: 56, color: pal.white, textShadow: echo}}>{params.left.name.toUpperCase()}</div>
          <div style={{width: 380, textAlign: 'center', fontFamily: FONT.caption, fontSize: 56, color: pal.white, textShadow: echo}}>{params.right.name.toUpperCase()}</div>
        </div>
      </div>
      {params.label && <SmallText text={params.label} y={980} size={24} color={pal.accent} />}
    </>
  );
};

// ---------------------------------------------------------------- lineChart
// Pixel line chart drawn progressively (stock price, records, temperatures…).
export const LineChart: React.FC<
  SceneProps<{title?: string; unit?: string; points: {label: string; value: number}[]; highlight?: number; note?: string}>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const pts = params.points;
  const vals = pts.map((p) => p.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(...vals) * 1.1 || 1;
  const x0 = 140;
  const x1 = 960;
  const y0 = 1080;
  const y1 = 420;
  const X = (i: number) => x0 + ((x1 - x0) * i) / Math.max(1, pts.length - 1);
  const Y = (v: number) => y0 - ((v - min) / (max - min)) * (y0 - y1);
  const p = ease(ms, 0, durationMs * 0.7);
  const shown = p * (pts.length - 1);
  const k = Math.floor(shown);
  const path: string[] = [];
  for (let i = 0; i <= k && i < pts.length; i++) path.push(`${X(i)},${Y(pts[i].value)}`);
  if (k < pts.length - 1) {
    const f = shown - k;
    path.push(`${X(k) + (X(k + 1) - X(k)) * f},${Y(pts[k].value) + (Y(pts[k + 1].value) - Y(pts[k].value)) * f}`);
  }
  const last = path[path.length - 1].split(',').map(Number);
  const hl = params.highlight !== undefined && shown >= params.highlight ? params.highlight : undefined;
  return (
    <>
      {params.title && <SmallText text={params.title} y={330} size={26} color={pal.accent} />}
      <svg width={1080} height={1200} style={{position: 'absolute', left: 0, top: 0}} shapeRendering="crispEdges">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={x0} x2={x1} y1={y0 - (y0 - y1) * g} y2={y0 - (y0 - y1) * g} stroke={pal.plum2} strokeWidth={3} />
        ))}
        <line x1={x0} x2={x0} y1={y1} y2={y0} stroke={pal.mid2} strokeWidth={4} />
        <line x1={x0} x2={x1} y1={y0} y2={y0} stroke={pal.mid2} strokeWidth={4} />
        <polygon points={`${x0},${y0} ${path.join(' ')} ${last[0]},${y0}`} fill={pal.accent} opacity={0.15} />
        <polyline points={path.join(' ')} fill="none" stroke={pal.accent} strokeWidth={9} strokeLinejoin="miter" />
        <rect x={last[0] - 12} y={last[1] - 12} width={24} height={24} fill={pal.white} />
        {hl !== undefined && <rect x={X(hl) - 18} y={Y(pts[hl].value) - 18} width={36} height={36} fill="none" stroke={pal.white} strokeWidth={6} />}
      </svg>
      {pts.map((pt, i) =>
        i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1 ? (
          <div key={i} style={{position: 'absolute', left: X(i) - 80, width: 160, top: y0 + 18, textAlign: 'center', fontFamily: FONT.hud, fontSize: 15, color: pal.mid3}}>
            {pt.label}
          </div>
        ) : null,
      )}
      <div style={{position: 'absolute', left: Math.min(760, last[0] - 60), top: last[1] - 90, fontFamily: FONT.caption, fontSize: 58, color: pal.white}}>
        {fmtNumber(pts[Math.min(pts.length - 1, Math.round(shown))].value)} {params.unit ?? ''}
      </div>
      {hl !== undefined && params.note && (
        <div
          style={{
            position: 'absolute',
            ...(X(hl) > 600 ? {right: 1080 - (X(hl) - 40)} : {left: X(hl) + 40}),
            top: Math.max(y1, Math.min(y0 - 200, Y(pts[hl].value) - 24)),
            background: pal.accent,
            color: pal.bg,
            fontFamily: FONT.hud,
            fontSize: 22,
            padding: '6px 12px',
          }}
        >
          {params.note.toUpperCase()}
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------- versus
// Two dossiers face to face (suspects, rivals, companies) with a VS.
type Side = {name: string; sub?: string; fields?: {k: string; v: string}[]; sprite?: string; crossed?: boolean};
export const Versus: React.FC<SceneProps<{left: Side; right: Side; vs?: string}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const colors = colorsA(pal);
  const card = (s: Side, x: number, appear: number) => {
    if (ms < appear) return null;
    const slide = Math.round((1 - ease(ms, appear, appear + 300)) * 60) * (x < 540 ? -1 : 1);
    return (
      <Panel x={x + slide} y={400} w={450} h={640}>
        <div style={{position: 'relative', height: 260, borderBottom: `3px solid ${pal.accent}`, background: pal.plum}}>
          {s.sprite && SPRITES[s.sprite] && <Sprite art={SPRITES[s.sprite]} colors={colors} scale={14} x={225 - 7 * 14} y={50} />}
        </div>
        <div style={{padding: '20px 24px'}}>
          <div style={{fontFamily: FONT.caption, fontSize: 56, color: pal.white, lineHeight: '56px'}}>{s.name.toUpperCase()}</div>
          {s.sub && <div style={{fontFamily: FONT.hud, fontSize: 16, color: pal.accent, marginTop: 6}}>{s.sub.toUpperCase()}</div>}
          {(s.fields ?? []).map((f, i) => (
            <div key={i} style={{marginTop: 14}}>
              <div style={{fontFamily: FONT.hud, fontSize: 12, color: pal.mid3}}>{f.k.toUpperCase()}</div>
              <div style={{fontFamily: FONT.caption, fontSize: 40, color: pal.white, lineHeight: '40px'}}>{typed(f.v.toUpperCase(), ms, appear + 200 + i * 200, 40)}</div>
            </div>
          ))}
        </div>
        {s.crossed && ms > durationMs * 0.6 && (
          // big X over the portrait only, so the name and fields stay readable
          <div style={{position: 'absolute', left: 0, top: 0, width: 450, height: 260, transform: `scale(${0.6 + 0.4 * ease(ms, durationMs * 0.6, durationMs * 0.6 + 150)})`}}>
            {[34, -34].map((r) => (
              <div key={r} style={{position: 'absolute', left: 45, top: 124, width: 360, height: 14, background: pal.accent, transform: `rotate(${r}deg)`}} />
            ))}
          </div>
        )}
      </Panel>
    );
  };
  return (
    <>
      {card(params.left, 50, 0)}
      {card(params.right, 580, 250)}
      {ms > 450 && <BigText text={params.vs ?? 'VS'} y={640} size={120} color={pal.accent} />}
    </>
  );
};

// ---------------------------------------------------------------- timeline
// Vertical list of dated events revealed one by one.
export const TimelineA: React.FC<SceneProps<{title?: string; events: {date: string; text: string}[]; highlight?: number}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const n = params.events.length;
  const step = (durationMs * 0.75) / Math.max(1, n);
  const top = 360;
  const gap = Math.min(170, 760 / Math.max(1, n));
  return (
    <>
      {params.title && <SmallText text={params.title} y={290} size={24} color={pal.accent} />}
      <div style={{position: 'absolute', left: 230, top, width: 6, height: gap * (n - 1) * Math.min(1, ms / (step * n)) + 6, background: pal.accent}} />
      {params.events.map((e, i) => {
        if (ms < i * step) return null;
        const y = top + i * gap;
        const hl = params.highlight === i;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: 215, top: y - 12, width: 36, height: 36, background: hl ? pal.accent : pal.bg, border: `6px solid ${pal.accent}`, boxSizing: 'border-box'}} />
            <div style={{position: 'absolute', left: 40, width: 160, top: y - 14, textAlign: 'right', fontFamily: FONT.digits, fontSize: 34, color: pal.white}}>{e.date}</div>
            <div style={{position: 'absolute', left: 290, right: 60, top: y - 22, fontFamily: FONT.caption, fontSize: 54, lineHeight: '54px', color: hl ? pal.accent : pal.white}}>
              {typed(e.text.toUpperCase(), ms, i * step, 40)}
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- podium
export const Podium: React.FC<SceneProps<{first: string; second?: string; third?: string; label?: string}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const colors = colorsA(pal);
  const steps = [
    {name: params.second, h: 260, x: 110, rank: '2', at: 0.2},
    {name: params.first, h: 380, x: 390, rank: '1', at: 0.45},
    {name: params.third, h: 180, x: 670, rank: '3', at: 0},
  ];
  return (
    <>
      {steps.map((s, i) => {
        if (!s.name) return null;
        const p = ease(ms, durationMs * s.at, durationMs * s.at + 400);
        const h = s.h * p;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: s.x, top: 1080 - h, width: 300, height: h, background: s.rank === '1' ? pal.accent : pal.mid1, borderTop: `9px solid ${pal.white}`}}>
              <div style={{textAlign: 'center', fontFamily: FONT.digits, fontSize: 90, color: s.rank === '1' ? pal.bg : pal.white, marginTop: 20}}>{s.rank}</div>
            </div>
            {p > 0.9 && (
              <div style={{position: 'absolute', left: s.x - 40, width: 380, top: 1080 - h - 90, textAlign: 'center', fontFamily: FONT.caption, fontSize: 46, color: pal.white}}>
                {s.name.toUpperCase()}
              </div>
            )}
          </React.Fragment>
        );
      })}
      {ms > durationMs * 0.6 && <Sprite art={SPRITES.trophy} colors={colors} scale={14} x={540 - 63} y={360} />}
      {params.label && <SmallText text={params.label} y={1110} size={22} color={pal.accent} />}
    </>
  );
};

// ---------------------------------------------------------------- newspaper
// Front page with the headline typed in (scandals, verdicts, records).
export const Newspaper: React.FC<SceneProps<{masthead?: string; headline: string; date?: string; sub?: string}>> = ({params, ms}) => {
  const {pal} = useThemeA();
  const s = interpolate(ms, [0, 220], [1.25, 1], {extrapolateRight: 'clamp'});
  const rot = interpolate(ms, [0, 220], [-8, -2], {extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: 110, top: 330, width: 860, height: 820, background: pal.paper, transform: `scale(${s}) rotate(${rot}deg)`, boxShadow: `18px 18px 0 ${pal.black}`}}>
      <div style={{textAlign: 'center', fontFamily: FONT.caption, fontSize: 80, color: pal.bg, borderBottom: `6px solid ${pal.bg}`, margin: '20px 30px 0'}}>
        {(params.masthead ?? 'LE JOURNAL').toUpperCase()}
      </div>
      {params.date && <div style={{textAlign: 'center', fontFamily: FONT.hud, fontSize: 16, color: pal.mid1, marginTop: 8}}>{params.date.toUpperCase()}</div>}
      <div style={{margin: '30px 40px 0', fontFamily: FONT.caption, fontSize: 92, lineHeight: '88px', color: pal.bg}}>{typed(params.headline.toUpperCase(), ms, 250, 30)}</div>
      {params.sub && <div style={{margin: '24px 40px 0', fontFamily: FONT.hud, fontSize: 18, color: pal.accentDark}}>{params.sub.toUpperCase()}</div>}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{position: 'absolute', left: 40 + (i % 2) * 400, top: 600 + Math.floor(i / 2) * 60, width: 360, height: 14, background: pal.mid3, opacity: 0.6}} />
      ))}
    </div>
  );
};
