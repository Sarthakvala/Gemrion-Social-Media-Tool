import * as z from 'zod/v4';
import { MAX_BEAT_SECONDS, MAX_REEL_SECONDS, MIN_BEAT_SECONDS, REEL_ASPECTS, REEL_FPS, totalSeconds } from './timing.ts';

/**
 * The render contract between the app and the worker: everything the Remotion
 * composition needs, and nothing it has to fetch from the database. Bump
 * `version` on breaking changes so old queued jobs fail clearly.
 */
export const REEL_SPEC_VERSION = 1;
export const BEAT_KINDS = ['hook', 'point', 'stat', 'cta'] as const;
export type BeatKind = (typeof BEAT_KINDS)[number];

const HEX = /^#[0-9a-f]{6}$/i;
const FONT = /^[A-Za-z0-9 ]{1,60}$/;

export const BeatSchema = z.object({
  kind: z.enum(BEAT_KINDS),
  heading: z.string().trim().min(1).max(90),
  sub: z.string().trim().max(160),
  seconds: z.number().min(MIN_BEAT_SECONDS).max(MAX_BEAT_SECONDS),
});

export const ReelSpecSchema = z
  .object({
    version: z.literal(REEL_SPEC_VERSION),
    title: z.string().trim().min(1).max(120),
    aspect: z.enum(REEL_ASPECTS),
    fps: z.literal(REEL_FPS),
    brand: z.object({
      name: z.string().max(120),
      bg: z.string().regex(HEX),
      fg: z.string().regex(HEX),
      accent: z.string().regex(HEX),
      muted: z.string().regex(HEX),
      headingFont: z.string().regex(FONT),
      bodyFont: z.string().regex(FONT),
      // only https images; the worker's browser fetches it
      logoUrl: z.union([z.literal(''), z.url({ protocol: /^https$/ })]),
      handle: z.string().max(60),
    }),
    beats: z.array(BeatSchema).min(2).max(12),
  })
  .refine((s) => totalSeconds(s.beats) <= MAX_REEL_SECONDS, { message: `A reel can be at most ${MAX_REEL_SECONDS} seconds.` });

export type ReelSpec = z.infer<typeof ReelSpecSchema>;
export type Beat = z.infer<typeof BeatSchema>;

/** First readable validation message, for showing in the editor or a failed job. */
export function specProblem(input: unknown): string | null {
  const r = ReelSpecSchema.safeParse(input);
  if (r.success) return null;
  const issue = r.error.issues[0];
  const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${where}${issue.message}`;
}
