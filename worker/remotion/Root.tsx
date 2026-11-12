import { Composition, type CalculateMetadataFunction } from 'remotion';
import type { ReelSpec } from '../../src/lib/video/spec.ts';
import { REEL_FPS, reelDimensions, totalFrames } from '../../src/lib/video/timing.ts';
import { Reel } from './Reel.tsx';
import { SAMPLE_SPEC } from './sample.ts';

type Props = { spec: ReelSpec };

/** Size and length come from the spec, so one composition renders every reel. */
const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  ...reelDimensions(props.spec.aspect),
  fps: REEL_FPS,
  durationInFrames: totalFrames(props.spec.beats, REEL_FPS),
});

export function Root() {
  return (
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={totalFrames(SAMPLE_SPEC.beats)}
      fps={REEL_FPS}
      width={1080}
      height={1920}
      defaultProps={{ spec: SAMPLE_SPEC }}
      calculateMetadata={calculateMetadata}
    />
  );
}
