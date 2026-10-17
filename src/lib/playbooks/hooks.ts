import * as z from 'zod/v4';
import { describeInput } from './input';
import type { Playbook } from './types';

const ANGLES = ['bold-claim', 'if-you-situation', 'mistake', 'number-payoff', 'curiosity-gap', 'result-first', 'pain-question'] as const;
const HOOK_COUNT = 10;
const TEST_FIRST = 3;

const HooksSchema = z.object({
  hooks: z
    .array(
      z.object({
        hook: z.string().describe('Spoken line for the first 1-3 seconds, under 12 words, no hashtags'),
        angle: z.enum(ANGLES),
        on_screen: z.string().describe('3-5 word on-screen text version'),
      })
    )
    .describe('10 hooks spread across the angles'),
  test_first: z
    .array(z.object({ index: z.number().describe('1-based position in hooks'), why: z.string().describe('One line') }))
    .describe('The 3 hooks to test first'),
});

const fields = [
  { name: 'topic', label: 'Video topic', kind: 'textarea', max: 1500, required: true },
  { name: 'audience', label: 'Audience', kind: 'text', max: 300, placeholder: 'Defaults to the brand audience' },
  { name: 'reaction', label: 'Desired reaction', kind: 'select', options: ['stop scrolling', 'save it', 'comment', 'DM us', 'follow'], max: 20, required: true },
] as const;

/** Ported from the viral-hook-writer skill. */
export const hooksPlaybook: Playbook<typeof HooksSchema> = {
  id: 'viral-hook-writer',
  version: 1,
  title: 'Reel hooks',
  summary: '10 scroll-stopping opening lines across 7 angles, with on-screen text and the 3 to test first.',
  skill: 'viral-hook-writer',
  fields,
  effort: 'low',
  outputSchema: HooksSchema,
  buildPrompt: (input) =>
    [
      'Write hooks for the first 1-3 seconds of a short-form video in the brand voice.',
      describeInput({ fields }, input),
      '',
      'Method:',
      `- Write ${HOOK_COUNT} hooks using a spread of proven angles: bold claim or contrarian take; "if you [situation], do this"; mistake or "stop doing X"; number plus payoff; curiosity gap; result first ("I went from X to Y", only with real results from the brand context); a question that names the pain.`,
      '- Under 12 words each, spoken language, no fluff, no hashtags.',
      '- Give each a 3-5 word on-screen text version.',
      `- Mark the ${TEST_FIRST} you would test first, one line on why each.`,
    ].join('\n'),
  toText: (o) =>
    [
      ...o.hooks.map((h, i) => `${i + 1}. ${h.hook}  [on screen: ${h.on_screen}] (${h.angle})`),
      '',
      'Test first:',
      ...o.test_first.map((t) => `#${t.index}: ${t.why}`),
    ].join('\n'),
  normalize: (o) => {
    const hooks = o.hooks.slice(0, HOOK_COUNT);
    return {
      hooks,
      test_first: o.test_first.filter((t) => Number.isInteger(t.index) && t.index >= 1 && t.index <= hooks.length).slice(0, TEST_FIRST),
    };
  },
};
