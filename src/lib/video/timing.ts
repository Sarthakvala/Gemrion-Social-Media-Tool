// Pure timing and layout math shared by the app (editor, validation) and the
// Remotion composition in worker/remotion. No dependencies, so the composition
// bundle stays small.

export const REEL_ASPECTS = ['9:16', '4:5', '1:1'] as const;
export type ReelAspect = (typeof REEL_ASPECTS)[number];

export const REEL_FPS = 30;
export const MIN_BEAT_SECONDS = 1.5;
export const MAX_BEAT_SECONDS = 8;
export const MAX_REEL_SECONDS = 60;

const DIMENSIONS: Record<ReelAspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '4:5': { width: 1080, height: 1350 },
  '1:1': { width: 1080, height: 1080 },
};

export function reelDimensions(aspect: ReelAspect): { width: number; height: number } {
  return DIMENSIONS[aspect];
}

export function clampBeatSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_BEAT_SECONDS;
  return Math.min(MAX_BEAT_SECONDS, Math.max(MIN_BEAT_SECONDS, Math.round(seconds * 10) / 10));
}

export interface BeatSlot {
  from: number;
  durationInFrames: number;
}

/** Frame offset and length of every beat, back to back. */
export function beatSlots(beats: readonly { seconds: number }[], fps: number = REEL_FPS): BeatSlot[] {
  let from = 0;
  return beats.map((b) => {
    const durationInFrames = Math.max(1, Math.round(clampBeatSeconds(b.seconds) * fps));
    const slot = { from, durationInFrames };
    from += durationInFrames;
    return slot;
  });
}

export function totalFrames(beats: readonly { seconds: number }[], fps: number = REEL_FPS): number {
  const slots = beatSlots(beats, fps);
  const last = slots.at(-1);
  return last ? last.from + last.durationInFrames : fps;
}

export function totalSeconds(beats: readonly { seconds: number }[]): number {
  return beats.reduce((n, b) => n + clampBeatSeconds(b.seconds), 0);
}

/**
 * Heading size in px for a 1080-wide frame: big for short punchy lines, smaller
 * as the line grows so 90 characters still fit in ~4 lines. Hooks get a boost.
 */
export function headingFontSize(chars: number, aspect: ReelAspect, isHook = false): number {
  const base = aspect === '9:16' ? 112 : aspect === '4:5' ? 100 : 92;
  const shrink = Math.max(0, chars - 18) * 0.85;
  const size = Math.round((base - shrink) * (isHook ? 1.08 : 1));
  return Math.min(base * 1.08, Math.max(56, size));
}
