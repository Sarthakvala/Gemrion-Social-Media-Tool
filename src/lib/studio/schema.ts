import * as z from 'zod/v4';

// Structured-output schemas. Every field is required (empty string / empty
// array when unused) because constrained decoding is most reliable that way;
// length and range rules are enforced afterwards in normalize.ts.

export const FRAMEWORKS = ['value-stack', 'problem-proof', 'hack-list', 'rant-callout', 'demo-walkthrough', 'none'] as const;
export const HOOK_TYPES = ['curiosity', 'story', 'value', 'contrarian', 'proof'] as const;

export const SlideSchema = z.object({
  layout: z.enum(['cover', 'statement', 'list', 'stat', 'quote', 'cta']),
  kicker: z.string().describe('Tiny label above the headline, 1-3 words, or empty'),
  headline: z.string().describe('The main on-image line. Max ~12 words'),
  body: z.string().describe('Supporting line under the headline, max ~25 words, or empty'),
  points: z.array(z.string()).describe('Only for layout "list": 3-5 short points'),
  stat: z.string().describe('Only for layout "stat": the big number, e.g. "10.6x"'),
});

export const PlanItemSchema = z.object({
  date: z.string().describe('Publish date, YYYY-MM-DD, inside the requested window'),
  time: z.string().describe('Local publish time, 24h HH:MM'),
  pillar: z.string().describe('Exactly one of the brand pillar names'),
  title: z.string().describe('Working title for the team, max 8 words'),
  angle: z.string().describe('The specific idea and why this audience will care, 1-2 sentences'),
  format: z.enum(['single', 'carousel', 'story']),
  aspect: z.enum(['1:1', '4:5', '9:16']),
  framework: z.enum(FRAMEWORKS).describe('Carousel framework; "none" for single images and stories'),
  hook_type: z.enum(HOOK_TYPES),
  promotional: z.boolean().describe('True if the post sells an offer directly'),
  ask_question: z.boolean().describe('True if the caption should end with an open question'),
});

export const PlanSchema = z.object({
  items: z.array(PlanItemSchema),
});

export const PostContentSchema = z.object({
  title: z.string().describe('Working title for the team, max 8 words'),
  hook: z.string().describe('The scroll-stopping first line'),
  caption: z.string().describe('Main long-form caption (LinkedIn length), starting with the hook'),
  short_caption: z.string().describe('Standalone version under 270 characters for X, no hashtags'),
  platform_captions: z.object({
    IG: z.string(),
    FB: z.string(),
    X: z.string(),
    LI: z.string(),
    TT: z.string(),
  }).describe('Caption tailored per platform. Empty string for platforms not requested'),
  hashtags: z.array(z.string()).describe('5-8 hashtags in priority order: branded, niche, medium, broad'),
  visual_brief: z.string().describe('One or two sentences a designer could follow for the visual'),
  slides: z.array(SlideSchema).describe('1 slide for single/story, 4-8 for carousel'),
});

export const PostBatchSchema = z.object({
  posts: z.array(PostContentSchema),
});

export type PlanItem = z.infer<typeof PlanItemSchema>;
export type PostContent = z.infer<typeof PostContentSchema>;
