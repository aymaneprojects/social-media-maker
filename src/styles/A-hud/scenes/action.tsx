import React from 'react';
import {random} from 'remotion';
import {PixelCanvas} from '../../../shared/PixelCanvas';
import {Sprite, spriteSize} from '../../../shared/pixel';
import {blendJoints, Figure, POSES, type Joints, type Outfit} from '../figure';
import {FONT} from '../../../shared/fonts';
import {colorsA, SPRITES} from '../sprites';
import {type SceneProps, useThemeA} from '../theme';
import {PinLabel} from '../ui';
import {drawTerrain, FxLayer, type Fx} from './backdrop';
import {drawStoryTerrain} from './terrains';

// Choreographed scene: a terrain (possibly wider than the screen), actors
// moving along keyframes (articulated figures or sprites), a camera, particles,
// speed lines, shakes, flashes, animated measures and labels.
// Times (`at`) are fractions of the beat duration (0 → 1).

type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'back' | 'bounce' | 'step';
type Key = {
  at: number;
  x?: number;
  y?: number;
  scale?: number;
  rot?: number;
  opacity?: number;
  flip?: boolean;
  pose?: string;
  ease?: Ease;
  arc?: number; // parabolic lift (px) between the previous key and this one
};
type Actor = {
  figure?: Outfit; // articulated character
  sprite?: string; // or a sprite from the library
  keys: Key[];
  cycle?: number; // cycles per second of the pose (run ≈ 2.6, walk ≈ 1.6)
  blend?: number; // pose cross-fade (fraction of the beat)
  shadow?: number; // ground y (world px) for a drop shadow
  trail?: number; // ghost copies behind fast motion
  glow?: boolean;
  layer?: number;
  label?: {text: string; sub?: string; from?: number; to?: number; dy?: number};
  clipBelow?: number; // world y: hide what goes below (sinking under the water line)
};
type Burst = {at: number; x: number; y: number; kind: 'dust' | 'sand' | 'splash' | 'debris' | 'spark' | 'smoke' | 'bubbles' | 'confetti' | 'impact' | 'water' | 'sonar'; n?: number; size?: number; spread?: number; dir?: number};
type CamKey = {at: number; x?: number; y?: number; zoom?: number; ease?: Ease};
type Measure = {at: number; dur?: number; x1: number; y1: number; x2: number; y2: number; label: string; sub?: string; color?: 'accent' | 'white'};

export type ActionParams = {
  terrain: string;
  worldW?: number; // terrain width in art px (default 180 = one screen)
  // terrain arguments; a [from, to] pair is animated over the beat (dig progress, water level…)
  args?: Record<string, number | string | boolean | number[]>;
  // words written on the set (graffiti, signs, chalk), revealed letter by letter
  texts?: {at: number; dur?: number; x: number; y: number; text: string; size?: number; color?: 'white' | 'accent' | 'paper' | 'dark'; rot?: number; font?: 'caption' | 'hud'; box?: boolean}[];
  actors?: Actor[];
  camera?: CamKey[];
  bursts?: Burst[];
  speedLines?: {from: number; to: number; dir?: 'left' | 'right' | 'up' | 'down'};
  shake?: {at: number; dur?: number; amp?: number}[];
  flashAt?: number[];
  fx?: Fx[];
  measures?: Measure[];
  pins?: {x: number; y: number; label: string; sub?: string; at?: number; stick?: number}[];
};

const EASE: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  back: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  bounce: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  step: (t) => (t < 1 ? 0 : 1),
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const snap = (v: number, g = 3) => Math.round(v / g) * g;

// Fill missing values of each key with those of the previous key.
const resolveKeys = (keys: Key[]) => {
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  const out: Required<Omit<Key, 'arc' | 'ease'>>[] & {arc?: number; ease?: Ease}[] = [] as never;
  let prev = {x: 540, y: 1100, scale: 6, rot: 0, opacity: 1, flip: false, pose: 'stand'};
  for (const k of sorted) {
    const cur = {...prev, ...Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined))} as typeof prev & Key;
    (out as unknown as Key[]).push(cur);
    prev = cur;
  }
  return out as unknown as (Required<Omit<Key, 'arc' | 'ease'>> & Key)[];
};

type State = {x: number; y: number; scale: number; rot: number; opacity: number; flip: boolean; pose: string; prevPose: string; poseK: number};
const actorState = (actor: Actor, p: number): State => {
  const ks = resolveKeys(actor.keys);
  if (p <= ks[0].at) return {...ks[0], prevPose: ks[0].pose, poseK: 1};
  const last = ks[ks.length - 1];
  let i = ks.findIndex((k) => k.at > p);
  if (i < 0) i = ks.length;
  const k1 = ks[Math.min(i, ks.length - 1)];
  const k0 = ks[i - 1];
  let st: Omit<State, 'prevPose' | 'poseK'>;
  if (i >= ks.length) st = last;
  else {
    const local = clamp01((p - k0.at) / Math.max(1e-6, k1.at - k0.at));
    const e = EASE[k1.ease ?? 'inOut'](local);
    const lift = k1.arc ? 4 * k1.arc * local * (1 - local) : 0;
    st = {
      x: k0.x + (k1.x - k0.x) * e,
      y: k0.y + (k1.y - k0.y) * e - lift,
      scale: k0.scale + (k1.scale - k0.scale) * e,
      rot: k0.rot + (k1.rot - k0.rot) * e,
      opacity: k0.opacity + (k1.opacity - k0.opacity) * e,
      flip: k0.flip,
      pose: k0.pose,
    };
  }
  // pose changes at a key cross-fade over `blend`
  const iPose = ks.reduce((acc, k, idx) => (k.at <= p ? idx : acc), 0);
  const prevPose = iPose > 0 ? ks[iPose - 1].pose : ks[0].pose;
  const poseK = clamp01((p - ks[iPose].at) / (actor.blend ?? 0.05));
  return {...st, pose: ks[iPose].pose, prevPose, poseK};
};

const jointsFor = (pose: string, ph: number): Joints => (POSES[pose] ?? POSES.stand)(ph);

// ---------------------------------------------------------------- particles
const PARTICLE: Record<Burst['kind'], {n: number; life: number; speed: number; up: number; g: number; size: number; colors: (pal: ReturnType<typeof useThemeA>['pal']) => string[]}> = {
  dust: {n: 14, life: 800, speed: 260, up: 160, g: 300, size: 12, colors: (p) => [p.mid2, p.mid3, p.mid1]},
  sand: {n: 22, life: 900, speed: 340, up: 420, g: 1100, size: 9, colors: (p) => [p.paper, p.mid3, p.white]},
  splash: {n: 20, life: 900, speed: 260, up: 700, g: 1600, size: 9, colors: (p) => [p.white, p.mid3, p.paper]},
  water: {n: 28, life: 1300, speed: 200, up: 900, g: 1500, size: 12, colors: (p) => [p.mid3, p.white, p.mid2]},
  debris: {n: 18, life: 1300, speed: 420, up: 500, g: 1300, size: 12, colors: (p) => [p.mid1, p.mid2, p.accent]},
  spark: {n: 16, life: 450, speed: 700, up: 200, g: 600, size: 6, colors: (p) => [p.accent, p.white, p.white]},
  smoke: {n: 10, life: 2200, speed: 60, up: 120, g: -40, size: 24, colors: (p) => [p.plum2, p.mid1, p.plum2]},
  bubbles: {n: 14, life: 1800, speed: 50, up: 260, g: -120, size: 9, colors: (p) => [p.mid3, p.white]},
  confetti: {n: 30, life: 2000, speed: 380, up: 700, g: 700, size: 9, colors: (p) => [p.accent, p.white, p.paper]},
  impact: {n: 12, life: 380, speed: 800, up: 0, g: 0, size: 6, colors: (p) => [p.white, p.accent]},
  sonar: {n: 0, life: 1600, speed: 0, up: 0, g: 0, size: 6, colors: (p) => [p.white]},
};

const Particles: React.FC<{bursts: Burst[]; ms: number; durationMs: number}> = ({bursts, ms, durationMs}) => {
  const {pal} = useThemeA();
  const out: React.ReactNode[] = [];
  bursts.forEach((b, bi) => {
    const P = PARTICLE[b.kind];
    const t0 = b.at * durationMs;
    const age = ms - t0;
    if (age < 0 || age > P.life * 1.2) return;
    const n = b.n ?? P.n;
    const cols = P.colors(pal);
    if (b.kind === 'sonar')
      for (let k = 0; k < 3; k++) {
        const a = age - k * 260;
        if (a < 0 || a > 1100) continue;
        const r = 30 + a * 0.5;
        out.push(
          <div
            key={`son${bi}-${k}`}
            style={{position: 'absolute', left: snap(b.x - r, 6), top: snap(b.y - r * 0.6, 6), width: snap(2 * r, 6), height: snap(1.2 * r, 6), border: `6px solid ${pal.accent}`, borderRadius: '50%', opacity: 0.8 * (1 - a / 1100)}}
          />,
        );
      }
    if (b.kind === 'impact' && age < 260) {
      const r = 20 + age * 0.9;
      out.push(
        <div
          key={`ring${bi}`}
          style={{position: 'absolute', left: snap(b.x - r, 6), top: snap(b.y - r, 6), width: snap(2 * r, 6), height: snap(2 * r, 6), border: `6px solid ${pal.white}`, opacity: 1 - age / 260}}
        />,
      );
    }
    for (let i = 0; i < n; i++) {
      const r = (k: string) => random(`pt-${bi}-${i}-${k}`);
      const life = P.life * (0.6 + r('l') * 0.5);
      if (age > life) continue;
      const t = age / 1000;
      const spread = (b.spread ?? 1) * Math.PI;
      const ang = (b.dir ?? -90) * (Math.PI / 180) + (r('a') - 0.5) * spread;
      const sp = P.speed * (0.3 + r('s') * 0.9);
      let vx = Math.cos(ang) * sp;
      let vy = Math.sin(ang) * sp - P.up * (0.4 + r('u') * 0.8);
      if (b.kind === 'bubbles') vx = Math.sin(t * 6 + i) * 30;
      const x = b.x + vx * t + (b.kind === 'confetti' ? Math.sin(t * 8 + i) * 20 : 0);
      const y = b.y + vy * t + 0.5 * P.g * t * t;
      const k = age / life;
      const size = (b.size ?? P.size) * (b.kind === 'smoke' ? 1 + k * 1.5 : k > 0.7 ? 0.5 : 1);
      out.push(
        <div
          key={`${bi}-${i}`}
          style={{
            position: 'absolute',
            left: snap(x - size / 2, 3),
            top: snap(y - size / 2, 3),
            width: snap(size, 3),
            height: snap(size, 3),
            background: cols[i % cols.length],
            opacity: b.kind === 'smoke' ? 0.6 * (1 - k) : 1,
            border: b.kind === 'bubbles' ? `3px solid ${pal.white}` : undefined,
            backgroundColor: b.kind === 'bubbles' ? 'transparent' : cols[i % cols.length],
          }}
        />,
      );
    }
  });
  return <>{out}</>;
};

const SpeedLines: React.FC<{dir: 'left' | 'right' | 'up' | 'down'; ms: number; k: number}> = ({dir, ms, k}) => {
  const {pal} = useThemeA();
  const lines: React.ReactNode[] = [];
  const horiz = dir === 'left' || dir === 'right';
  for (let i = 0; i < 22; i++) {
    const r = (s: string) => random(`sl-${i}-${s}`);
    const len = 120 + r('l') * 260;
    const speed = 2600 + r('v') * 1800;
    const span = (horiz ? 1080 : 1920) + len;
    const pos = (((r('o') * span + (ms / 1000) * speed) % span) + span) % span - len;
    const cross = 300 + r('c') * (horiz ? 1100 : 900) - (horiz ? 0 : 120);
    const along = dir === 'left' || dir === 'up' ? pos : span - len - pos;
    lines.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: snap(horiz ? along : cross, 6),
          top: snap(horiz ? cross : along, 6),
          width: horiz ? snap(len, 6) : 6,
          height: horiz ? 6 : snap(len, 6),
          background: i % 4 === 0 ? pal.white : pal.mid2,
          opacity: (i % 4 === 0 ? 0.55 : 0.4) * k,
        }}
      />,
    );
  }
  return <>{lines}</>;
};

const MeasureLine: React.FC<{m: Measure; ms: number; durationMs: number}> = ({m, ms, durationMs}) => {
  const {pal} = useThemeA();
  const t0 = m.at * durationMs;
  const grow = clamp01((ms - t0) / ((m.dur ?? 0.25) * durationMs));
  if (grow <= 0) return null;
  const c = m.color === 'white' ? pal.white : pal.accent;
  const x2 = m.x1 + (m.x2 - m.x1) * EASE.out(grow);
  const y2 = m.y1 + (m.y2 - m.y1) * EASE.out(grow);
  const len = Math.hypot(x2 - m.x1, y2 - m.y1);
  const ang = (Math.atan2(y2 - m.y1, x2 - m.x1) * 180) / Math.PI;
  const dashes: React.ReactNode[] = [];
  for (let d = 0; d < len; d += 30) dashes.push(<div key={d} style={{position: 'absolute', left: d, top: -3, width: Math.min(18, len - d), height: 6, background: c}} />);
  // vertical measures carry their label on the side, horizontal ones above
  const vertical = Math.abs(m.y2 - m.y1) > Math.abs(m.x2 - m.x1);
  const midX = vertical ? Math.max(m.x1, m.x2) + 40 + 140 : (m.x1 + m.x2) / 2;
  const midY = vertical ? (m.y1 + m.y2) / 2 + 60 : Math.min(m.y1, m.y2);
  return (
    <>
      <div style={{position: 'absolute', left: m.x1, top: m.y1, width: len, height: 0, transformOrigin: '0 0', transform: `rotate(${ang}deg)`}}>
        <div style={{position: 'absolute', left: -3, top: -24, width: 6, height: 48, background: c}} />
        {dashes}
        {grow >= 1 && <div style={{position: 'absolute', left: len - 3, top: -24, width: 6, height: 48, background: c}} />}
      </div>
      {grow >= 1 && (
        <div
          style={{
            position: 'absolute',
            left: midX,
            top: midY - 120,
            transform: 'translateX(-50%)',
            background: c,
            color: pal.bg,
            padding: '6px 18px 2px',
            fontFamily: FONT.caption,
            fontSize: 64,
            lineHeight: '64px',
            whiteSpace: 'nowrap',
          }}
        >
          {m.label.toUpperCase()}
          {m.sub && <div style={{fontFamily: FONT.hud, fontSize: 16, lineHeight: '22px', textAlign: 'center'}}>{m.sub.toUpperCase()}</div>}
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------- scene
export const Action: React.FC<SceneProps<ActionParams>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const colors = colorsA(pal);
  const p = clamp01(ms / durationMs);
  const t = ms / 1000;
  const worldW = params.worldW ?? 180;
  const tStep = Math.floor(t * 8) / 8;

  // camera: focus point (world px) shown at the screen centre
  let cam = {x: (worldW * 6) / 2, y: 960, zoom: 1};
  if (params.camera?.length) {
    const ks = [...params.camera].sort((a, b) => a.at - b.at);
    const full = ks.reduce<{at: number; x: number; y: number; zoom: number; ease?: Ease}[]>((acc, k) => {
      const prev = acc[acc.length - 1] ?? {at: 0, ...cam};
      acc.push({...prev, ...Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined))} as never);
      return acc;
    }, []);
    if (p <= full[0].at) cam = full[0];
    else {
      const i = full.findIndex((k) => k.at > p);
      if (i < 0) cam = full[full.length - 1];
      else {
        const a = full[i - 1];
        const b = full[i];
        const e = EASE[b.ease ?? 'inOut'](clamp01((p - a.at) / Math.max(1e-6, b.at - a.at)));
        cam = {x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, zoom: a.zoom + (b.zoom - a.zoom) * e};
      }
    }
  }
  // shakes
  let sx = 0;
  let sy = 0;
  for (const s of params.shake ?? []) {
    const age = ms - s.at * durationMs;
    const dur = s.dur ?? 420;
    if (age >= 0 && age < dur) {
      const amp = (s.amp ?? 24) * (1 - age / dur);
      sx += (random(`shx-${Math.floor(age / 33)}`) - 0.5) * 2 * amp;
      sy += (random(`shy-${Math.floor(age / 33)}`) - 0.5) * 2 * amp;
    }
  }
  // never show outside the set
  const halfW = 540 / cam.zoom;
  const halfH = 960 / cam.zoom;
  cam.x = Math.max(halfW, Math.min(worldW * 6 - halfW, cam.x));
  cam.y = Math.max(halfH, Math.min(1920 - halfH, cam.y));
  const tx = snap(540 - cam.x * cam.zoom + sx, 6);
  const ty = snap(960 - cam.y * cam.zoom + sy, 6);
  const onRight = (wx: number) => tx + wx * cam.zoom > 620;

  const actors = (params.actors ?? []).map((a, i) => ({a, i})).sort((u, v) => (u.a.layer ?? 0) - (v.a.layer ?? 0));
  const renderActor = (a: Actor, i: number, at: number, ghost = 1) => {
    const st = actorState(a, clamp01(at / durationMs));
    const ph = (((at / 1000) * (a.cycle ?? 1.6)) % 1 + 1) % 1;
    const op = st.opacity * ghost;
    if (op <= 0.01) return null;
    if (a.figure) {
      const j = st.poseK < 1 ? blendJoints(jointsFor(st.prevPose, ph), jointsFor(st.pose, ph), st.poseK) : jointsFor(st.pose, ph);
      return <Figure key={`${i}-${ghost}`} joints={j} outfit={a.figure} pal={pal} x={st.x} y={st.y} scale={Math.round(st.scale)} flip={st.flip} rot={st.rot} opacity={op} />;
    }
    const art = SPRITES[st.pose !== 'stand' && SPRITES[st.pose] ? st.pose : a.sprite ?? ''];
    if (!art) return null;
    const {w, h} = spriteSize(art);
    const sc = Math.round(st.scale);
    return (
      <Sprite
        key={`${i}-${ghost}`}
        art={art}
        colors={colors}
        scale={sc}
        x={snap(st.x - (w * sc) / 2)}
        y={snap(st.y - h * sc)}
        opacity={op}
        style={{transformOrigin: '50% 100%', transform: `${st.flip ? 'scaleX(-1) ' : ''}rotate(${st.rot}deg)`}}
      />
    );
  };

  const flash = (params.flashAt ?? []).reduce((acc, f) => {
    const age = ms - f * durationMs;
    return age >= 0 && age < 160 ? Math.max(acc, 1 - age / 160) : acc;
  }, 0);
  const pq = Math.round(p * 60) / 60;
  const args: Record<string, number | string | boolean> = {};
  // [from, to] animates over the beat, [from, to, at0, at1] between two moments
  for (const [k, v] of Object.entries(params.args ?? {})) {
    if (!Array.isArray(v)) args[k] = v;
    else {
      const [a, b, at0 = 0, at1 = 1] = v as number[];
      args[k] = a + (b - a) * EASE.inOut(clamp01((pq - at0) / Math.max(1e-6, at1 - at0)));
    }
  }
  const lines = params.speedLines && p >= params.speedLines.from && p <= params.speedLines.to ? Math.min(1, (p - params.speedLines.from) * 20, (params.speedLines.to - p) * 20) : 0;

  return (
    <>
      {/* CSS zoom (not transform: scale) so canvases are re-rasterised at the final size and stay pixel-crisp */}
      <div style={{position: 'absolute', left: tx / cam.zoom, top: ty / cam.zoom, width: worldW * 6, height: 1920, zoom: cam.zoom}}>
        <PixelCanvas
          w={worldW}
          h={320}
          scale={6}
          deps={[params.terrain, worldW, tStep, pal, JSON.stringify(args)]}
          draw={(ctx) => {
            if (!drawStoryTerrain(ctx, params.terrain, tStep, pal, worldW, 320, `act-${params.terrain}`, args)) drawTerrain(ctx, params.terrain, tStep, pal, params.terrain);
          }}
          style={{left: 0, top: 0}}
        />
        {/* drop shadows */}
        {actors.map(({a, i}) => {
          if (a.shadow === undefined) return null;
          const st = actorState(a, p);
          const lift = Math.max(0, a.shadow - st.y);
          const wS = Math.max(24, (st.scale * 14 - lift * 0.12) | 0);
          return <div key={`sh${i}`} style={{position: 'absolute', left: snap(st.x - wS / 2, 6), top: snap(a.shadow - 6, 6), width: snap(wS, 6), height: 12, background: pal.bg, opacity: Math.max(0.25, 0.75 - lift / 600)}} />;
        })}
        {/* motion trails then actors */}
        {actors.map(({a, i}) =>
          a.trail ? Array.from({length: a.trail}, (_, k) => renderActor(a, i, ms - (k + 1) * 45, 0.35 / (k + 1))) : null,
        )}
        {actors.map(({a, i}) => (
          <React.Fragment key={`a${i}`}>
            {a.glow && (() => {
              const st = actorState(a, p);
              return <div style={{position: 'absolute', left: st.x - 150, top: st.y - 260, width: 300, height: 300, background: `radial-gradient(circle, ${pal.accent} 0%, transparent 65%)`, opacity: 0.35 + Math.sin(ms / 180) * 0.1}} />;
            })()}
            {a.clipBelow !== undefined ? (
              <div style={{position: 'absolute', inset: 0, clipPath: `inset(0px 0px ${1920 - a.clipBelow}px 0px)`}}>{renderActor(a, i, ms)}</div>
            ) : (
              renderActor(a, i, ms)
            )}
          </React.Fragment>
        ))}
        {(params.texts ?? []).map((tx0, i) => {
          const k = clamp01((p - tx0.at) / (tx0.dur ?? 0.3));
          if (k <= 0) return null;
          const n = Math.ceil(tx0.text.length * k);
          const color = tx0.color === 'accent' ? pal.accent : tx0.color === 'paper' ? pal.paper : tx0.color === 'dark' ? pal.bg : pal.white;
          return (
            <div
              key={`tx${i}`}
              style={{
                position: 'absolute',
                left: tx0.x,
                top: tx0.y,
                transform: `translateX(-50%) rotate(${tx0.rot ?? 0}deg)`,
                fontFamily: tx0.font === 'hud' ? FONT.hud : FONT.caption,
                fontSize: tx0.size ?? 72,
                lineHeight: `${(tx0.size ?? 72) * 1.05}px`,
                color,
                whiteSpace: 'pre',
                textAlign: 'center',
                textShadow: `4px 4px 0 ${pal.bg}`,
                ...(tx0.box ? {background: pal.bg, border: `6px solid ${color}`, padding: '10px 26px 4px', boxShadow: `12px 12px 0 ${pal.black}`} : {}),
              }}
            >
              {tx0.text.slice(0, n)}
            </div>
          );
        })}
        <Particles bursts={params.bursts ?? []} ms={ms} durationMs={durationMs} />
        {(params.measures ?? []).map((m, i) => (
          <MeasureLine key={i} m={m} ms={ms} durationMs={durationMs} />
        ))}
        {(params.pins ?? []).map((pin, i) => {
          const v = clamp01((ms - (pin.at ?? 0.2) * durationMs) / 300);
          return <PinLabel key={i} x={pin.x} y={pin.y} title={pin.label} sub={pin.sub} visible={v} left={onRight(pin.x)} stick={pin.stick} />;
        })}
        {actors.map(({a, i}) => {
          if (!a.label) return null;
          if (p < (a.label.from ?? 0) || p > (a.label.to ?? 1)) return null;
          const st = actorState(a, p);
          const v = clamp01((p - (a.label.from ?? 0)) * durationMs / 300);
          // keep the label under the HUD (screen y >= 330)
          const ly = Math.max(st.y - (a.label.dy ?? 300), (330 - ty) / cam.zoom + 66);
          return <PinLabel key={`l${i}`} x={st.x} y={ly} title={a.label.text} sub={a.label.sub} visible={v} left={onRight(st.x)} />;
        })}
      </div>
      {lines > 0 && <SpeedLines dir={params.speedLines!.dir ?? 'left'} ms={ms} k={lines} />}
      <FxLayer fx={params.fx ?? []} ms={ms} seed={`act-${params.terrain}`} />
      {flash > 0 && <div style={{position: 'absolute', inset: 0, background: pal.white, opacity: flash * 0.85}} />}
    </>
  );
};
