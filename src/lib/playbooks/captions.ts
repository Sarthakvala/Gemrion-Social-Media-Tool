import * as z from 'zod/v4';
import { describeInput } from './input';
import type { Playbook } from './types';

const TIERS = ['broad', 'mid', 'niche'] as const;
const MAX_HASHTAGS = 15;

const CaptionSchema = z.object({
  caption: z.string().describe('First line is a second hook that earns the "more" tap; then 2-4 short lines of value; then one CTA. No hashtags.'),
  hashtags: z
    .array(z.object({ tag: z.string().describe('With the leading #'), tier: z.enum(TIERS) }))
    .describe('12-15 hashtags, tiered: a few broad, several mid, several niche'),
  first_comment: z.string().describe('The hashtags plus one question that sparks replies'),
  alt_text: z.string().describe('One accessible description of the visual'),
});

const fields = [
  { name: 'topic', label: 'What the post or reel is about', kind: 'textarea', max: 2000, required: true },
  { name: 'platform', label: 'Platform', kind: 'select', options: ['Instagram Reels', 'Instagram post', 'TikTok', 'YouTube Shorts', 'LinkedIn', 'Facebook'], max: 40, required: true },
  { name: 'goal', label: 'Goal', kind: 'select', options: ['saves', 'follows', 'comments', 'DMs', 'link clicks'], max: 20, required: true },
] as const;

/** Ported from the caption-and-hashtags skill. */
export const captionsPlaybook: Playbook<typeof CaptionSchema> = {
  id: 'caption-and-hashtags',
  version: 1,
  title: 'Caption + hashtags',
  summary: 'Caption, tiered hashtag set, first comment and alt text for one post or reel.',
  skill: 'caption-and-hashtags',
  fields,
  effort: 'low',
  outputSchema: CaptionSchema,
  buildPrompt: (input) =>
    [
      'Write the post copy for this piece of content in the brand voice.',
      describeInput({ fields }, input),
      '',
      'Method:',
      '- CAPTION: the first line is the only line shown before "more", so it is a second hook. Then 2-4 short lines of value, then exactly one clear CTA aimed at the goal. No hashtag soup in the caption.',
      `- HASHTAGS: 12-${MAX_HASHTAGS}, tiered: a few broad, several mid, several niche. Tiers are your best estimate of tag size; never claim exact post counts. Prefer the brand hashtags where they fit.`,
      '- FIRST COMMENT: the hashtags plus one question that sparks replies (comments boost reach).',
      '- ALT TEXT: one accessible description of the visual.',
      "Match the niche's language. No emojis as bullets unless the brand voice uses them.",
    ].join('\n'),
  toText: (o) =>
    [o.caption, '', 'First comment:', o.first_comment, '', 'Hashtags:', o.hashtags.map((h) => `${h.tag} (${h.tier})`).join(' '), '', `Alt text: ${o.alt_text}`].join('\n'),
  normalize: (o) => ({
    ...o,
    caption: o.caption.trim(),
    hashtags: o.hashtags
      .map((h) => ({ ...h, tag: `#${h.tag.trim().replace(/^#+/, '').replace(/\s+/g, '')}` }))
      .filter((h, i, all) => h.tag.length > 1 && all.findIndex((x) => x.tag.toLowerCase() === h.tag.toLowerCase()) === i)
      .slice(0, MAX_HASHTAGS),
  }),
};
