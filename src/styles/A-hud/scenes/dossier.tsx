import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {FONT} from '../../../shared/fonts';
import {PixelCanvas, ditherFill} from '../../../shared/PixelCanvas';
import {Sprite} from '../../../shared/pixel';
import {colorsA, SPRITES} from '../sprites';
import {type SceneProps, useThemeA} from '../theme';
import {typed} from '../ui';
import {HeartRateOverlay} from './data';

// Fallback portrait when no AI image exists: pixel bust lit from the left.
const BustCanvas: React.FC<{w: number; h: number; scale: number; hair?: 'short' | 'long' | 'none'; seed?: string}> = ({w, h, scale, hair = 'short'}) => {
  const {pal} = useThemeA();
  return (
    <PixelCanvas
      w={w}
      h={h}
      scale={scale}
      style={{left: 0, top: 0}}
      deps={[pal, hair]}
      draw={(ctx) => {
        ctx.fillStyle = pal.plum;
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        // shoulders
        ctx.fillStyle = pal.plum2;
        ctx.beginPath();
        ctx.ellipse(cx, h + 2, w * 0.48, h * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        // neck
        ctx.fillStyle = pal.mid1;
        ctx.fillRect(cx - w * 0.09, h * 0.55, w * 0.18, h * 0.2);
        // long hair behind
        if (hair === 'long') {
          ctx.fillStyle = pal.plum2;
          ctx.fillRect(cx - w * 0.27, h * 0.2, w * 0.54, h * 0.55);
        }
        // head
        ctx.fillStyle = pal.mid2;
        ctx.beginPath();
        ctx.ellipse(cx, h * 0.42, w * 0.22, h * 0.27, 0, 0, Math.PI * 2);
        ctx.fill();
        // lighting: right side in shadow (dither)
        ditherFill(ctx, Math.floor(cx), 0, Math.ceil(w / 2), h, pal.mid1, (x, y) => {
          const dx = (x - cx) / (w * 0.22);
          const dy = (y - h * 0.42) / (h * 0.27);
          return dx * dx + dy * dy < 1 ? (x - cx) / (w * 0.25) : 0;
        });
        // hair
        if (hair !== 'none') {
          ctx.fillStyle = pal.plum2;
          ctx.beginPath();
          ctx.ellipse(cx, h * 0.25, w * 0.23, h * 0.12, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(cx - w * 0.23, h * 0.22, w * 0.46, h * 0.06);
        }
        // eyes + brows
        ctx.fillStyle = pal.white;
        ctx.fillRect(Math.round(cx - w * 0.11), Math.round(h * 0.42), 2, 1);
        ctx.fillRect(Math.round(cx + w * 0.06), Math.round(h * 0.42), 2, 1);
        ctx.fillStyle = pal.bg;
        ctx.fillRect(Math.round(cx - w * 0.12), Math.round(h * 0.39), 4, 1);
        ctx.fillRect(Math.round(cx + w * 0.05), Math.round(h * 0.39), 4, 1);
        // mouth
        ctx.fillStyle = pal.mid1;
        ctx.fillRect(Math.round(cx - 3), Math.round(h * 0.56), 6, 1);
      }}
    />
  );
};

export const Portrait: React.FC<{image?: string; w: number; h: number; hair?: 'short' | 'long' | 'none'}> = ({image, w, h, hair}) => {
  const {assetsBase} = useThemeA();
  if (image)
    return <Img src={staticFile(`${assetsBase}${image}`)} style={{width: w, height: h, objectFit: 'cover', imageRendering: 'pixelated'}} />;
  const scale = 6;
  return (
    <div style={{position: 'relative', width: w, height: h, overflow: 'hidden'}}>
      <BustCanvas w={Math.round(w / scale)} h={Math.round(h / scale)} scale={scale} hair={hair} />
    </div>
  );
};

// ID card: portrait, name (first name white, last name accent), fields typed
// in one by one, page index. Background: thin grid.
export const Dossier: React.FC<
  SceneProps<{
    first: string;
    last: string;
    fields: {k: string; v: string}[];
    image?: string;
    hair?: 'short' | 'long' | 'none';
    index?: string; // "1 / 92"
    sprite?: string; // small icon drawn in the card (ship, plane…)
    stamp?: string;
  }>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const colors = colorsA(pal);
  const step = (durationMs * 0.75) / Math.max(1, params.fields.length + 1);
  const stampS = params.stamp ? interpolate(ms, [durationMs * 0.6, durationMs * 0.6 + 140], [1.6, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${pal.plum} 3px, transparent 3px), linear-gradient(90deg, ${pal.plum} 3px, transparent 3px)`,
          backgroundSize: '90px 90px',
          opacity: 0.8,
        }}
      />
      <div style={{position: 'absolute', left: 84, top: 296, width: 912, height: 810, border: `3px solid ${pal.accent}`, background: pal.bg}}>
        <div style={{position: 'absolute', left: 45, top: 64, width: 370, height: 420, border: `3px solid ${pal.accent}`, overflow: 'hidden'}}>
          <Portrait image={params.image} w={364} h={414} hair={params.hair} />
        </div>
        <div style={{position: 'absolute', left: 455, top: 80, fontFamily: FONT.caption, fontSize: 76, lineHeight: '74px'}}>
          <div style={{color: pal.white}}>{params.first.toUpperCase()}</div>
          <div style={{color: pal.accent}}>{typed(params.last.toUpperCase(), ms, 150, 30)}</div>
        </div>
        <div style={{position: 'absolute', left: 455, top: 260}}>
          {params.fields.map((f, i) => {
            const appear = (i + 1) * step;
            if (ms < appear) return null;
            return (
              <div key={i} style={{marginBottom: 26}}>
                <div style={{fontFamily: FONT.hud, fontSize: 13, color: pal.mid3, letterSpacing: 2}}>{f.k.toUpperCase()}</div>
                <div style={{fontFamily: FONT.caption, fontSize: 46, color: pal.white, lineHeight: '46px'}}>{typed(f.v.toUpperCase(), ms, appear, 40)}</div>
              </div>
            );
          })}
        </div>
        {params.sprite && SPRITES[params.sprite] && ms > durationMs * 0.5 && (
          <Sprite art={SPRITES[params.sprite]} colors={colors} scale={9} x={520} y={560} />
        )}
        {params.index && (
          <div style={{position: 'absolute', right: 40, bottom: 30, fontFamily: FONT.hud, fontSize: 14, color: pal.mid3}}>{params.index}</div>
        )}
        {params.stamp && stampS > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 120,
              top: 560,
              transform: `scale(${stampS}) rotate(-6deg)`,
              border: `9px solid ${pal.accent}`,
              padding: '0 30px',
              fontFamily: FONT.caption,
              fontSize: 130,
              color: pal.accent,
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            {params.stamp.toUpperCase()}
          </div>
        )}
      </div>
    </>
  );
};

// Close-up portrait with sweat drops and a pulse monitor (tension scenes).
export const PortraitScene: React.FC<
  SceneProps<{image?: string; hair?: 'short' | 'long' | 'none'; sweat?: boolean; bpm?: [number, number]; water?: boolean}>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const colors = colorsA(pal);
  const z = 1 + 0.06 * Math.min(1, ms / durationMs);
  const dropY = ((ms / 6) % 220) | 0;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 35%, ${pal.plum2}, ${pal.bg} 70%)`}} />
      <div style={{position: 'absolute', left: 180, top: 260, width: 720, height: 860, transform: `scale(${z})`, transformOrigin: '50% 40%'}}>
        <Portrait image={params.image} w={720} h={860} hair={params.hair} />
        {params.sweat && <Sprite art={SPRITES.drop} colors={colors} scale={9} x={520} y={260 + dropY} />}
      </div>
      {params.water && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 1080 + Math.sin(ms / 400) * 9,
            bottom: 0,
            background: pal.plum,
            borderTop: `6px solid ${pal.accent}`,
            opacity: 0.85,
          }}
        />
      )}
      {params.bpm && <HeartRateOverlay bpmFrom={params.bpm[0]} bpmTo={params.bpm[1]} ms={ms} durationMs={durationMs} />}
    </>
  );
};
