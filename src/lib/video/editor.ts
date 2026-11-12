import type { ReelScript } from '@/lib/playbooks/reelScript';
import { BEAT_KINDS, ReelSpecSchema, specProblem, type Beat, type BeatKind, type ReelSpec } from './spec';
import { REEL_ASPECTS, clampBeatSeconds, type ReelAspect } from './timing';

/** Starting point for a reel written by hand: no AI call, nothing to pay for. */
export function blankScript(): ReelScript {
  const beat = (part: ReelScript['beats'][number]['part'], on_screen: string, seconds: number) => ({ part, spoken: '', on_screen, sub: '', seconds, visual: '' });
  return {
    beats: [
      beat('hook', 'Your scroll-stopping hook', 3),
      beat('value', 'First point', 4),
      beat('value', 'Second point', 4),
      beat('value', 'Third point', 4),
      beat('payoff', 'Follow for more', 3),
    ],
    caption: '',
    alt_ctas: [],
  };
}

export interface EditorInput {
  title: string;
  aspect: string;
  beats: { kind: string; heading: string; sub: string; seconds: number | string }[];
}

export type EditResult = { ok: true; spec: ReelSpec } | { ok: false; message: string };

function isAspect(v: string): v is ReelAspect {
  return (REEL_ASPECTS as readonly string[]).includes(v);
}

function isKind(v: string): v is BeatKind {
  return (BEAT_KINDS as readonly string[]).includes(v);
}

/**
 * Applies the editor's fields to the saved spec. The brand block and version
 * always come from the saved spec, never from the browser.
 */
export function applyEdits(current: ReelSpec, input: EditorInput): EditResult {
  if (!isAspect(input.aspect)) return { ok: false, message: 'Pick a valid format.' };
  const beats: Beat[] = [];
  for (const b of input.beats) {
    if (!isKind(b.kind)) return { ok: false, message: 'Unknown beat type.' };
    beats.push({ kind: b.kind, heading: String(b.heading ?? '').trim(), sub: String(b.sub ?? '').trim(), seconds: clampBeatSeconds(Number(b.seconds)) });
  }
  const next = { ...current, title: input.title.trim(), aspect: input.aspect, beats };
  const problem = specProblem(next);
  return problem ? { ok: false, message: problem } : { ok: true, spec: ReelSpecSchema.parse(next) };
}
