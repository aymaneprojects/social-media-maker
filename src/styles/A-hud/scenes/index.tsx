import React from 'react';
import type {SceneProps} from '../theme';
import {Backdrop, ImageScene} from './backdrop';
import {BigDate, BigWord, Checklist, Clock, Counter, Gauge, HeartRateOverlay, IconGrid, Stamp, TypedNote} from './data';
import {Dossier, PortraitScene} from './dossier';
import {MapScene} from './map';
import {Inventory, Radar, Thought} from './misc';
import {LineChart, Newspaper, Podium, Scoreboard, TimelineA, Versus} from './extra';
import {Action} from './action';

// Registry of style-A scenes. The storyboard references them by `type`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCENES_A: Record<string, React.FC<SceneProps<any>>> = {
  bigDate: BigDate,
  counter: Counter,
  iconGrid: IconGrid,
  checklist: Checklist,
  clock: Clock,
  gauge: Gauge,
  stamp: Stamp,
  bigWord: BigWord,
  typedNote: TypedNote,
  dossier: Dossier,
  portrait: PortraitScene,
  map: MapScene,
  backdrop: Backdrop,
  image: ImageScene,
  radar: Radar,
  inventory: Inventory,
  thought: Thought,
  scoreboard: Scoreboard,
  lineChart: LineChart,
  versus: Versus,
  timeline: TimelineA,
  podium: Podium,
  newspaper: Newspaper,
  action: Action,
};

// Renders a scene; `under` lets a scene sit on top of another one
// (e.g. a big date over a stormy sky), `bpm` adds the pulse monitor.
export const RenderSceneA: React.FC<{scene: {type: string; under?: {type: string}; bpm?: [number, number]; [k: string]: unknown}; ms: number; durationMs: number}> = ({
  scene,
  ms,
  durationMs,
}) => {
  const C = SCENES_A[scene.type];
  const under = scene.under ? <RenderSceneA scene={scene.under as never} ms={ms} durationMs={durationMs} /> : null;
  return (
    <>
      {under}
      {C ? <C params={scene} ms={ms} durationMs={durationMs} /> : null}
      {scene.bpm && <HeartRateOverlay bpmFrom={scene.bpm[0]} bpmTo={scene.bpm[1]} ms={ms} durationMs={durationMs} />}
    </>
  );
};
