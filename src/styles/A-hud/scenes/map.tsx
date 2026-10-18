import React, {useMemo} from 'react';
import {geoGraticule10, geoMercator, geoOrthographic, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import type {FeatureCollection, Geometry} from 'geojson';
import world from 'world-atlas/countries-110m.json';
import {Easing, interpolate} from 'remotion';
import {PixelCanvas, ditherFill} from '../../../shared/PixelCanvas';
import {type SceneProps, useThemeA} from '../theme';
import {PinLabel} from '../ui';

type Countries = FeatureCollection<Geometry, {name: string}>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COUNTRIES = feature(world as any, (world as any).objects.countries) as unknown as Countries;

const W = 180; // art pixels (x6 = 1080)
const H = 320;
const S = 6;

// Pixel map: a globe or a flat zoom on a region, with highlighted countries
// and a pin + label. Coordinates are [longitude, latitude].
export const MapScene: React.FC<
  SceneProps<{
    mode?: 'globe' | 'flat';
    center: [number, number];
    zoom?: number; // 1 = whole globe / continent-ish
    highlight?: string[]; // country names (Natural Earth, English)
    pin?: {lon: number; lat: number; label: string; sub?: string};
    route?: [number, number][]; // dotted path drawn progressively
    cy?: number; // vertical centre in art pixels
  }>
> = ({params, ms, durationMs}) => {
  const {pal} = useThemeA();
  const mode = params.mode ?? 'globe';
  const p = interpolate(ms, [0, durationMs], [0, 1], {extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad)});
  const zoom = (params.zoom ?? 1) * (1 + 0.12 * p);
  const cy = params.cy ?? 120;
  const hl = useMemo(() => new Set((params.highlight ?? []).map((s) => s.toLowerCase())), [params.highlight]);

  const projection = useMemo(() => {
    if (mode === 'globe') {
      return geoOrthographic()
        .rotate([-params.center[0] + 8 * (1 - p), -params.center[1] * 0.6])
        .scale(78 * zoom)
        .translate([W / 2, cy])
        .clipAngle(90);
    }
    return geoMercator()
      .center(params.center)
      .scale(170 * zoom)
      .translate([W / 2, cy]);
  }, [mode, params.center, zoom, cy, p]);

  const routeShown = params.route ? Math.max(2, Math.floor(params.route.length * Math.min(1, p * 1.6))) : 0;

  const draw = (ctx: CanvasRenderingContext2D) => {
    const path = geoPath(projection, ctx);
    if (mode === 'globe') {
      ctx.beginPath();
      path({type: 'Sphere'});
      ctx.fillStyle = pal.bg;
      ctx.fill();
    }
    // land
    for (const f of COUNTRIES.features) {
      ctx.beginPath();
      path(f);
      ctx.fillStyle = hl.has(f.properties.name.toLowerCase()) ? pal.accent : pal.mid1;
      ctx.fill();
    }
    // graticule on the globe
    if (mode === 'globe') {
      ctx.beginPath();
      path(geoGraticule10());
      ctx.strokeStyle = pal.plum2;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // terminator-like shading on the right side
      ditherFill(ctx, 0, 0, W, H, pal.bg, (x) => (x - W * 0.55) / (W * 0.55));
      // rim
      ctx.beginPath();
      path({type: 'Sphere'});
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // country borders (light)
    ctx.beginPath();
    for (const f of COUNTRIES.features) path(f);
    ctx.strokeStyle = pal.mid2;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    if (params.route && routeShown) {
      const pts = params.route.slice(0, routeShown).map((c) => projection(c)).filter(Boolean) as [number, number][];
      ctx.fillStyle = pal.white;
      pts.forEach(([x, y], i) => {
        if (i % 2 === 0) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      });
    }
  };

  const pinXY = params.pin ? projection([params.pin.lon, params.pin.lat]) : null;
  const labelP = interpolate(ms, [durationMs * 0.25, durationMs * 0.45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <>
      <PixelCanvas w={W} h={H} scale={S} draw={draw} deps={[projection, pal, hl, routeShown]} style={{left: 0, top: 0}} />
      {pinXY && <PinLabel x={pinXY[0] * S} y={pinXY[1] * S} title={params.pin!.label} sub={params.pin!.sub} visible={labelP} />}
    </>
  );
};
