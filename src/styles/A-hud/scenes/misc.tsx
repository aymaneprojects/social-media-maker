import React from 'react';
import {interpolate, random} from 'remotion';
import {FONT} from '../../../shared/fonts';
import {Sprite} from '../../../shared/pixel';
import {colorsA, SPRITES} from '../sprites';
import {type SceneProps, useThemeA} from '../theme';
import {SmallText} from '../ui';

// Radar sweep with blips (surveillance, search, detection).
export const Radar: React.FC<SceneProps<{blips?: number; label?: string; alert?: string}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const cx = 540;
  const cy = 700;
  const R = 420;
  const ang = (ms / 1000) * 120;
  const blips = params.blips ?? 3;
  return (
    <>
      <svg width={1080} height={1500} style={{position: 'absolute', left: 0, top: 0}} shapeRendering="crispEdges">
        {[1, 0.75, 0.5, 0.25].map((k) => (
          <circle key={k} cx={cx} cy={cy} r={R * k} fill="none" stroke={pal.mid1} strokeWidth={4} />
        ))}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke={pal.mid1} strokeWidth={3} />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke={pal.mid1} strokeWidth={3} />
        <g transform={`rotate(${ang} ${cx} ${cy})`}>
          <path d={`M ${cx} ${cy} L ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx + R * Math.cos(-0.7)} ${cy + R * Math.sin(-0.7)} Z`} fill={pal.accent} opacity={0.35} />
          <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke={pal.accent} strokeWidth={6} />
        </g>
        {Array.from({length: blips}, (_, i) => {
          const a = random(`rb${i}`) * Math.PI * 2;
          const r = R * (0.3 + random(`rr${i}`) * 0.6);
          const appear = (i / blips) * durationMs * 0.7;
          if (ms < appear) return null;
          const on = Math.floor(ms / 250) % 2 === 0;
          return <rect key={i} x={cx + Math.cos(a) * r - 12} y={cy + Math.sin(a) * r - 12} width={24} height={24} fill={on ? pal.white : pal.accent} />;
        })}
      </svg>
      {params.label && <SmallText text={params.label} y={1160} size={22} color={pal.accent} />}
      {params.alert && ms > durationMs * 0.5 && (
        <div style={{position: 'absolute', left: 60, right: 60, top: 230, background: pal.accent, color: pal.bg, textAlign: 'center', fontFamily: FONT.hud, fontSize: 30, padding: 6}}>
          {params.alert.toUpperCase()}
        </div>
      )}
    </>
  );
};

// Inventory: what the hero has left (icons + labels appearing one by one).
export const Inventory: React.FC<SceneProps<{title?: string; items: {sprite?: string; text: string; crossed?: boolean}[]}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const colors = colorsA(pal);
  const step = (durationMs * 0.75) / Math.max(1, params.items.length);
  return (
    <>
      {params.title && (
        <div style={{position: 'absolute', left: 90, right: 90, top: 300, background: pal.accent, color: pal.bg, fontFamily: FONT.hud, fontSize: 22, textAlign: 'center', padding: 6}}>
          {params.title.toUpperCase()}
        </div>
      )}
      {params.items.map((it, i) => {
        if (ms < i * step) return null;
        const y = 400 + i * 175;
        const art = it.sprite ? SPRITES[it.sprite] : undefined;
        const strike = it.crossed ? interpolate(ms, [i * step + 250, i * step + 500], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'}) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: 90, right: 90, top: y, height: 150, border: `3px solid ${pal.mid1}`, display: 'flex', alignItems: 'center', gap: 40, padding: '0 40px'}}>
            <div style={{width: 120, height: 100, position: 'relative'}}>{art && <Sprite art={art} colors={colors} scale={9} x={0} y={10} />}</div>
            <div style={{fontFamily: FONT.caption, fontSize: 74, color: it.crossed ? pal.mid3 : pal.white, position: 'relative'}}>
              {it.text.toUpperCase()}
              {strike > 0 && <div style={{position: 'absolute', left: 0, top: 38, height: 6, width: `${strike * 100}%`, background: pal.accent}} />}
            </div>
          </div>
        );
      })}
    </>
  );
};

// Thought bubble: imagined scenario framed by a pixel cloud.
export const Thought: React.FC<SceneProps<{text?: string; value?: string; sub?: string}>> = ({params, ms}) => {
  const {pal} = useThemeA();
  return (
    <>
      <svg width={1080} height={1500} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M 160 420 Q 120 300 240 280 Q 260 180 400 200 Q 480 120 600 190 Q 740 150 800 260 Q 940 280 920 420 Q 990 520 900 620 Q 920 760 780 760 Q 700 860 560 800 Q 420 880 330 790 Q 180 800 170 680 Q 80 600 160 420 Z"
          fill={pal.bg}
          stroke={pal.white}
          strokeWidth={6}
        />
        <circle cx={150} cy={880} r={30} fill="none" stroke={pal.white} strokeWidth={6} />
        <circle cx={100} cy={970} r={18} fill="none" stroke={pal.white} strokeWidth={6} />
      </svg>
      {params.value && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', fontFamily: FONT.caption, fontSize: 170, color: pal.white}}>
          {params.value}
        </div>
      )}
      {params.text && (
        <div style={{position: 'absolute', left: 200, right: 200, top: 560, textAlign: 'center', fontFamily: FONT.hud, fontSize: 30, color: pal.accent}}>
          {params.text.toUpperCase()}
        </div>
      )}
      {params.sub && ms > 400 && <SmallText text={params.sub} y={1100} />}
    </>
  );
};

// End card: bracket frame, logo initials, brand name, language tag, issue/place/year.
export const EndCardA: React.FC<{ms: number; brandName: string; lang: string; issue: number; place: string; year: string}> = ({
  ms,
  brandName,
  lang,
  issue,
  place,
  year,
}) => {
  const {pal} = useThemeA();
  const initials = brandName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  const grow = interpolate(ms, [0, 300], [0.6, 1], {extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', inset: 0, background: pal.bg}}>
      <div style={{position: 'absolute', left: 540 - 270 * grow, top: 470, width: 540 * grow, height: 400}}>
        {[
          {l: 0, t: 0, bl: true, bt: true},
          {r: 0, t: 0, br: true, bt: true},
          {l: 0, b: 0, bl: true, bb: true},
          {r: 0, b: 0, br: true, bb: true},
        ].map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.l,
              right: c.r,
              top: c.t,
              bottom: c.b,
              width: 200,
              height: 160,
              borderLeft: c.bl ? `6px solid ${pal.accent}` : undefined,
              borderRight: c.br ? `6px solid ${pal.accent}` : undefined,
              borderTop: c.bt ? `6px solid ${pal.accent}` : undefined,
              borderBottom: c.bb ? `6px solid ${pal.accent}` : undefined,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: 0, right: 0, top: 30, textAlign: 'center', fontFamily: FONT.caption, fontSize: 170, color: pal.accent}}>{initials}</div>
        {ms > 350 && (
          <>
            <div style={{position: 'absolute', left: 0, right: 0, top: 215, textAlign: 'center', fontFamily: FONT.hud, fontSize: 38, color: pal.white, letterSpacing: 3}}>
              {brandName.toUpperCase()}
            </div>
            <div style={{position: 'absolute', left: 0, right: 0, top: 275, display: 'flex', justifyContent: 'center'}}>
              <div style={{background: pal.accent, color: pal.bg, fontFamily: FONT.hud, fontSize: 18, padding: '1px 14px'}}>{lang}</div>
            </div>
          </>
        )}
        {ms > 700 && (
          <div style={{position: 'absolute', left: 0, right: 0, top: 335, textAlign: 'center', fontFamily: FONT.hud, fontSize: 20, color: pal.mid3, letterSpacing: 3}}>
            N°{String(issue).padStart(2, '0')} &nbsp; {place.toUpperCase()} &nbsp; {year}
          </div>
        )}
      </div>
    </div>
  );
};
