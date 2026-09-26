import { PLATFORM_NAMES, type Platform } from '@/lib/types';
import type { BrandExample, BrandProfile } from './types';
import type { PlanItem } from './schema';

// Craft rules distilled from the installed marketing skills:
// social (hooks, carousel frameworks, platform limits) and market-social
// (pillar coverage, engagement cadence, promo spacing, hashtag tiers).

const MAX_EXAMPLES = 8;

export const CAROUSEL_FRAMEWORKS = `Carousel frameworks (pick the one that fits the content, never force it):
- value-stack (4-10 slides): cover states an exact count + deliverable ("7 checks before you boost a post"); one item per slide; close with one action. Deliver exactly the count promised, no filler.
- problem-proof (6-8 slides): cover is a result stated as fact with a number; reframe the real problem; show the named system/steps; last slide is the proof. Only with real results from the brand context.
- hack-list (6-8 slides): contrarian cover implying most people get this wrong; why the usual approach fails; one NAMED technique per slide; synthesis line + CTA.
- rant-callout (4-6 slides): provocative claim about a common practice; escalate with specific detail; a fairness pivot ("the problem isn't X, it's Y"); firm sign-off.
- demo-walkthrough (5-8 slides): the finished outcome first; the pain it replaces; the numbered overview; one step per slide; result + positioning line.`;

export const CRAFT_RULES = `## Craft rules
Hooks
- The hook is the first line of every caption and must stop the scroll on its own. Match the planned hook type:
  curiosity ("The real reason X isn't what you think"), story ("Last week a client..."), value ("How to X without Y:"), contrarian ("Unpopular opinion: ..."), proof ("We did X. Result: [real number]").
- Front-load: the hook must land before the "more" cut (Instagram ~125 chars, LinkedIn ~210, TikTok ~150).

Captions per platform (only for requested platforms)
- LinkedIn: 120-280 words, insight-led, one idea, short paragraphs with line breaks, ends with one CTA.
- Instagram: 60-180 words, give a reason to save or share, restate the hook in new words (never just repeat slide 1).
- Facebook: 40-120 words, conversational.
- X: one standalone post under 270 characters.
- TikTok: a spoken-style hook plus 1-2 short lines.
- If the plan says ask_question, end the caption with one open question instead of a hard sell. Otherwise end with exactly one CTA in the brand's CTA style.

Hashtags
- 5-8 in priority order: branded first, then niche, then medium, then broad. The app trims per platform (Instagram/TikTok/LinkedIn 5, X/Facebook 2), so the first two must be the strongest. Never put hashtags inside captions.

Slides
- Slide 1 is the thumbnail and must work as a standalone post. One idea per slide. Headlines under 12 words, legible at thumbnail size. Final carousel slide carries one CTA, not three.
- Use layouts deliberately: cover for slide 1, list for points, stat only for a real number, quote for a sharp line, cta to close.

${CAROUSEL_FRAMEWORKS}

Honesty and tone
- Be specific: concrete situations, names and numbers from the brand context only. Never invent statistics, clients, testimonials or results.
- Avoid AI tells: no em dashes, no "in today's fast-paced world", "delve", "game-changer", "unlock", "elevate", no rhetorical triplets, no emoji walls.`;

export const PLANNING_RULES = `## Planning rules
- Follow the pillar mix shares; every pillar appears at least once when there are enough posts.
- Promotional posts are never on consecutive days and stay under a quarter of the plan.
- Vary formats: roughly 40% carousels, the rest single images, stories only when they fit. Feed posts are 4:5 (or 1:1), stories are 9:16.
- Vary hook types; never the same hook type twice in a row.
- About one post in three asks an open question to drive comments.
- Space posts evenly across the window on weekdays unless the brief says otherwise. Sensible local times: LinkedIn 08:00-10:00 on weekdays, Instagram/TikTok 12:00-13:00 or 18:00-20:00.`;

function section(title: string, body: string): string {
  const text = body.trim();
  return text ? `## ${title}\n${text}\n` : '';
}

/**
 * The brand "training": everything the model must follow for this client.
 * Deterministic (no dates, stable ordering) so providers can cache it.
 */
export function buildBrandSystemPrompt(
  brandName: string,
  profile: BrandProfile,
  examples: BrandExample[]
): string {
  const pillars = profile.pillars
    .filter((p) => p.name.trim())
    .map((p) => `- ${p.name} (${p.share}% of posts)${p.topics ? `: ${p.topics}` : ''}`)
    .join('\n');

  const shots = examples
    .slice(0, MAX_EXAMPLES)
    .map((e, i) => `<example index="${i + 1}"${e.platform ? ` platform="${e.platform}"` : ''}>\n${e.body.trim()}\n</example>`)
    .join('\n');

  return [
    `You are the senior social media strategist and copywriter for ${brandName}. You plan and write posts that sound exactly like this brand and nobody else. Write in ${profile.language || 'English'}.`,
    '',
    section('What the brand does', [profile.industry, profile.offer].filter(Boolean).join('\n')),
    section('Audience', profile.audience),
    section('Voice and tone', profile.voice),
    section('Content pillars', pillars),
    section('Always', profile.dos),
    section('Never', profile.donts),
    section('Banned words and phrases (never use them)', profile.banned_words),
    section('Call-to-action style', profile.cta_style),
    section('Brand hashtags to draw from', profile.hashtags),
    section('Social handle', profile.handle),
    shots
      ? `## Approved past posts\nReal posts the brand approved. Match their voice, rhythm and level of specificity. Do not copy them.\n${shots}\n`
      : '',
    CRAFT_RULES,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface PlanRequest {
  start: string;
  end: string;
  count: number;
  platforms: Platform[];
  brief: string;
  mode: 'month' | 'brief';
  existingTitles: string[];
}

export function monthName(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function platformList(platforms: Platform[]): string {
  return platforms.map((p) => `${p} (${PLATFORM_NAMES[p]})`).join(', ');
}

export function buildPlanRequest(req: PlanRequest): string {
  const avoid = req.existingTitles.length
    ? `\nAlready planned in this window, do not repeat these ideas:\n${req.existingTitles.map((t) => `- ${t}`).join('\n')}\n`
    : '';
  const brief = req.brief.trim();
  const focus =
    req.mode === 'brief'
      ? `\nThis is a campaign. Every post must serve this brief from the team:\n${brief}\n`
      : brief
        ? `\nBrief from the team for this period (weave it in where it fits):\n${brief}\n`
        : '';

  return `Plan exactly ${req.count} posts to publish between ${req.start} and ${req.end} (inclusive). Only plan them; the copy is written later.

Platforms: ${platformList(req.platforms)}.
${focus}${avoid}
${PLANNING_RULES}`;
}

export function buildWriteRequest(items: PlanItem[], platforms: Platform[], brief: string): string {
  const list = items
    .map((it, i) =>
      [
        `${i + 1}. ${it.date} ${it.time} | ${it.format} ${it.aspect}${it.framework !== 'none' ? ` | framework: ${it.framework}` : ''} | pillar: ${it.pillar}`,
        `   Title: ${it.title}`,
        `   Angle: ${it.angle}`,
        `   Hook type: ${it.hook_type}${it.promotional ? ' | promotional' : ''}${it.ask_question ? ' | end with an open question' : ''}`,
      ].join('\n')
    )
    .join('\n');

  return `Write these ${items.length} planned posts in full, in the same order, one output post per planned post.

${list}

Platforms: ${platformList(platforms)}. Fill platform_captions only for these; leave the others as empty strings.
${brief.trim() ? `\nBrief from the team:\n${brief.trim()}\n` : ''}`;
}

export function buildRegenerateRequest(
  current: { title: string; hook: string; caption: string; pillar: string; format: string },
  note: string,
  platforms: Platform[]
): string {
  return `Rewrite this one post. Keep the pillar ("${current.pillar}") and the format (${current.format}). Return exactly one post.

Current version:
Title: ${current.title}
Hook: ${current.hook}
Caption:
${current.caption}

Platforms: ${platformList(platforms)}. Fill platform_captions only for these.
${note.trim() ? `What to change: ${note.trim()}` : 'Make it sharper and more specific.'}`;
}
