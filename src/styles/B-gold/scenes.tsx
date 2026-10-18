import React, {useMemo} from 'react';
import {geoMercator, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import type {FeatureCollection, Geometry} from 'geojson';
import world from 'world-atlas/countries-110m.json';
import {Img, interpolate, random, staticFile, Easing} from 'remotion';
import {FONT} from '../../shared/fonts';
import {PixelCanvas, ditherFill} from '../../shared/PixelCanvas';
import {Sprite, spriteSize} from '../../shared/pixel';
import {colorsB, type SceneProps, useThemeB} from './theme';
import {SPRITES_B} from './sprites';
import {Label, PixelTitle, popAt, StampB, Tag} from './ui';

type Countries = FeatureCollection<Geometry, {name: string}>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COUNTRIES = feature(world as any, (world as any).objects.countries) as unknown as Countries;

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const ease = (ms: number, a: number, b: number) =>
  interpolate(ms, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});

// An AI illustration (transparent background, pixelised by the pipeline) or a
// code sprite, centred at (cx, cy) in a box of `size` px, with idle motion.
export const Visual: React.FC<{src?: string; sprite?: string; cx: number; cy: number; size: number; ms: number; pop?: number; idle?: boolean; opacity?: number}> = ({
  src,
  sprite,
  cx,
  cy,
  size,
  ms,
  pop = 1,
  idle = true,
  opacity = 1,
}) => {
  const {pal, assetsBase} = useThemeB();
  const bob = idle ? Math.round(Math.sin(ms / 600) * 2) * 4 : 0;
  if (src)
    return (
      <Img
        src={staticFile(`${assetsBase}${src}`)}
        style={{
          position: 'absolute',
          left: cx - size / 2,
          top: cy - size / 2 + bob,
          width: size,
          height: size,
          objectFit: 'contain',
          imageRendering: 'pixelated',
          transform: `scale(${pop})`,
          opacity,
        }}
      />
    );
  const art = sprite ? SPRITES_B[sprite] : undefined;
  if (!art) return null;
  const {w, h} = spriteSize(art);
  const sc = Math.max(4, Math.floor((size * 0.62) / Math.max(w, h)));
  return (
    <div style={{position: 'absolute', left: cx - (w * sc) / 2, top: cy - (h * sc) / 2 + bob, transform: `scale(${pop})`, opacity}}>
      <Sprite art={art} colors={colorsB(pal)} scale={sc} style={{position: 'relative'}} />
    </div>
  );
};

type VisualParams = {src?: string; sprite?: string};

// ---------------------------------------------------------------- prop
export const Prop: React.FC<
  SceneProps<
    VisualParams & {
      title?: string;
      titleColor?: 'gold' | 'red' | 'green' | 'cream';
      sub?: string;
      label?: string;
      tag?: {text: string; x?: number; y?: number};
      stamp?: {text: string; color?: 'red' | 'green' | 'gold'};
      size?: number;
    }
  >
> = ({params, ms, durationMs}) => {
  const pop = popAt(ms);
  const size = params.size ?? 760;
  const cy = params.title ? 900 : 820;
  return (
    <>
      {params.title && <PixelTitle text={params.title.toUpperCase()} y={250} size={130} color={params.titleColor} scaleIn={popAt(ms, 80)} />}
      {params.sub && <Label text={params.sub} y={params.title ? 420 : 300} size={30} />}
      <Visual src={params.src} sprite={params.sprite} cx={540} cy={cy} size={size} ms={ms} pop={pop} />
      {params.label && ms > 250 && <Label text={params.label} y={cy + size / 2 + 30} size={30} />}
      {params.tag && ms > 300 && <Tag text={params.tag.text} x={params.tag.x ?? 540} y={params.tag.y ?? cy - size / 2 - 10} pop={popAt(ms, 300)} />}
      {params.stamp && <StampB text={params.stamp.text} color={params.stamp.color} x={540} y={cy + 60} ms={ms} delayMs={durationMs * 0.45} size={86} />}
    </>
  );
};

// ---------------------------------------------------------------- title
export const Title: React.FC<SceneProps<VisualParams & {text: string; sub?: string; color?: 'gold' | 'red' | 'green' | 'cream'}>> = ({params, ms}) => {
  const hasVisual = params.src || params.sprite;
  return (
    <>
      <PixelTitle text={params.text.toUpperCase()} y={hasVisual ? 330 : 720} size={150} color={params.color} scaleIn={popAt(ms)} />
      {params.sub && ms > 200 && <Label text={params.sub} y={hasVisual ? 530 : 920} size={32} />}
      {hasVisual && <Visual src={params.src} sprite={params.sprite} cx={540} cy={1000} size={620} ms={ms} pop={popAt(ms, 150)} />}
    </>
  );
};

// ---------------------------------------------------------------- counter
export const CounterB: React.FC<
  SceneProps<VisualParams & {from: number; to: number; suffix?: string; prefix?: string; label?: string; color?: 'gold' | 'red' | 'cream'}>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeB();
  const v = params.from + (params.to - params.from) * ease(ms, 0, durationMs * 0.7);
  const text = `${params.prefix ?? ''}${fmt(v)}${params.suffix ? ` ${params.suffix}` : ''}`;
  const color = params.color === 'red' ? pal.red : params.color === 'cream' ? pal.cream : pal.gold;
  const hasVisual = params.src || params.sprite;
  const y = hasVisual ? 330 : 760;
  const size = text.length > 10 ? 64 : 84;
  return (
    <>
      <Label text={text} y={y} size={size} color={color} />
      {params.label && <Label text={params.label} y={y + size * 1.6} size={26} />}
      {hasVisual && <Visual src={params.src} sprite={params.sprite} cx={540} cy={1000} size={600} ms={ms} pop={popAt(ms, 100)} />}
    </>
  );
};

// ---------------------------------------------------------------- map
const MW = 270;
const MH = 480;
export const MapB: React.FC<
  SceneProps<{
    center: [number, number];
    zoom?: number;
    highlight?: string[];
    pins?: {lon: number; lat: number; label: string}[];
    line?: {from: [number, number]; to: [number, number]; label?: string};
    title?: string;
  }>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeB();
  const zoom = (params.zoom ?? 1) * (1 + 0.06 * Math.min(1, ms / durationMs));
  const hl = useMemo(() => new Set((params.highlight ?? []).map((s) => s.toLowerCase())), [params.highlight]);
  const proj = useMemo(() => geoMercator().center(params.center).scale(250 * zoom).translate([MW / 2, MH * 0.45]), [params.center, zoom]);
  const lineP = params.line ? ease(ms, durationMs * 0.2, durationMs * 0.6) : 0;
  const draw = (ctx: CanvasRenderingContext2D) => {
    const path = geoPath(proj, ctx);
    for (const f of COUNTRIES.features) {
      const isHl = hl.has(f.properties.name.toLowerCase());
      ctx.beginPath();
      path(f);
      ctx.fillStyle = isHl ? pal.gold : '#2B2A28';
      ctx.fill();
    }
    // dither texture on highlighted land
    const img = ctx.getImageData(0, 0, MW, MH);
    ditherFill(ctx, 0, 0, MW, MH, pal.goldDark, (x, y) => {
      const i = (y * MW + x) * 4;
      return img.data[i] > 200 && img.data[i + 1] > 150 ? 0.35 : 0;
    });
    ctx.beginPath();
    for (const f of COUNTRIES.features) path(f);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    if (params.line && lineP > 0) {
      const a = proj(params.line.from);
      const b = proj(params.line.to);
      if (a && b) {
        ctx.fillStyle = pal.cream;
        const n = 40;
        for (let k = 0; k <= n * lineP; k++) {
          if (k % 2) continue;
          const t = k / n;
          ctx.fillRect(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), 2, 2);
        }
      }
    }
  };
  const S = 1080 / MW;
  const pinsP = ease(ms, durationMs * 0.25, durationMs * 0.45);
  return (
    <>
      <PixelCanvas w={MW} h={MH} scale={S} deps={[proj, hl, lineP, pal]} draw={draw} style={{left: 0, top: 120}} />
      {params.title && <PixelTitle text={params.title.toUpperCase()} y={170} size={110} scaleIn={popAt(ms)} />}
      {(params.pins ?? []).map((p, i) => {
        const xy = proj([p.lon, p.lat]);
        if (!xy) return null;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: xy[0] * S - 12, top: 120 + xy[1] * S - 12, width: 24, height: 24, background: pal.red, border: '4px solid #000'}} />
            {pinsP > 0 && <Tag text={p.label} x={xy[0] * S + 30} y={120 + xy[1] * S - 50} pop={pinsP} anchor="left" />}
          </React.Fragment>
        );
      })}
      {params.line?.label && lineP > 0.6 && (() => {
        const a = proj(params.line!.from);
        const b = proj(params.line!.to);
        if (!a || !b) return null;
        return <Label text={params.line!.label!} x={((a[0] + b[0]) / 2) * S + 40} y={120 + ((a[1] + b[1]) / 2) * S - 30} align="left" width={500} size={40} />;
      })()}
    </>
  );
};

// ---------------------------------------------------------------- nameTag
export const NameTag: React.FC<SceneProps<VisualParams & {name: string; role?: string; image?: string; body?: string}>> = ({params, ms}) => {
  const {pal, assetsBase} = useThemeB();
  const pop = popAt(ms);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 360,
          width: 900,
          height: 300,
          border: `8px solid ${pal.gold}`,
          outline: `4px solid ${pal.goldDark}`,
          outlineOffset: -20,
          background: '#0B0602',
          transform: `scale(${pop})`,
        }}
      >
        <div style={{position: 'absolute', left: 36, top: 36, width: 220, height: 220, border: `4px solid ${pal.goldDark}`, overflow: 'hidden', background: '#1A1003'}}>
          {params.image ? (
            <Img src={staticFile(`${assetsBase}${params.image}`)} style={{width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated'}} />
          ) : (
            <Sprite art={SPRITES_B.head} colors={colorsB(pal)} scale={22} x={22} y={40} />
          )}
        </div>
        <div style={{position: 'absolute', left: 300, top: 58, right: 30, fontFamily: FONT.bTitle, fontSize: 62, color: pal.cream, whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {params.name.toUpperCase()}
        </div>
        <div style={{position: 'absolute', left: 300, top: 150, right: 40, height: 5, background: pal.gold}} />
        {params.role && <div style={{position: 'absolute', left: 300, top: 180, fontFamily: FONT.bLabel, fontSize: 26, color: pal.gold, letterSpacing: 5}}>{params.role.toUpperCase()}</div>}
      </div>
      {(params.src || params.sprite) && <Visual src={params.src} sprite={params.sprite} cx={540} cy={1060} size={560} ms={ms} pop={popAt(ms, 200)} />}
    </>
  );
};

// ---------------------------------------------------------------- barCompare
export const BarCompare: React.FC<SceneProps<{bars: {label: string; value: number; color?: 'gold' | 'red' | 'green' | 'cream'}[]; factor?: string}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeB();
  const max = Math.max(...params.bars.map((b) => b.value));
  const n = params.bars.length;
  const slot = 800 / n;
  const base = 1180;
  const H = 640;
  return (
    <>
      {params.factor && ms > durationMs * 0.5 && <Label text={params.factor} x={110} y={480} align="left" width={300} size={70} color={pal.cream} />}
      <div style={{position: 'absolute', left: 140, top: base, width: 800, height: 5, background: pal.gold}} />
      {params.bars.map((b, i) => {
        const p = ease(ms, i * 250, i * 250 + durationMs * 0.5);
        const h = Math.max(6, (b.value / max) * H * p);
        const color = b.color === 'red' ? pal.red : b.color === 'green' ? pal.green : b.color === 'cream' ? pal.cream : pal.gold;
        const x = 140 + slot * i + slot * 0.2;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: x,
                top: base - h,
                width: slot * 0.6,
                height: h,
                background: color,
                backgroundImage: `repeating-linear-gradient(90deg, transparent 0 8px, rgba(0,0,0,0.25) 8px 12px)`,
              }}
            />
            <Label text={fmt(b.value * p)} x={x - 60} width={slot * 0.6 + 120} y={base - h - 90} size={44} color={color} />
            <Label text={b.label} x={x - 80} width={slot * 0.6 + 160} y={base + 40} size={26} />
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- balance
export const Balance: React.FC<SceneProps<{left: VisualParams & {label?: string}; right: VisualParams & {label?: string}; tilt?: 'left' | 'right' | 'even'; title?: string}>> = ({
  params,
  ms,
  durationMs,
}) => {
  const {pal} = useThemeB();
  const target = params.tilt === 'left' ? -12 : params.tilt === 'right' ? 12 : 0;
  const ang = target * ease(ms, durationMs * 0.25, durationMs * 0.6) + Math.sin(ms / 300) * (1 - ease(ms, 0, durationMs * 0.6)) * 2;
  const rad = (ang * Math.PI) / 180;
  const cx = 540;
  const cy = 760;
  const arm = 330;
  const lx = cx - Math.cos(rad) * arm;
  const ly = cy - Math.sin(rad) * arm;
  const rx = cx + Math.cos(rad) * arm;
  const ry = cy + Math.sin(rad) * arm;
  return (
    <>
      {params.title && <Label text={params.title} y={330} size={34} />}
      <div style={{position: 'absolute', left: cx - 9, top: cy, width: 18, height: 460, background: pal.gold}} />
      <div style={{position: 'absolute', left: cx - 160, top: cy + 450, width: 320, height: 24, background: pal.gold}} />
      <div style={{position: 'absolute', left: cx - arm, top: cy - 6, width: arm * 2, height: 12, background: pal.gold, transform: `rotate(${ang}deg)`}} />
      <div style={{position: 'absolute', left: cx - 22, top: cy - 22, width: 44, height: 44, background: pal.cream, border: `6px solid ${pal.goldDark}`}} />
      {[
        {x: lx, y: ly, s: params.left},
        {x: rx, y: ry, s: params.right},
      ].map((p, i) => (
        <React.Fragment key={i}>
          <div style={{position: 'absolute', left: p.x - 3, top: p.y, width: 6, height: 150, background: pal.goldDark}} />
          <div style={{position: 'absolute', left: p.x - 120, top: p.y + 150, width: 240, height: 22, background: pal.gold, borderRadius: '0 0 120px 120px'}} />
          <Visual src={p.s.src} sprite={p.s.sprite} cx={p.x} cy={p.y + 80} size={150} ms={ms} idle={false} />
          {p.s.label && <Label text={p.s.label} x={p.x - 200} width={400} y={p.y + 200} size={22} />}
        </React.Fragment>
      ))}
    </>
  );
};

// ---------------------------------------------------------------- timeline
export const Timeline: React.FC<SceneProps<{from: string; to: string; label?: string; fromIcon?: string; toIcon?: string; fromColor?: 'red' | 'green'; toColor?: 'red' | 'green'}>> = ({
  params,
  ms,
  durationMs,
}) => {
  const {pal} = useThemeB();
  const p = ease(ms, 0, durationMs * 0.6);
  const x0 = 170;
  const x1 = 910;
  return (
    <>
      {params.label && <Label text={params.label} y={640} size={46} color={pal.cream} opacity={p} />}
      <Label text={params.from} x={x0 - 150} width={300} y={760} size={30} />
      <Label text={params.to} x={x1 - 150} width={300} y={760} size={30} opacity={p > 0.95 ? 1 : 0.3} />
      <div style={{position: 'absolute', left: x0, top: 840, width: (x1 - x0) * p, height: 8, background: pal.gold}} />
      <div style={{position: 'absolute', left: x0 - 10, top: 826, width: 8, height: 36, background: pal.gold}} />
      {p > 0.95 && <div style={{position: 'absolute', left: x1 - 4, top: 826, width: 8, height: 36, background: pal.gold}} />}
      <Visual sprite={params.fromIcon ?? 'cross'} cx={x0} cy={960} size={110} ms={ms} idle={false} />
      {p > 0.95 && <Visual sprite={params.toIcon ?? 'checkG'} cx={x1} cy={960} size={110} ms={ms} idle={false} pop={popAt(ms, durationMs * 0.6)} />}
    </>
  );
};

// ---------------------------------------------------------------- split
type Side = VisualParams & {stamp?: string; color?: 'red' | 'green' | 'gold'; label?: string};
export const Split: React.FC<SceneProps<{title?: string; left: Side; right: Side}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeB();
  return (
    <>
      {params.title && <Label text={params.title} y={360} size={40} color={pal.cream} />}
      <div style={{position: 'absolute', left: 120, top: 480, width: 840, height: 620, border: `6px solid ${pal.gold}`}} />
      <div style={{position: 'absolute', left: 537, top: 480, width: 6, height: 620, background: pal.gold}} />
      {[
        {s: params.left, cx: 330, d: 0},
        {s: params.right, cx: 750, d: durationMs * 0.35},
      ].map(({s, cx, d}, i) =>
        ms < d ? null : (
          <React.Fragment key={i}>
            <Visual src={s.src} sprite={s.sprite} cx={cx} cy={720} size={260} ms={ms} pop={popAt(ms, d)} />
            {s.stamp && <StampB text={s.stamp} color={s.color ?? (i === 0 ? 'red' : 'green')} x={cx} y={950} ms={ms} delayMs={d + 250} size={40} rotate={-6} />}
            {s.label && <Label text={s.label} x={cx - 200} width={400} y={1030} size={20} />}
          </React.Fragment>
        ),
      )}
    </>
  );
};

// ---------------------------------------------------------------- thought
export const ThoughtB: React.FC<SceneProps<VisualParams & {text?: string; value?: string}>> = ({params, ms}) => {
  const {pal} = useThemeB();
  const pop = popAt(ms);
  return (
    <div style={{position: 'absolute', inset: 0, transform: `scale(${pop})`, transformOrigin: '50% 45%'}}>
      <svg width={1080} height={1500} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M 170 520 Q 120 400 250 380 Q 270 280 410 300 Q 490 220 610 290 Q 750 250 810 360 Q 950 380 930 520 Q 1000 620 910 720 Q 930 860 790 860 Q 710 960 570 900 Q 430 980 340 890 Q 190 900 180 780 Q 90 700 170 520 Z"
          fill="#000"
          stroke={pal.gold}
          strokeWidth={8}
          strokeDasharray="22 10"
        />
        <circle cx={230} cy={990} r={28} fill="none" stroke={pal.gold} strokeWidth={8} />
        <circle cx={170} cy={1080} r={16} fill="none" stroke={pal.gold} strokeWidth={8} />
      </svg>
      {params.value && <Label text={params.value} y={520} size={70} color={pal.cream} />}
      {params.text && <Label text={params.text} y={params.value ? 650 : 580} size={34} color={pal.gold} />}
      {(params.src || params.sprite) && !params.value && <Visual src={params.src} sprite={params.sprite} cx={540} cy={620} size={380} ms={ms} />}
    </div>
  );
};

// ---------------------------------------------------------------- icons
export const Icons: React.FC<SceneProps<{sprite: string; total: number; highlight?: number; highlightLabel?: string; label?: string; sub?: string; cols?: number}>> = ({
  params,
  ms,
  durationMs,
}) => {
  const {pal} = useThemeB();
  const art = SPRITES_B[params.sprite] ?? SPRITES_B.head;
  const {w, h} = spriteSize(art);
  const cols = params.cols ?? (params.total <= 12 ? Math.min(params.total, 4) : params.total <= 40 ? 6 : 12);
  const rows = Math.ceil(params.total / cols);
  const cell = Math.min(820 / cols, 700 / rows);
  const sc = Math.max(2, Math.floor((cell * 0.75) / Math.max(w, h)));
  const x0 = 540 - (cols * cell) / 2;
  const y0 = 480;
  const shown = Math.ceil(params.total * ease(ms, 0, durationMs * 0.45));
  const hlCount = params.highlight ?? 0;
  const showHl = ms > durationMs * 0.5;
  return (
    <>
      {params.label && <Label text={params.label} y={340} size={34} />}
      {Array.from({length: shown}, (_, i) => {
        const isHl = showHl && i < hlCount;
        const cx = x0 + (i % cols) * cell + cell / 2;
        const cy = y0 + Math.floor(i / cols) * cell + cell / 2;
        return (
          <div key={i} style={{position: 'absolute', left: cx - (w * sc) / 2, top: cy - (h * sc) / 2}}>
            <Sprite art={art} colors={isHl ? {...colorsB(pal), W: pal.green, A: pal.green, n: pal.green, o: pal.green} : colorsB(pal)} scale={sc} style={{position: 'relative'}} />
          </div>
        );
      })}
      {params.sub && showHl && <Label text={params.sub} y={y0 + rows * cell + 40} size={30} color={hlCount ? pal.green : pal.cream} />}
    </>
  );
};

// ---------------------------------------------------------------- listing
export const Listing: React.FC<SceneProps<{title?: string; items: {text: string; state?: 'check' | 'cross' | 'none'; sprite?: string}[]}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeB();
  const step = (durationMs * 0.7) / Math.max(1, params.items.length);
  return (
    <>
      {params.title && <PixelTitle text={params.title.toUpperCase()} y={260} size={100} scaleIn={popAt(ms)} />}
      {params.items.map((it, i) => {
        if (ms < i * step) return null;
        const y = 480 + i * 160;
        const pop = popAt(ms, i * step);
        return (
          <div key={i} style={{position: 'absolute', left: 120, right: 120, top: y, height: 130, display: 'flex', alignItems: 'center', gap: 40, transform: `scale(${pop})`}}>
            <div style={{width: 110, height: 110, position: 'relative'}}>
              <Visual sprite={it.state === 'check' ? 'checkG' : it.state === 'cross' ? 'cross' : it.sprite} cx={55} cy={55} size={90} ms={ms} idle={false} />
            </div>
            <div style={{fontFamily: FONT.bLabel, fontSize: 30, color: it.state === 'cross' ? pal.grey : pal.cream, letterSpacing: 4, lineHeight: '44px'}}>{it.text.toUpperCase()}</div>
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- calendar
export const Calendar: React.FC<SceneProps<{month: string; year?: string; highlight?: number[]; label?: string}>> = ({params, ms, durationMs}) => {
  const {pal} = useThemeB();
  const pop = popAt(ms);
  const hl = new Set(params.highlight ?? []);
  const shownHl = Math.ceil((params.highlight?.length ?? 0) * ease(ms, durationMs * 0.25, durationMs * 0.7));
  const hlList = (params.highlight ?? []).slice(0, shownHl);
  return (
    <div style={{position: 'absolute', inset: 0, transform: `scale(${pop})`}}>
      <div style={{position: 'absolute', left: 190, top: 430, width: 700, height: 640, background: pal.cream, border: '6px solid #000'}}>
        <div style={{height: 120, background: pal.gold, fontFamily: FONT.bLabel, fontSize: 34, color: '#000', textAlign: 'center', lineHeight: '120px', letterSpacing: 4}}>
          {params.month.toUpperCase()} {params.year ?? ''}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, padding: 24}}>
          {Array.from({length: 35}, (_, i) => (
            <div key={i} style={{height: 62, background: hlList.includes(i + 1) ? pal.red : hl.has(i + 1) ? '#D9CDB4' : '#E9DEC6'}} />
          ))}
        </div>
      </div>
      {params.label && ms > durationMs * 0.4 && <Label text={params.label} y={1130} size={32} />}
    </div>
  );
};

// ---------------------------------------------------------------- image (scene)
export const ImageB: React.FC<SceneProps<{src?: string; sprite?: string; tags?: {text: string; x: number; y: number}[]; title?: string; fit?: 'card' | 'cover'}>> = ({params, ms, durationMs}) => {
  const {assetsBase, pal} = useThemeB();
  const z = 1 + 0.05 * Math.min(1, ms / durationMs);
  const card = params.fit !== 'cover';
  return (
    <>
      {params.title && <PixelTitle text={params.title.toUpperCase()} y={230} size={110} scaleIn={popAt(ms)} />}
      {params.src ? (
        <div style={{position: 'absolute', left: card ? 90 : 0, top: card ? 470 : 0, width: card ? 900 : 1080, height: card ? 900 : 1920, overflow: 'hidden', border: card ? `6px solid ${pal.gold}` : undefined}}>
          <Img src={staticFile(`${assetsBase}${params.src}`)} style={{width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated', transform: `scale(${z})`}} />
        </div>
      ) : (
        <Visual sprite={params.sprite ?? 'magnifier'} cx={540} cy={900} size={600} ms={ms} />
      )}
      {(params.tags ?? []).map((t, i) => (ms > 300 + i * 250 ? <Tag key={i} text={t.text} x={t.x} y={t.y} pop={popAt(ms, 300 + i * 250)} /> : null))}
    </>
  );
};

// ---------------------------------------------------------------- stars + halo background
export const BackgroundB: React.FC<{ms: number; seed: string}> = ({ms, seed}) => {
  const {pal} = useThemeB();
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 45% at 50% 45%, ${pal.halo} 0%, ${pal.bg} 75%)`}} />
      {Array.from({length: 38}, (_, i) => {
        const x = Math.floor(random(`${seed}x${i}`) * 1080);
        const y = Math.floor(random(`${seed}y${i}`) * 1920);
        const tw = Math.sin(ms / 400 + i * 1.7);
        const big = random(`${seed}b${i}`) > 0.85;
        if (tw < -0.2) return null;
        return big ? (
          <div key={i} style={{position: 'absolute', left: x, top: y}}>
            <div style={{position: 'absolute', left: -12, top: -3, width: 30, height: 6, background: pal.cream, opacity: 0.8}} />
            <div style={{position: 'absolute', left: 0, top: -15, width: 6, height: 30, background: pal.cream, opacity: 0.8}} />
          </div>
        ) : (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: 5, height: 5, background: pal.cream, opacity: 0.35 + tw * 0.3}} />
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- HUD (clues + date badge)
export const HudB: React.FC<{clues: {sprite: string; crossed?: boolean}[]; date?: string; ms: number}> = ({clues, date, ms}) => {
  const {pal} = useThemeB();
  return (
    <>
      {clues.length > 0 && (
        <div style={{position: 'absolute', left: 48, top: 150}}>
          <div style={{fontFamily: FONT.bLabel, fontSize: 16, color: pal.cream, letterSpacing: 3, marginBottom: 12}}>INDICES</div>
          <div style={{display: 'flex', gap: 14}}>
            {clues.map((c, i) => (
              <div key={i} style={{width: 66, height: 66, border: `4px solid ${pal.gold}`, background: '#0B0602', position: 'relative'}}>
                <Visual sprite={c.sprite} cx={29} cy={29} size={46} ms={ms} idle={false} />
                {c.crossed && <div style={{position: 'absolute', left: -4, top: 27, width: 66, height: 6, background: pal.red, transform: 'rotate(-45deg)'}} />}
              </div>
            ))}
          </div>
        </div>
      )}
      {date && (
        <div
          style={{
            position: 'absolute',
            left: clues.length ? 48 : 60,
            top: clues.length ? 270 : 160,
            border: `4px solid ${pal.gold}`,
            padding: '8px 16px',
            fontFamily: FONT.bLabel,
            fontSize: 24,
            color: pal.gold,
            letterSpacing: 4,
          }}
        >
          {date}
        </div>
      )}
    </>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCENES_B: Record<string, React.FC<SceneProps<any>>> = {
  prop: Prop,
  title: Title,
  counter: CounterB,
  map: MapB,
  nameTag: NameTag,
  barCompare: BarCompare,
  balance: Balance,
  timeline: Timeline,
  split: Split,
  thought: ThoughtB,
  icons: Icons,
  listing: Listing,
  calendar: Calendar,
  image: ImageB,
  // aliases kept for storyboard robustness
  stamp: Prop,
  versus: Split,
  clues: Prop,
};
