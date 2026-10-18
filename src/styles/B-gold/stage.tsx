import React from 'react';
import {Easing, Img, random, spring, staticFile} from 'remotion';
import {FONT} from '../../shared/fonts';
import {FPS} from '../../shared/schema';
import {useThemeB} from './theme';
import {Label, PixelTitle, popAt, StampB, Tag} from './ui';

// "Stage": layered illustrations animated with the vocabulary observed in the
// reference videos (hand entering from an edge, pose swaps, impacts…).
// Times (`at`, `dur`, `every`) are in seconds from the start of the beat.

export type Act =
  | {do: 'pop'; at?: number}
  | {do: 'enter'; from: 'left' | 'right' | 'top' | 'bottom'; at?: number; dur?: number}
  | {do: 'exit'; to: 'left' | 'right' | 'top' | 'bottom'; at: number; dur?: number}
  | {do: 'move'; x?: number; y?: number; at: number; dur?: number}
  | {do: 'poses'; seq: string[]; at: number; every?: number}
  | {do: 'pose'; name: string; at: number}
  | {do: 'hit'; at: number}
  | {do: 'shake'; at: number; dur?: number}
  | {do: 'grow'; to: number; at: number; dur?: number}
  | {do: 'fade'; to: number; at: number; dur?: number}
  | {do: 'spin'; at: number; dur?: number; turns?: number}
  | {do: 'float'};

export type Layer = {
  id: string;
  asset: string;
  pose?: string;
  x?: number; // screen px, centre of the layer (or bottom centre with anchor 'bottom')
  y?: number;
  h?: number; // display height in screen px (snapped to a whole pixel size)
  z?: number;
  flip?: boolean;
  anchor?: 'center' | 'bottom';
  acts?: Act[];
};

export type StageScene = {
  type: 'stage';
  keep?: boolean; // continue the previous stage (same layers, same positions)
  drop?: string[]; // ids of kept layers to remove
  layers?: Layer[];
  title?: {text: string; color?: 'gold' | 'red' | 'green' | 'cream' | 'accent'; at?: number; y?: number};
  sub?: {text: string; at?: number; y?: number};
  tags?: {text: string; x: number; y: number; at?: number}[];
  stamp?: {text: string; color?: 'red' | 'green' | 'gold'; at?: number; x?: number; y?: number};
  thought?: {text: string; x?: number; y?: number; at?: number};
  sparkles?: {x: number; y: number; at: number}[];
  flashes?: {x: number; y: number; at: number}[]; // camera flashes
  counter?: {from: number; to: number; suffix?: string; label?: string; y?: number; color?: 'gold' | 'red' | 'cream'};
};

export type LayerState = {x: number; y: number; scale: number; opacity: number; rot: number; pose: string; dx: number; dy: number};

export type AssetMap = Record<string, {poses: Record<string, {file: string; w: number; h: number}>}>;

const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// State of a layer at time t (s). `base` = end state inherited from the previous beat.
export const layerState = (L: Layer, t: number, base?: LayerState): LayerState => {
  const st: LayerState = {
    x: L.x ?? base?.x ?? 540,
    y: L.y ?? base?.y ?? 900,
    scale: base?.scale ?? 1,
    opacity: base?.opacity ?? 1,
    rot: base?.rot ?? 0,
    pose: L.pose ?? base?.pose ?? 'base',
    dx: 0,
    dy: 0,
  };
  const acts = [...(L.acts ?? [])].sort((a, b) => ('at' in a ? (a.at ?? 0) : 0) - ('at' in b ? (b.at ?? 0) : 0));
  for (const a of acts) {
    switch (a.do) {
      case 'pop': {
        const at = a.at ?? 0;
        if (t < at) st.opacity = 0;
        else st.scale *= spring({frame: (t - at) * FPS, fps: FPS, config: {damping: 11, stiffness: 170, mass: 0.6}});
        break;
      }
      case 'enter': {
        const at = a.at ?? 0;
        const dur = a.dur ?? 0.45;
        const p = easeOut(clamp01((t - at) / dur));
        const off = {left: [-900, 0], right: [900, 0], top: [0, -1300], bottom: [0, 1300]}[a.from];
        st.dx += off[0] * (1 - p);
        st.dy += off[1] * (1 - p);
        break;
      }
      case 'exit': {
        const dur = a.dur ?? 0.45;
        const p = Easing.in(Easing.cubic)(clamp01((t - a.at) / dur));
        const off = {left: [-900, 0], right: [900, 0], top: [0, -1300], bottom: [0, 1300]}[a.to];
        st.dx += off[0] * p;
        st.dy += off[1] * p;
        break;
      }
      case 'move': {
        const dur = a.dur ?? 0.5;
        const p = easeInOut(clamp01((t - a.at) / dur));
        if (a.x !== undefined) st.x = st.x + (a.x - st.x) * p;
        if (a.y !== undefined) st.y = st.y + (a.y - st.y) * p;
        break;
      }
      case 'poses': {
        if (t >= a.at) {
          const every = a.every ?? 0.18;
          st.pose = a.seq[Math.min(a.seq.length - 1, Math.floor((t - a.at) / every))];
        }
        break;
      }
      case 'pose':
        if (t >= a.at) st.pose = a.name;
        break;
      case 'shake':
      case 'hit': {
        const dur = a.do === 'hit' ? 0.25 : (a.dur ?? 0.35);
        if (t >= a.at && t < a.at + dur) {
          const f = Math.floor(t * FPS);
          st.dx += (random(`sx${f}`) - 0.5) * 24;
          st.dy += (random(`sy${f}`) - 0.5) * 16;
        }
        break;
      }
      case 'grow': {
        const p = easeInOut(clamp01((t - a.at) / (a.dur ?? 0.5)));
        st.scale *= 1 + (a.to - 1) * p;
        break;
      }
      case 'fade': {
        const p = clamp01((t - a.at) / (a.dur ?? 0.3));
        st.opacity = st.opacity + (a.to - st.opacity) * p;
        break;
      }
      case 'spin': {
        const p = easeInOut(clamp01((t - a.at) / (a.dur ?? 0.6)));
        st.rot += 360 * (a.turns ?? 1) * p;
        break;
      }
      case 'float':
        st.dy += Math.round(Math.sin(t * 2.2) * 2) * 6;
        break;
    }
  }
  return st;
};

// Final positions at the end of a beat, used when the next beat keeps the stage.
export const endStates = (layers: Layer[], durS: number, bases: Record<string, LayerState>) => {
  const out: Record<string, LayerState> = {};
  layers.forEach((L) => {
    const s = layerState(L, durS, bases[L.id]);
    out[L.id] = {...s, x: s.x + s.dx, y: s.y + s.dy, dx: 0, dy: 0, scale: s.scale, opacity: s.opacity};
  });
  return out;
};

// Snap the display size to a whole number of screen pixels per art pixel.
const pixelSize = (artH: number, h: number) => Math.max(2, Math.round(h / artH));

const LayerView: React.FC<{L: Layer; st: LayerState; assets: AssetMap; base: string}> = ({L, st, assets, base}) => {
  const a = assets[L.asset];
  const pose = a?.poses[st.pose] ?? a?.poses.base;
  if (!pose || st.opacity <= 0) return null;
  const px = pixelSize(pose.h, L.h ?? 600);
  const w = pose.w * px;
  const h = pose.h * px;
  const left = st.x + st.dx - w / 2;
  const top = (L.anchor === 'bottom' ? st.y - h : st.y - h / 2) + st.dy;
  return (
    <Img
      src={staticFile(`${base}assets/${pose.file}`)}
      style={{
        position: 'absolute',
        left: Math.round(left / px) * px,
        top: Math.round(top / px) * px,
        width: w,
        height: h,
        imageRendering: 'pixelated',
        opacity: st.opacity,
        transform: `${L.flip ? 'scaleX(-1) ' : ''}scale(${st.scale}) rotate(${st.rot}deg)`,
        transformOrigin: L.anchor === 'bottom' ? '50% 100%' : '50% 50%',
        zIndex: L.z ?? 1,
      }}
    />
  );
};

// Impact: brief light-grey flash + debris flying out of the hit point.
const Impact: React.FC<{t: number; at: number; x: number; y: number}> = ({t, at, x, y}) => {
  const {pal} = useThemeB();
  const k = t - at;
  if (k < 0 || k > 0.8) return null;
  return (
    <>
      {k < 0.12 && <div style={{position: 'absolute', inset: 0, background: '#9C9890', opacity: 0.35}} />}
      {Array.from({length: 14}, (_, i) => {
        const ang = random(`deb${at}${i}`) * Math.PI * 2;
        const v = 500 + random(`dv${at}${i}`) * 700;
        const dx = Math.cos(ang) * v * k;
        const dy = Math.sin(ang) * v * k + 1400 * k * k;
        const s = 6 + Math.floor(random(`ds${at}${i}`) * 3) * 6;
        return (
          <div key={i} style={{position: 'absolute', left: x + dx, top: y + dy, width: s, height: s, background: i % 3 ? pal.cream : pal.gold, opacity: 1 - k / 0.8}} />
        );
      })}
    </>
  );
};

const Sparkles: React.FC<{t: number; at: number; x: number; y: number}> = ({t, at, x, y}) => {
  const {pal} = useThemeB();
  const k = t - at;
  if (k < 0 || k > 1.2) return null;
  return (
    <>
      {Array.from({length: 18}, (_, i) => {
        const ang = (i / 18) * Math.PI * 2 + random(`sp${at}${i}`) * 0.3;
        const r = 60 + easeOut(clamp01(k / 0.8)) * (180 + random(`sr${at}${i}`) * 120);
        const big = i % 4 === 0;
        const on = Math.sin(k * 20 + i) > -0.4;
        if (!on) return null;
        return (
          <div key={i} style={{position: 'absolute', left: x + Math.cos(ang) * r, top: y + Math.sin(ang) * r * 0.6, opacity: 1 - k / 1.2}}>
            <div style={{position: 'absolute', left: big ? -9 : -3, top: -3, width: big ? 24 : 6, height: 6, background: pal.cream}} />
            {big && <div style={{position: 'absolute', left: 0, top: -12, width: 6, height: 24, background: pal.cream}} />}
          </div>
        );
      })}
    </>
  );
};

const CameraFlash: React.FC<{t: number; at: number; x: number; y: number}> = ({t, at, x, y}) => {
  const k = t - at;
  if (k < 0 || k > 0.35) return null;
  return (
    <>
      {k < 0.08 && <div style={{position: 'absolute', inset: 0, background: '#FFFFFF', opacity: 0.18}} />}
      <div
        style={{
          position: 'absolute',
          left: x - 60,
          top: y - 60,
          width: 120,
          height: 120,
          background: 'radial-gradient(circle, #FFFFFF 0%, #FFF3C4 25%, transparent 60%)',
          opacity: 1 - k / 0.35,
        }}
      />
    </>
  );
};

// Dashed golden thought cloud with a value inside ("1 000 000 $").
const Thought: React.FC<{text: string; x: number; y: number; t: number; at: number}> = ({text, x, y, t, at}) => {
  const {pal} = useThemeB();
  if (t < at) return null;
  const s = popAt((t - at) * 1000);
  const w = Math.min(1040, Math.max(520, text.length * 52 + 220));
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: y - 110, width: w, height: 220, transform: `scale(${s})`}}>
      <svg width={w} height={220} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: 7}, (_, i) => (
          <circle key={`t${i}`} cx={70 + ((w - 140) * i) / 6} cy={62} r={52} fill="#000" stroke={pal.gold} strokeWidth={8} />
        ))}
        {Array.from({length: 7}, (_, i) => (
          <circle key={`b${i}`} cx={70 + ((w - 140) * i) / 6} cy={158} r={52} fill="#000" stroke={pal.gold} strokeWidth={8} />
        ))}
        <rect x={60} y={50} width={w - 120} height={120} fill="#000" />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 80, textAlign: 'center', fontFamily: FONT.bLabel, fontSize: 40, color: pal.cream, letterSpacing: 4}}>
        {text}
      </div>
    </div>
  );
};

export const fmtB = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const Stage: React.FC<{
  scene: StageScene;
  layers: Layer[];
  bases: Record<string, LayerState>;
  ms: number;
  durationMs: number;
  assets: AssetMap;
  assetsBase: string;
}> = ({scene, layers, bases, ms, durationMs, assets, assetsBase}) => {
  const {pal} = useThemeB();
  const t = ms / 1000;
  const states = layers.map((L) => ({L, st: layerState(L, t, bases[L.id])}));
  // screen shake from any 'hit' on any layer
  let shakeX = 0;
  let shakeY = 0;
  const hits: {at: number; x: number; y: number}[] = [];
  states.forEach(({L, st}) =>
    (L.acts ?? []).forEach((a) => {
      if (a.do === 'hit') {
        hits.push({at: a.at, x: st.x + st.dx, y: st.y + st.dy});
        if (t >= a.at && t < a.at + 0.2) {
          const f = Math.floor(t * FPS);
          shakeX += (random(`hx${f}`) - 0.5) * 18;
          shakeY += (random(`hy${f}`) - 0.5) * 12;
        }
      }
    }),
  );
  const main = states[0];
  const glowX = main ? main.st.x + main.st.dx : 540;
  const glowY = main ? main.st.y + main.st.dy - (main.L.anchor === 'bottom' ? (main.L.h ?? 600) / 2 : 0) : 900;
  const counterP = scene.counter ? easeOut(clamp01(ms / (durationMs * 0.7))) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translate(${Math.round(shakeX / 6) * 6}px, ${Math.round(shakeY / 6) * 6}px)`}}>
      <div
        style={{
          position: 'absolute',
          left: glowX - 520,
          top: glowY - 520,
          width: 1040,
          height: 1040,
          background: `radial-gradient(circle, ${pal.halo} 0%, rgba(0,0,0,0) 65%)`,
        }}
      />
      {[...states]
        .sort((a, b) => (a.L.z ?? 1) - (b.L.z ?? 1))
        .map(({L, st}) => (
          <LayerView key={L.id} L={L} st={st} assets={assets} base={assetsBase} />
        ))}
      <div style={{position: 'absolute', inset: 0, zIndex: 20}}>
        {hits.map((h, i) => (
          <Impact key={`h${i}`} t={t} at={h.at} x={h.x} y={h.y} />
        ))}
        {(scene.sparkles ?? []).map((s, i) => (
          <Sparkles key={`s${i}`} t={t} at={s.at} x={s.x} y={s.y} />
        ))}
        {(scene.flashes ?? []).map((s, i) => (
          <CameraFlash key={`f${i}`} t={t} at={s.at} x={s.x} y={s.y} />
        ))}
        {scene.thought && <Thought text={scene.thought.text} x={scene.thought.x ?? 540} y={scene.thought.y ?? 420} t={t} at={scene.thought.at ?? 0} />}
        {scene.title && t >= (scene.title.at ?? 0) && (
          <PixelTitle
            text={scene.title.text.toUpperCase()}
            y={scene.title.y ?? 200}
            size={96}
            color={scene.title.color ?? 'accent'}
            scaleIn={popAt((t - (scene.title.at ?? 0)) * 1000)}
          />
        )}
        {scene.sub && t >= (scene.sub.at ?? 0) && <Label text={scene.sub.text} y={scene.sub.y ?? 340} size={28} />}
        {(scene.tags ?? []).map((g, i) =>
          t >= (g.at ?? 0) ? <Tag key={`g${i}`} text={g.text} x={g.x} y={g.y} size={20} pop={popAt((t - (g.at ?? 0)) * 1000)} /> : null,
        )}
        {scene.stamp && (
          <StampB
            text={scene.stamp.text}
            color={scene.stamp.color}
            x={scene.stamp.x ?? 540}
            y={scene.stamp.y ?? 1000}
            ms={ms}
            delayMs={(scene.stamp.at ?? durationMs / 2000) * 1000}
            size={80}
          />
        )}
        {scene.counter && (
          <>
            <Label
              text={`${fmtB(scene.counter.from + (scene.counter.to - scene.counter.from) * counterP)}${scene.counter.suffix ? ` ${scene.counter.suffix}` : ''}`}
              y={scene.counter.y ?? 230}
              size={68}
              color={scene.counter.color === 'red' ? pal.red : scene.counter.color === 'cream' ? pal.cream : pal.gold}
            />
            {scene.counter.label && <Label text={scene.counter.label} y={(scene.counter.y ?? 230) + 110} size={24} />}
          </>
        )}
      </div>
    </div>
  );
};

// Resolve the layers of a stage beat, following `keep` chains backwards.
export const resolveStage = (beats: {scene: unknown; startMs: number; endMs: number}[], index: number): {layers: Layer[]; bases: Record<string, LayerState>} => {
  const sc = beats[index].scene as StageScene;
  if (sc.type !== 'stage') return {layers: [], bases: {}};
  if (!sc.keep || index === 0 || (beats[index - 1].scene as StageScene).type !== 'stage') return {layers: sc.layers ?? [], bases: {}};
  const prev = resolveStage(beats, index - 1);
  const prevDur = (beats[index - 1].endMs - beats[index - 1].startMs) / 1000;
  const ends = endStates(prev.layers, prevDur, prev.bases);
  const byId = new Map<string, Layer>();
  prev.layers.forEach((L) => {
    if (!(sc.drop ?? []).includes(L.id)) byId.set(L.id, {...L, x: undefined, y: undefined, acts: [], pose: undefined});
  });
  (sc.layers ?? []).forEach((L) => byId.set(L.id, {...(byId.get(L.id) ?? {}), ...L}));
  const bases: Record<string, LayerState> = {};
  byId.forEach((_, id) => {
    if (ends[id]) bases[id] = ends[id];
  });
  return {layers: Array.from(byId.values()), bases};
};
