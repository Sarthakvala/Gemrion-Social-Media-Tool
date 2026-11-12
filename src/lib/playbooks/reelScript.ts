import * as z from 'zod/v4';
import { describeInput } from './input';
import type { Playbook } from './types';

const PARTS = ['hook', 'context', 'value', 'payoff'] as const;
const MAX_BEATS = 8;

export const ReelScriptSchema = z.object({
  beats: z
    .array(
      z.object({
        part: z.enum(PARTS),
        spoken: z.string().describe('What is said out loud in this beat'),
        on_screen: z.string().describe('Big on-screen text, under 10 words. For a number beat, just the number, e.g. "3x"'),
        sub: z.string().describe('Optional small line under the on-screen text, under 20 words, or empty'),
        seconds: z.number().describe('Beat length in seconds, 2-6'),
        visual: z.string().describe('One-line B-roll or visual suggestion'),
      })
    )
    .describe('Hook (0-3s), context, 3 value beats, payoff + CTA. 5-7 beats in total.'),
  caption: z.string().describe('Post caption: hook restated, value, one CTA. No hashtags'),
  alt_ctas: z.array(z.string()).describe('2 alternate closing CTAs'),
});

export type ReelScript = z.infer<typeof ReelScriptSchema>;

const fields = [
  { name: 'idea', label: 'Idea or hook', kind: 'textarea', max: 1500, required: true },
  { name: 'platform', label: 'Platform', kind: 'select', options: ['Instagram Reels', 'TikTok', 'YouTube Shorts', 'LinkedIn video'], max: 30, required: true },
  { name: 'length', label: 'Length', kind: 'select', options: ['30 seconds', '45 seconds'], max: 12, required: true },
  { name: 'goal', label: 'Goal', kind: 'select', options: ['follows', 'saves', 'DMs', 'link clicks', 'comments'], max: 20, required: true },
] as const;

/** Ported from the reel-scripter skill; the beats feed the reel renderer directly. */
export const reelScriptPlaybook: Playbook<typeof ReelScriptSchema> = {
  id: 'reel-scripter',
  version: 1,
  title: 'Reel script',
  summary: 'A 30-45 second reel: hook, context, three value beats, payoff and CTA, with spoken lines, on-screen text and visuals.',
  skill: 'reel-scripter',
  fields,
  effort: 'medium',
  outputSchema: ReelScriptSchema,
  buildPrompt: (input) =>
    [
      'Write a short-form video script in the brand voice.',
      describeInput({ fields }, input),
      '',
      'Structure:',
      '1. HOOK (0-3s): stop the scroll and state the promise.',
      '2. CONTEXT (3-8s): name the problem or the stakes.',
      '3. VALUE: three fast, concrete beats. Show, do not lecture. One idea per beat.',
      '4. PAYOFF + CTA (last ~5s): the takeaway plus one specific action that fits the goal.',
      '',
      'Rules:',
      '- Spoken lines total about 140 words for 45 seconds, about 95 for 30. Read it aloud and cut 20%.',
      '- On-screen text is the punchline of each beat, under 10 words; it must make sense with the sound off.',
      '- Beat seconds must add up to the chosen length.',
      '- Only use numbers and results that appear in the brand context; never invent them.',
      '- Give one visual suggestion per beat and two alternate CTAs.',
    ].join('\n'),
  normalize: (o) => ({
    ...o,
    beats: o.beats.filter((b) => b.on_screen.trim()).slice(0, MAX_BEATS),
    alt_ctas: o.alt_ctas.slice(0, 2),
  }),
  toText: (o) =>
    [
      ...o.beats.flatMap((b, i) => [
        `${i + 1}. ${b.part.toUpperCase()} (${b.seconds}s)`,
        `   Say: ${b.spoken}`,
        `   On screen: ${b.on_screen}${b.sub ? ` / ${b.sub}` : ''}`,
        `   Visual: ${b.visual}`,
      ]),
      '',
      'Caption:',
      o.caption,
      '',
      'Alternate CTAs:',
      ...o.alt_ctas.map((c) => `- ${c}`),
    ].join('\n'),
};
