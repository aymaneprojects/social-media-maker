import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';
import {type Episode, FPS, HEIGHT, WIDTH} from '../shared/schema';
import {VideoA} from '../styles/A-hud/VideoA';
import {VideoB} from '../styles/B-gold/VideoB';
import sampleA from './sample-a.json';
import sampleB from './sample-b.json';

const calc: CalculateMetadataFunction<Episode> = ({props}) => ({
  durationInFrames: Math.max(1, Math.ceil((props.durationMs / 1000) * FPS)),
  props,
});

export const Root: React.FC = () => (
  <>
    <Composition
      id="StyleA"
      component={VideoA}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={FPS * 10}
      defaultProps={sampleA as unknown as Episode}
      calculateMetadata={calc}
    />
    <Composition
      id="StyleB"
      component={VideoB}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={FPS * 10}
      defaultProps={sampleB as unknown as Episode}
      calculateMetadata={calc}
    />
  </>
);
