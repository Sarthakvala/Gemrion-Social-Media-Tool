import { DEFAULT_PALETTE, type BrandProfile, type Palette } from '@/lib/studio/types';
import type { ReelScript } from '@/lib/playbooks/reelScript';
import { REEL_SPEC_VERSION, type Beat, type BeatKind, type ReelSpec } from './spec';
import { MAX_REEL_SECONDS, clampBeatSeconds, type ReelAspect } from './timing';

const HEX = /^#[0-9a-f]{6}$/i;
const FONT = /^[A-Za-z0-9 ]{1,60}$/;
const MAX_BEATS = 12;
const MIN_BEATS = 2;

/** A number-led line ("3x", "47%", "$12k") renders as a big stat. */
const STAT = /^[$€£₹]?\d[\d.,]*\s*(x|%|k|m|bn|hrs?|days?|min)?\+?$/i;

function cut(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function kindFor(part: ReelScript['beats'][number]['part'], onScreen: string, isLast: boolean): BeatKind {
  if (part === 'hook') return 'hook';
  if (isLast || part === 'payoff') return 'cta';
  return STAT.test(onScreen.trim()) ? 'stat' : 'point';
}

function safePalette(p: Partial<Palette> | undefined): Palette {
  const pick = (k: keyof Palette) => (p?.[k] && HEX.test(p[k]!) ? p[k]! : DEFAULT_PALETTE[k]);
  return { bg: pick('bg'), fg: pick('fg'), accent: pick('accent'), muted: pick('muted') };
}

/** Scales beat lengths down proportionally if the script overruns the reel cap. */
function fitDuration(beats: Beat[]): Beat[] {
  const total = beats.reduce((n, b) => n + b.seconds, 0);
  if (total <= MAX_REEL_SECONDS) return beats;
  const ratio = MAX_REEL_SECONDS / total;
  return beats.map((b) => ({ ...b, seconds: Math.floor(clampBeatSeconds(b.seconds * ratio) * 10) / 10 }));
}

/**
 * Turns a reel script (playbook output) and the brand kit into a render spec.
 * Everything is clamped to the spec's limits so the result always validates.
 */
export function scriptToSpec(
  script: ReelScript,
  brand: { name: string; profile: Pick<BrandProfile, 'palette' | 'heading_font' | 'body_font' | 'logo_url' | 'handle'> },
  opts: { title: string; aspect: ReelAspect }
): ReelSpec {
  const usable = script.beats.filter((b) => b.on_screen.trim()).slice(0, MAX_BEATS);
  const beats: Beat[] = usable.map((b, i) => ({
    kind: kindFor(b.part, b.on_screen, i === usable.length - 1),
    heading: cut(b.on_screen, 90),
    sub: cut(b.sub, 160),
    seconds: clampBeatSeconds(b.seconds),
  }));
  while (beats.length < MIN_BEATS) beats.push({ kind: 'cta', heading: cut(brand.name || 'Follow for more', 90), sub: '', seconds: 3 });

  const p = brand.profile;
  return {
    version: REEL_SPEC_VERSION,
    title: cut(opts.title, 120) || 'Untitled reel',
    aspect: opts.aspect,
    fps: 30,
    brand: {
      name: cut(brand.name, 120),
      ...safePalette(p.palette),
      headingFont: FONT.test(p.heading_font) ? p.heading_font : 'Inter',
      bodyFont: FONT.test(p.body_font) ? p.body_font : 'Inter',
      logoUrl: /^https:\/\//.test(p.logo_url) ? p.logo_url : '',
      handle: cut(p.handle, 60),
    },
    beats: fitDuration(beats),
  };
}
