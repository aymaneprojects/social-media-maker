import React from 'react';
import {Img, interpolate, random, staticFile} from 'remotion';
import {PixelCanvas, ditherFill} from '../../../shared/PixelCanvas';
import {Sprite, spriteSize} from '../../../shared/pixel';
import {colorsA, SPRITES} from '../sprites';
import {type SceneProps, useThemeA} from '../theme';
import {PinLabel} from '../ui';

const W = 180;
const H = 320;
const S = 6;

type SpritePlacement = {
  sprite: string;
  x: number; // centre, screen px
  y: number;
  scale?: number;
  bob?: boolean; // floats on water / in air
  driftX?: number; // px per second
  flipX?: boolean;
  tilt?: number; // degrees
  fall?: number; // px per second downward
  glow?: boolean; // red/accent light halo
};

export type Fx = 'rain' | 'lightning' | 'fireflies' | 'bubbles' | 'mist' | 'stars' | 'embers' | 'snow';

// ---------------------------------------------------------------- terrains
// Cumulus made of puffs: light colour first, body shifted down-right on top
// (leaves a lit rim), then a flat base.
const cloud = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, body: string, light: string) => {
  const puffs = [
    [-1.3, 0.25, 0.6],
    [-0.55, -0.25, 0.9],
    [0.35, -0.45, 1],
    [1.2, 0.1, 0.7],
    [0.4, 0.3, 0.75],
  ];
  ctx.fillStyle = light;
  for (const [dx, dy, k] of puffs) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy + dy * r, k * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = body;
  for (const [dx, dy, k] of puffs) {
    ctx.beginPath();
    ctx.arc(cx + dx * r + 1.5, cy + dy * r + 2, k * r - 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(cx - 1.9 * r, cy + 0.35 * r, 3.8 * r, 0.5 * r);
};
// Pixel landscapes drawn on a 180x320 canvas.
const drawTerrain = (ctx: CanvasRenderingContext2D, kind: string, t: number, pal: ReturnType<typeof useThemeA>['pal'], seed: string) => {
  const rnd = (k: string) => random(`${seed}-${k}`);
  const sky = (top: string, bottom: string, horizon: number) => {
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H);
    ditherFill(ctx, 0, 0, W, horizon, bottom, (_x, y) => (y / horizon) * 0.9);
  };
  switch (kind) {
    case 'storm':
    case 'sky': {
      const storm = kind === 'storm';
      sky(pal.bg, storm ? pal.plum : pal.plum2, 260);
      // two parallax layers of cumulus: lit rim on the upper left, flat base
      const layers = storm ? [{n: 7, y: 60, s: 16, sp: 3}, {n: 6, y: 170, s: 24, sp: 7}] : [{n: 6, y: 80, s: 14, sp: 2}, {n: 5, y: 210, s: 22, sp: 5}];
      layers.forEach((L, li) => {
        for (let i = 0; i < L.n; i++) {
          const span = W + 120;
          const cx = (((rnd(`c${li}${i}`) * span + t * L.sp) % span) + span) % span - 60;
          const cy = L.y + (rnd(`cy${li}${i}`) - 0.5) * 70;
          const r = L.s * (0.7 + rnd(`cr${li}${i}`) * 0.6);
          cloud(ctx, cx, cy, r, li === 0 ? pal.plum2 : storm ? pal.plum2 : pal.mid1, li === 0 ? pal.mid1 : pal.mid2);
        }
      });
      break;
    }
    case 'jungle': {
      sky(pal.bg, pal.plum, 150);
      // far -> near: lighter & smaller crowns far away, dark big crowns close
      const layers = [
        {y: 140, c: pal.mid1, rim: pal.mid2, r: 9, n: 24, sp: 0.6},
        {y: 185, c: pal.plum2, rim: pal.mid1, r: 14, n: 16, sp: 1.2},
        {y: 245, c: pal.plum, rim: pal.plum2, r: 20, n: 11, sp: 2},
      ];
      layers.forEach((L, li) => {
        const off = (t * L.sp) % (W / L.n);
        ctx.fillStyle = L.c;
        ctx.fillRect(0, L.y, W, H - L.y);
        for (let i = -1; i <= L.n; i++) {
          const cx = (i / (L.n - 1)) * W + (rnd(`jx${li}${i}`) - 0.5) * 8 - off;
          const cy = L.y - rnd(`jy${li}${i}`) * L.r * 0.8;
          const r = L.r * (0.75 + rnd(`jr${li}${i}`) * 0.5);
          // rim light then body (pixel-art shading)
          ctx.fillStyle = L.rim;
          ctx.beginPath();
          ctx.arc(cx - 1, cy - 1, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = L.c;
          ctx.beginPath();
          ctx.arc(cx + 1, cy + 1, r - 1, 0, Math.PI * 2);
          ctx.fill();
        }
        // trunks & lianas between layers
        ctx.fillStyle = li === 2 ? pal.bg : pal.plum;
        for (let i = 0; i < 6 + li * 2; i++) {
          const x = Math.round(rnd(`tr${li}${i}`) * W - off);
          ctx.fillRect(x, L.y + 4, li + 1, H - L.y);
        }
      });
      ditherFill(ctx, 0, 250, W, H - 250, pal.bg, (_x, y) => (y - 250) / 90);
      break;
    }
    case 'river': {
      sky(pal.bg, pal.plum, 90);
      // dark banks
      ctx.fillStyle = pal.plum;
      ctx.fillRect(0, 90, W, H - 90);
      ditherFill(ctx, 0, 90, W, H - 90, pal.plum2, (x, y) => (rnd(`rv${x >> 3}${y >> 3}`) > 0.55 ? 0.5 : 0));
      // winding river, widening towards the viewer, with moving glints
      for (let y = 90; y < H; y++) {
        const cx = W / 2 + Math.sin(y / 34 + 0.6) * (20 + (y - 90) * 0.12);
        const half = 6 + (y - 90) * 0.16;
        ctx.fillStyle = pal.mid1;
        ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1);
        if (y % 4 === 0) {
          ctx.fillStyle = pal.mid3;
          const gx = cx - half + ((((y * 7 + t * 9) % (half * 2)) + half * 2) % (half * 2));
          ctx.fillRect(Math.round(gx), y, 3, 1);
        }
      }
      // crowns along the banks
      for (let i = 0; i < 18; i++) {
        const side = i % 2 ? 1 : -1;
        const y = 100 + i * 12;
        const cx = W / 2 + side * (60 + (y - 90) * 0.35) + (rnd(`bk${i}`) - 0.5) * 20;
        const r = 10 + (y - 90) * 0.06;
        ctx.fillStyle = pal.mid1;
        ctx.beginPath();
        ctx.arc(cx - 1, y - 1, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.plum2;
        ctx.beginPath();
        ctx.arc(cx + 1, y + 1, r - 1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'sea': {
      sky(pal.bg, pal.plum2, 170);
      ctx.fillStyle = pal.plum;
      ctx.fillRect(0, 170, W, H - 170);
      for (let y = 172; y < H; y += 5) {
        for (let x = 0; x < W; x++) {
          const wave = Math.sin(x / 6 + y + t * 2) > 0.85;
          if (wave) {
            ctx.fillStyle = y < 200 ? pal.mid2 : pal.mid1;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      break;
    }
    case 'underwater': {
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, W, H);
      ditherFill(ctx, 0, 0, W, 160, pal.plum, (_x, y) => 1 - y / 160);
      // light rays
      for (let i = 0; i < 5; i++) {
        const x0 = 20 + i * 36 + Math.sin(t + i) * 4;
        ditherFill(ctx, Math.round(x0), 0, 10, 220, pal.plum2, (_x, y) => 0.5 - y / 440);
      }
      break;
    }
    case 'city': {
      sky(pal.bg, pal.plum, 160);
      for (let i = 0; i < 24; i++) {
        const bw = 8 + Math.floor(rnd(`bw${i}`) * 12);
        const bh = 40 + Math.floor(rnd(`bh${i}`) * 90);
        const bx = Math.floor(i * 8 - 4);
        ctx.fillStyle = i % 2 ? pal.plum2 : pal.plum;
        ctx.fillRect(bx, 230 - bh, bw, bh + 90);
        for (let wy = 230 - bh + 4; wy < 300; wy += 6) {
          for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) {
            const on = rnd(`w${i}-${wx}-${wy}`) > 0.72;
            if (on) {
              ctx.fillStyle = rnd(`wc${wx}${wy}`) > 0.8 ? pal.paper : pal.accent;
              ctx.fillRect(wx, wy, 2, 2);
            }
          }
        }
      }
      break;
    }
    case 'desert': {
      sky(pal.bg, pal.plum2, 190);
      ctx.fillStyle = pal.mid1;
      for (let x = 0; x < W; x++) {
        const h = 190 + Math.sin(x / 22 + t * 0.1) * 8 + Math.sin(x / 9) * 3;
        ctx.fillRect(x, Math.round(h), 1, H);
      }
      ditherFill(ctx, 0, 180, W, 140, pal.mid2, (x, y) => (Math.sin(x / 22) > 0.3 && y < 230 ? 0.4 : 0.1));
      break;
    }
    case 'room': {
      ctx.fillStyle = pal.plum;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = pal.plum2;
      ctx.fillRect(0, 230, W, H - 230);
      ditherFill(ctx, 0, 0, W, 230, pal.bg, (x) => Math.abs(x - W / 2) / (W / 2));
      break;
    }
    default: {
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, W, H);
    }
  }
};

// ---------------------------------------------------------------- fx layers
export const FxLayer: React.FC<{fx: Fx[]; ms: number; seed: string; flashAt?: number[]}> = ({fx, ms, seed, flashAt}) => {
  const {pal} = useThemeA();
  const out: React.ReactNode[] = [];
  if (fx.includes('rain')) {
    for (let i = 0; i < 70; i++) {
      const x = (random(`${seed}r${i}`) * 1180 - (ms * 0.25) % 100) | 0;
      const y = ((random(`${seed}ry${i}`) * 1920 + ms * (1.6 + random(`${seed}rs${i}`))) % 2000) - 80;
      out.push(<div key={`r${i}`} style={{position: 'absolute', left: x - ((y / 4) | 0) % 60, top: y, width: 3, height: 33, background: pal.mid3, opacity: 0.55, transform: 'rotate(12deg)'}} />);
    }
  }
  if (fx.includes('snow')) {
    for (let i = 0; i < 60; i++) {
      const x = (random(`${seed}s${i}`) * 1080 + Math.sin(ms / 700 + i) * 30) | 0;
      const y = (random(`${seed}sy${i}`) * 1920 + ms * 0.12) % 1920;
      out.push(<div key={`s${i}`} style={{position: 'absolute', left: x, top: y, width: 6, height: 6, background: pal.white, opacity: 0.7}} />);
    }
  }
  if (fx.includes('bubbles')) {
    for (let i = 0; i < 30; i++) {
      const x = (random(`${seed}b${i}`) * 900 + 90 + Math.sin(ms / 400 + i) * 15) | 0;
      const y = 1920 - ((random(`${seed}by${i}`) * 1920 + ms * (0.3 + random(`${seed}bs${i}`) * 0.4)) % 1920);
      const r = 9 + ((random(`${seed}bz${i}`) * 3) | 0) * 3;
      out.push(<div key={`b${i}`} style={{position: 'absolute', left: x, top: y, width: r, height: r, border: `3px solid ${pal.white}`, opacity: 0.7}} />);
    }
  }
  if (fx.includes('fireflies') || fx.includes('embers')) {
    for (let i = 0; i < 26; i++) {
      const x = (random(`${seed}f${i}`) * 1080 + Math.sin(ms / 900 + i * 3) * 40) | 0;
      const y = (random(`${seed}fy${i}`) * 1500 + 200 - (fx.includes('embers') ? (ms * 0.1) % 1500 : Math.cos(ms / 800 + i) * 30)) | 0;
      const on = Math.sin(ms / 300 + i * 7) > -0.3;
      if (on) out.push(<div key={`f${i}`} style={{position: 'absolute', left: x, top: y, width: 6, height: 6, background: pal.accent}} />);
    }
  }
  if (fx.includes('stars')) {
    for (let i = 0; i < 50; i++) {
      const x = (random(`${seed}st${i}`) * 1080) | 0;
      const y = (random(`${seed}sty${i}`) * 1100) | 0;
      const tw = Math.sin(ms / 500 + i * 13) > 0.6 ? 1 : 0.35;
      out.push(<div key={`st${i}`} style={{position: 'absolute', left: x, top: y, width: 6, height: 6, background: pal.white, opacity: tw}} />);
    }
  }
  if (fx.includes('mist')) {
    out.push(
      <div
        key="mist"
        style={{
          position: 'absolute',
          left: -60 + Math.round(Math.sin(ms / 3000) * 10) * 6,
          right: -60,
          top: 820,
          height: 560,
          backgroundImage: `repeating-conic-gradient(${pal.mid1} 0 25%, transparent 0 50%)`,
          backgroundSize: '12px 12px',
          opacity: 0.35,
          maskImage: 'linear-gradient(transparent, black 35%, black 55%, transparent)',
          WebkitMaskImage: 'linear-gradient(transparent, black 35%, black 55%, transparent)',
        }}
      />,
    );
  }
  if (fx.includes('lightning')) {
    const times = flashAt ?? [700];
    const hit = times.find((t) => ms >= t && ms < t + 260);
    if (hit !== undefined) {
      const k = ms - hit;
      const on = k < 60 || (k > 120 && k < 170);
      if (on) {
        out.push(<div key="flash" style={{position: 'absolute', inset: 0, background: pal.paper, opacity: 0.22, mixBlendMode: 'screen'}} />);
        out.push(
          <Sprite key="bolt" art={SPRITES.bolt} colors={{W: pal.white}} scale={24} x={(random(`${seed}bx${hit}`) * 600 + 200) | 0} y={240} />,
        );
      }
    }
  }
  return <>{out}</>;
};

// ---------------------------------------------------------------- backdrop
// Procedural scene: terrain + sprites + fx + location pins.
export const Backdrop: React.FC<
  SceneProps<{
    terrain: string;
    sprites?: SpritePlacement[];
    fx?: Fx[];
    flashAt?: number[];
    pins?: {x: number; y: number; label: string; sub?: string}[];
    breakAt?: number; // ms: first sprite splits in two (crash, explosion)
  }>
> = ({params, ms, durationMs}) => {
  const theme = useThemeA();
  const {pal} = theme;
  const colors = colorsA(pal);
  const t = ms / 1000;
  const tStep = Math.floor(t * 6) / 6; // terrain animates at 6 fps (pixel-art feel)
  return (
    <>
      <PixelCanvas
        w={W}
        h={H}
        scale={S}
        style={{left: 0, top: 0}}
        deps={[params.terrain, tStep, pal]}
        draw={(ctx) => drawTerrain(ctx, params.terrain, tStep, pal, params.terrain)}
      />
      {(params.sprites ?? []).map((sp, i) => {
        const art = SPRITES[sp.sprite];
        if (!art) return null;
        const sc = sp.scale ?? 9;
        const {w, h} = spriteSize(art);
        const bob = sp.bob ? Math.round(Math.sin(ms / 420 + i) * 2) * 6 : 0;
        const x = sp.x + (sp.driftX ?? 0) * t - (w * sc) / 2;
        const y = sp.y + bob + (sp.fall ?? 0) * t - (h * sc) / 2;
        const broken = params.breakAt !== undefined && i === 0 && ms > params.breakAt;
        const sep = broken ? Math.min(160, (ms - params.breakAt!) * 0.4) : 0;
        const tilt = (sp.tilt ?? 0) + (sp.bob ? Math.sin(ms / 500 + i) * 3 : 0);
        const common = {colors, scale: sc, flipX: sp.flipX};
        return (
          <React.Fragment key={i}>
            {sp.glow && (
              <div
                style={{
                  position: 'absolute',
                  left: x + (w * sc) / 2 - 90,
                  top: y - 60,
                  width: 180,
                  height: 180,
                  background: `radial-gradient(circle, ${pal.accent} 0%, transparent 65%)`,
                  opacity: 0.45 + Math.sin(ms / 200) * 0.15,
                }}
              />
            )}
            {broken ? (
              <>
                <div style={{position: 'absolute', left: x - sep, top: y + sep * 0.6, width: (w * sc) / 2, height: h * sc, overflow: 'hidden', transform: `rotate(${-sep / 8}deg)`}}>
                  <Sprite art={art} {...common} />
                </div>
                <div style={{position: 'absolute', left: x + (w * sc) / 2 + sep, top: y + sep, width: (w * sc) / 2, height: h * sc, overflow: 'hidden', transform: `rotate(${sep / 5}deg)`}}>
                  <Sprite art={art} {...common} x={-(w * sc) / 2} />
                </div>
              </>
            ) : (
              <Sprite art={art} {...common} x={x} y={y} style={{transform: `${sp.flipX ? 'scaleX(-1) ' : ''}rotate(${tilt}deg)`}} />
            )}
          </React.Fragment>
        );
      })}
      <FxLayer fx={params.fx ?? []} ms={ms} seed={`bd-${params.terrain}`} flashAt={params.flashAt} />
      {(params.pins ?? []).map((p, i) => (
        <PinLabel
          key={i}
          x={p.x}
          y={p.y}
          title={p.label}
          sub={p.sub}
          visible={interpolate(ms, [durationMs * 0.2 + i * 300, durationMs * 0.2 + i * 300 + 300], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        />
      ))}
    </>
  );
};

// ---------------------------------------------------------------- image
// AI illustration (already pixelised by the pipeline) with slow push-in,
// optional fx and pins.
export const ImageScene: React.FC<
  SceneProps<{
    src: string;
    zoom?: [number, number];
    pan?: [number, number]; // px horizontal drift start/end
    fx?: Fx[];
    flashAt?: number[];
    pins?: {x: number; y: number; label: string; sub?: string}[];
    fit?: 'cover' | 'card';
  }>
> = ({params, ms, durationMs}) => {
  const {assetsBase} = useThemeA();
  const [z0, z1] = params.zoom ?? [1.0, 1.08];
  const [p0, p1] = params.pan ?? [0, 0];
  const p = Math.min(1, ms / Math.max(1, durationMs));
  const z = z0 + (z1 - z0) * p;
  const px = p0 + (p1 - p0) * p;
  const card = params.fit === 'card';
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: card ? 90 : 0,
          top: card ? 300 : 0,
          width: card ? 900 : 1080,
          height: card ? 900 : 1920,
          overflow: 'hidden',
        }}
      >
        <Img
          src={staticFile(`${assetsBase}${params.src}`)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: 'pixelated',
            transform: `translateX(${px}px) scale(${z})`,
          }}
        />
      </div>
      <FxLayer fx={params.fx ?? []} ms={ms} seed={`img-${params.src}`} flashAt={params.flashAt} />
      {(params.pins ?? []).map((pin, i) => (
        <PinLabel
          key={i}
          x={pin.x}
          y={pin.y}
          title={pin.label}
          sub={pin.sub}
          visible={interpolate(ms, [durationMs * 0.2, durationMs * 0.2 + 300], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        />
      ))}
    </>
  );
};
