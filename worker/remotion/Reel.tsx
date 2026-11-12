import { AbsoluteFill, Easing, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Beat, ReelSpec } from '../../src/lib/video/spec.ts';
import { beatSlots, headingFontSize } from '../../src/lib/video/timing.ts';
import { useBrandFonts } from './fonts.ts';

type Brand = ReelSpec['brand'];

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const PAD = 96;

function stack(family: string): string {
  return `"${family}", "Helvetica Neue", Arial, sans-serif`;
}

/** One beat: enters with a rise and fade, leaves with a short fade so cuts never feel abrupt. */
function BeatScene({ beat, index, count, duration, brand, aspect }: { beat: Beat; index: number; count: number; duration: number; brand: Brand; aspect: ReelSpec['aspect'] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isCta = beat.kind === 'cta';
  const isHook = beat.kind === 'hook';
  const isStat = beat.kind === 'stat';
  const ink = isCta ? brand.bg : brand.fg;
  const exitStart = Math.max(0, duration - Math.round(0.3 * fps));
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  return (
    <AbsoluteFill
      style={{
        background: isCta ? brand.accent : brand.bg,
        padding: PAD,
        paddingTop: PAD * 2,
        paddingBottom: PAD * 2,
        justifyContent: isHook || isCta || isStat ? 'center' : 'flex-end',
        opacity: interpolate(frame, [exitStart, duration], [1, 0], clamp),
      }}
    >
      <div
        style={{
          fontFamily: stack(brand.bodyFont),
          fontSize: 30,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: isCta ? brand.bg : brand.accent,
          marginBottom: 28,
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { ...clamp, easing: EASE }),
        }}
      >
        {isCta ? brand.handle || brand.name : `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`}
      </div>

      <div
        style={{
          width: interpolate(frame, [0.1 * fps, 0.7 * fps], [0, 140], { ...clamp, easing: EASE }),
          height: 10,
          background: isCta ? brand.bg : brand.accent,
          marginBottom: 40,
        }}
      />

      <div
        style={{
          fontFamily: stack(brand.headingFont),
          fontWeight: 700,
          fontSize: isStat ? headingFontSize(beat.heading.length, aspect) * 1.6 : headingFontSize(beat.heading.length, aspect, isHook),
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: isStat ? brand.accent : ink,
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], { ...clamp, easing: EASE }),
          translate: interpolate(frame, [0, 0.6 * fps], ['0px 60px', '0px 0px'], { ...clamp, easing: EASE }),
        }}
      >
        {beat.heading}
      </div>

      {beat.sub && (
        <div
          style={{
            fontFamily: stack(brand.bodyFont),
            fontSize: 44,
            lineHeight: 1.3,
            marginTop: 36,
            maxWidth: 860,
            color: isCta ? brand.bg : brand.muted,
            opacity: interpolate(frame, [0.35 * fps, 0.9 * fps], [0, 1], { ...clamp, easing: EASE }),
            translate: interpolate(frame, [0.35 * fps, 0.95 * fps], ['0px 30px', '0px 0px'], { ...clamp, easing: EASE }),
          }}
        >
          {beat.sub}
        </div>
      )}
    </AbsoluteFill>
  );
}

/** Brand frame drawn over every beat: progress bar, logo, handle. */
function Overlay({ brand }: { brand: Brand }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: `${((frame + 1) / durationInFrames) * 100}%`, background: brand.accent }} />
      {brand.logoUrl && (
        <Img src={brand.logoUrl} onError={() => console.warn('[reel] logo failed to load')} style={{ position: 'absolute', top: PAD * 0.75, left: PAD, height: 72, maxWidth: 360, objectFit: 'contain' }} />
      )}
    </AbsoluteFill>
  );
}

export function Reel({ spec }: { spec: ReelSpec }) {
  useBrandFonts([spec.brand.headingFont, spec.brand.bodyFont]);
  const { fps } = useVideoConfig();
  const slots = beatSlots(spec.beats, fps);

  return (
    <AbsoluteFill style={{ background: spec.brand.bg }}>
      {spec.beats.map((beat, i) => (
        <Sequence key={i} name={`${i + 1}. ${beat.kind}`} from={slots[i].from} durationInFrames={slots[i].durationInFrames}>
          <BeatScene beat={beat} index={i} count={spec.beats.length} duration={slots[i].durationInFrames} brand={spec.brand} aspect={spec.aspect} />
        </Sequence>
      ))}
      <Overlay brand={spec.brand} />
    </AbsoluteFill>
  );
}
