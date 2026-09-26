import * as z from 'zod/v4';
import type { BrandProfile, Palette, Pillar } from '@/lib/studio/types';
import { DEFAULT_PALETTE } from '@/lib/studio/types';

// Brand-kit drafting follows the market-brand method: voice dimensions scored
// 1-10 with evidence, a personality archetype, an is / is-not voice chart,
// vocabulary to use and avoid, and a messaging hierarchy.

const ARCHETYPES = ['authority', 'innovator', 'friend', 'rebel', 'guide'] as const;

export const BrandDraftSchema = z.object({
  industry: z.string().describe('What the business does, one line'),
  tagline: z.string().describe('Existing tagline, or a suggested one under 10 words'),
  value_props: z.array(z.string()).describe('3-5 one-sentence value propositions'),
  proof_points: z.array(z.string()).describe('Only facts found in the source: results, clients, years, awards'),
  audience: z.string().describe('Who buys, what they want, what they fear, how they describe the problem'),
  voice_summary: z.string().describe('2-3 sentences on how the brand sounds'),
  formal_casual: z.number().int().describe('1 very formal to 10 very casual'),
  serious_playful: z.number().int().describe('1 very serious to 10 very playful'),
  technical_simple: z.number().int().describe('1 very technical to 10 very simple'),
  reserved_bold: z.number().int().describe('1 very reserved to 10 very bold'),
  archetype_primary: z.enum(ARCHETYPES),
  archetype_secondary: z.enum([...ARCHETYPES, 'none']),
  voice_is: z.array(z.string()).describe('4 traits the voice IS, e.g. "Confident"'),
  voice_is_not: z.array(z.string()).describe('The matching 4 traits it is NOT, e.g. "Arrogant"'),
  words_to_use: z.array(z.string()).describe('8-12 characteristic words or phrases'),
  words_to_avoid: z.array(z.string()).describe('Clichés and words that feel off-brand'),
  dos: z.array(z.string()).describe('4-6 concrete writing rules'),
  donts: z.array(z.string()).describe('4-6 concrete anti-patterns'),
  cta_style: z.string().describe('How this brand asks for action on social'),
  pillars: z.array(z.object({
    name: z.string(),
    share: z.number().int().describe('Percent of posts; all pillars sum to 100'),
    topics: z.string().describe('Example topics, comma separated'),
  })).describe('3-5 content pillars'),
  hashtags_branded: z.array(z.string()),
  hashtags_niche: z.array(z.string()),
  hashtags_broad: z.array(z.string()),
  palette: z.object({
    bg: z.string().describe('Slide background hex, e.g. #0B1B3A'),
    fg: z.string().describe('Main text hex, high contrast on bg'),
    accent: z.string().describe('Accent hex for highlights'),
    muted: z.string().describe('Secondary text hex, readable on bg'),
  }),
  heading_font: z.string().describe('A Google Fonts family for headlines'),
  body_font: z.string().describe('A Google Fonts family for body text'),
  to_confirm: z.array(z.string()).describe('Things you could not verify and the team should confirm'),
});

export type BrandDraft = z.infer<typeof BrandDraftSchema>;

export const BRAND_SYSTEM = `You are a senior brand strategist. From the source material, write a brand kit that a new copywriter could follow to write on-brand social posts.

Method:
- Read like a detective: word choice, sentence length, punctuation and claims reveal the voice. Base every judgement on the source; where the source is thin, make a sensible recommendation and list it under to_confirm.
- Score the four voice dimensions 1-10 and pick the personality archetype (authority, innovator, friend, rebel, guide).
- The voice chart pairs each trait with the failure it must avoid (Confident / not Arrogant).
- Pillars must fit the business and the audience, and their shares must sum to 100.
- Proof points: only facts that appear in the source. Never invent results, clients or numbers.
- Palette: prefer the brand's real colours from the hints. Make sure fg and muted are readable on bg. Fonts must be real Google Fonts families, preferring the ones the site already uses.
- Hashtags start with #, no spaces.`;

export function buildBrandRequest(input: {
  brandName: string;
  notes: string;
  site?: { url: string; title: string; description: string; text: string; aboutText: string; colors: string[]; fonts: string[] };
}): string {
  const parts = [`Brand: ${input.brandName}`];
  if (input.notes.trim()) parts.push(`Notes from the agency:\n${input.notes.trim()}`);
  if (input.site) {
    const s = input.site;
    parts.push(
      `Website: ${s.url}`,
      s.title && `Page title: ${s.title}`,
      s.description && `Meta description: ${s.description}`,
      s.colors.length ? `Colours used on the site (most used first): ${s.colors.join(', ')}` : '',
      s.fonts.length ? `Fonts used on the site: ${s.fonts.join(', ')}` : '',
      `<homepage_text>\n${s.text}\n</homepage_text>`,
      s.aboutText ? `<about_page_text>\n${s.aboutText}\n</about_page_text>` : ''
    );
  }
  return parts.filter(Boolean).join('\n\n');
}

const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n) || 5));
const bullets = (items: string[]) => items.map((s) => s.trim()).filter(Boolean).map((s) => `- ${s}`).join('\n');
const HEX = /^#[0-9a-f]{6}$/i;

export function composeVoice(d: BrandDraft): string {
  const pairs = d.voice_is.map((t, i) => `${t.trim()}, not ${(d.voice_is_not[i] ?? '').trim() || '-'}`);
  return [
    d.voice_summary.trim(),
    `Voice: formal ${clamp(d.formal_casual)}/10 casual, serious ${clamp(d.serious_playful)}/10 playful, technical ${clamp(d.technical_simple)}/10 simple, reserved ${clamp(d.reserved_bold)}/10 bold.`,
    `Archetype: ${d.archetype_primary}${d.archetype_secondary !== 'none' ? ` with ${d.archetype_secondary}` : ''}.`,
    pairs.length ? `We are:\n${bullets(pairs)}` : '',
    d.words_to_use.length ? `Words we use: ${d.words_to_use.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Shares rounded to integers that sum to 100. */
export function normalizePillars(pillars: Pillar[]): Pillar[] {
  const named = pillars.filter((p) => p.name.trim()).slice(0, 5);
  const total = named.reduce((s, p) => s + Math.max(0, p.share), 0);
  if (!named.length) return [];
  const scaled = named.map((p) => ({
    name: p.name.trim(),
    topics: p.topics.trim(),
    share: total > 0 ? Math.floor((Math.max(0, p.share) / total) * 100) : Math.floor(100 / named.length),
  }));
  const diff = 100 - scaled.reduce((s, p) => s + p.share, 0);
  scaled[0].share += diff;
  return scaled;
}

function safePalette(p: Palette, current: Palette): Palette {
  return {
    bg: HEX.test(p.bg) ? p.bg : current.bg,
    fg: HEX.test(p.fg) ? p.fg : current.fg,
    accent: HEX.test(p.accent) ? p.accent : current.accent,
    muted: HEX.test(p.muted) ? p.muted : current.muted,
  };
}

function isUntouchedLook(p: BrandProfile): boolean {
  return (
    p.palette.bg === DEFAULT_PALETTE.bg &&
    p.palette.accent === DEFAULT_PALETTE.accent &&
    p.heading_font === 'Inter' &&
    p.body_font === 'Inter'
  );
}

/** Draft -> kit fields. Keeps logo, handle, language and timezone; only restyles if the look was never set. */
export function draftToProfile(d: BrandDraft, current: BrandProfile): BrandProfile {
  const tags = [...d.hashtags_branded, ...d.hashtags_niche, ...d.hashtags_broad]
    .map((t) => '#' + t.replace(/^#+/, '').replace(/\s+/g, ''))
    .filter((t) => t.length > 1);
  const offer = [
    d.tagline.trim() && `Tagline: ${d.tagline.trim()}`,
    d.value_props.length ? `Value:\n${bullets(d.value_props)}` : '',
    d.proof_points.length ? `Proof we can cite:\n${bullets(d.proof_points)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const restyle = isUntouchedLook(current);

  return {
    ...current,
    industry: d.industry.trim(),
    offer,
    audience: d.audience.trim(),
    voice: composeVoice(d),
    pillars: normalizePillars(d.pillars),
    dos: bullets(d.dos),
    donts: bullets(d.donts),
    banned_words: d.words_to_avoid.map((w) => w.trim()).filter(Boolean).join(', '),
    cta_style: d.cta_style.trim(),
    hashtags: [...new Set(tags)].join(' '),
    palette: restyle ? safePalette(d.palette, current.palette) : current.palette,
    heading_font: restyle && d.heading_font.trim() ? d.heading_font.trim() : current.heading_font,
    body_font: restyle && d.body_font.trim() ? d.body_font.trim() : current.body_font,
  };
}
