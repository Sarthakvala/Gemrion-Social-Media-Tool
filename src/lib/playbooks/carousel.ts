import * as z from 'zod/v4';
import { describeInput } from './input';
import type { Playbook } from './types';

const MAX_SLIDES = 10;

const CarouselSchema = z.object({
  slides: z
    .array(
      z.object({
        role: z.enum(['hook', 'point', 'summary', 'ask']),
        headline: z.string().describe('The bold line. Slide 1: under 8 words'),
        body: z.string().describe('At most two short supporting lines, or empty'),
        visual_note: z.string().describe('What is SHOWN on the slide, not what is said'),
      })
    )
    .describe('8-10 slides: hook, one idea per point slide, a screenshot-worthy summary, then the single ask'),
  caption: z.string().describe('Opens with the hook line restated differently, then value, then the CTA'),
  cta_placement: z.string().describe('Where the CTA goes and why, one or two sentences'),
});

const fields = [
  { name: 'idea', label: 'Idea', kind: 'textarea', max: 2000, required: true },
  { name: 'audience', label: 'Audience', kind: 'text', max: 300, placeholder: 'Defaults to the brand audience' },
  { name: 'goal', label: 'Goal', kind: 'select', options: ['save', 'follow', 'DM', 'comment', 'link click'], max: 20, required: true },
] as const;

/** Ported from the carousel-builder skill. */
export const carouselPlaybook: Playbook<typeof CarouselSchema> = {
  id: 'carousel-builder',
  version: 1,
  title: 'Carousel builder',
  summary: 'One idea into an 8-10 slide carousel with a scroll-stopping first slide and a save-worthy end.',
  skill: 'carousel-builder',
  fields,
  effort: 'medium',
  outputSchema: CarouselSchema,
  buildPrompt: (input) =>
    [
      'Turn this idea into a swipeable carousel in the brand voice.',
      describeInput({ fields }, input),
      '',
      'Method:',
      '- SLIDE 1 (hook): the scroll-stopper. A big claim or sharp question under 8 words. It carries the whole post.',
      '- POINT SLIDES: ONE idea per slide, a bold line plus at most two supporting lines. If a slide needs three lines it is two slides.',
      '- SECOND-TO-LAST (summary): the checklist or summary people screenshot.',
      '- LAST (ask): the single ask, matching the goal.',
      `- 8-${MAX_SLIDES} slides in total.`,
      '- Give a visual note per slide (what is shown) and a caption that restates the hook differently in its first sentence.',
      '- Only use facts, numbers and results from the brand context; never invent them.',
    ].join('\n'),
  normalize: (o) => ({ ...o, slides: o.slides.slice(0, MAX_SLIDES) }),
  toText: (o) =>
    [
      ...o.slides.flatMap((s, i) => [`Slide ${i + 1} (${s.role}): ${s.headline}`, ...(s.body ? [s.body] : []), `  Visual: ${s.visual_note}`, '']),
      'Caption:',
      o.caption,
      '',
      `CTA placement: ${o.cta_placement}`,
    ].join('\n'),
};
