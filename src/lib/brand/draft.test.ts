import { describe, expect, test } from 'vitest';
import { buildBrandRequest, composeVoice, draftToProfile, normalizePillars, type BrandDraft } from './draft';
import { emptyBrandProfile } from '@/lib/studio/types';

const draft = (over: Partial<BrandDraft> = {}): BrandDraft => ({
  industry: 'Creative agency',
  tagline: 'Honest marketing',
  value_props: ['We say when you waste money'],
  proof_points: ['10.6x ROAS for Girllish'],
  audience: 'Founders',
  voice_summary: 'Blunt and warm.',
  formal_casual: 7,
  serious_playful: 3,
  technical_simple: 8,
  reserved_bold: 12,
  archetype_primary: 'rebel',
  archetype_secondary: 'guide',
  voice_is: ['Direct', 'Specific'],
  voice_is_not: ['Rude'],
  words_to_use: ['honest', 'waste'],
  words_to_avoid: ['synergy', ' unlock '],
  dos: ['Use numbers'],
  donts: ['No hype'],
  cta_style: 'DM us',
  pillars: [
    { name: 'Education', share: 50, topics: 'tips' },
    { name: 'Proof', share: 30, topics: 'cases' },
    { name: 'Take', share: 30, topics: 'opinions' },
  ],
  hashtags_branded: ['#gemrion'],
  hashtags_niche: ['founder marketing', '#gemrion'],
  hashtags_broad: ['#marketing'],
  palette: { bg: '#0D1023', fg: '#F4F2EA', accent: '#C6A15A', muted: 'beige' },
  heading_font: 'DM Sans',
  body_font: 'DM Sans',
  to_confirm: [],
  ...over,
});

describe('composeVoice', () => {
  test('includes clamped dimension scores, archetype and the is/is-not chart', () => {
    const v = composeVoice(draft());
    expect(v).toContain('Blunt and warm.');
    expect(v).toContain('reserved 10/10 bold');
    expect(v).toContain('Archetype: rebel with guide.');
    expect(v).toContain('- Direct, not Rude');
    expect(v).toContain('- Specific, not -');
    expect(v).toContain('Words we use: honest, waste');
  });

  test('omits the secondary archetype when none', () => {
    expect(composeVoice(draft({ archetype_secondary: 'none' }))).toContain('Archetype: rebel.');
  });
});

describe('normalizePillars', () => {
  test('rescales shares to exactly 100', () => {
    const out = normalizePillars(draft().pillars);
    expect(out.reduce((s, p) => s + p.share, 0)).toBe(100);
    expect(out[0].share).toBeGreaterThan(out[1].share);
  });

  test('splits evenly when all shares are zero, and caps at 5 pillars', () => {
    const out = normalizePillars(Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, share: 0, topics: '' })));
    expect(out).toHaveLength(5);
    expect(out.reduce((s, p) => s + p.share, 0)).toBe(100);
  });

  test('drops unnamed pillars', () => {
    expect(normalizePillars([{ name: ' ', share: 50, topics: '' }])).toEqual([]);
  });
});

describe('draftToProfile', () => {
  test('fills text fields, dedupes hashtags and keeps identity fields', () => {
    const current = { ...emptyBrandProfile('c1'), handle: '@gemrion', logo_url: 'https://x/logo.png', timezone: 'Asia/Kolkata' };
    const p = draftToProfile(draft(), current);
    expect(p.handle).toBe('@gemrion');
    expect(p.logo_url).toBe('https://x/logo.png');
    expect(p.hashtags).toBe('#gemrion #foundermarketing #marketing');
    expect(p.banned_words).toBe('synergy, unlock');
    expect(p.offer).toContain('Tagline: Honest marketing');
    expect(p.offer).toContain('- 10.6x ROAS for Girllish');
    expect(p.dos).toBe('- Use numbers');
  });

  test('applies the suggested look only when the kit still has the default look, and rejects bad hex', () => {
    const fresh = draftToProfile(draft(), emptyBrandProfile('c1'));
    expect(fresh.palette.bg).toBe('#0D1023');
    expect(fresh.palette.muted).toBe(emptyBrandProfile('c1').palette.muted);
    expect(fresh.heading_font).toBe('DM Sans');

    const styled = { ...emptyBrandProfile('c1'), heading_font: 'Poppins' };
    const kept = draftToProfile(draft(), styled);
    expect(kept.heading_font).toBe('Poppins');
    expect(kept.palette).toEqual(styled.palette);
  });
});

describe('buildBrandRequest', () => {
  test('includes notes and site signals', () => {
    const out = buildBrandRequest({
      brandName: 'Gemrion',
      notes: 'No em dashes',
      site: { url: 'https://gemrion.com/', title: 'T', description: 'D', text: 'HOME', aboutText: '', colors: ['#0d1023'], fonts: ['DM Sans'] },
    });
    expect(out).toContain('Brand: Gemrion');
    expect(out).toContain('No em dashes');
    expect(out).toContain('#0d1023');
    expect(out).toContain('<homepage_text>\nHOME');
    expect(out).not.toContain('about_page_text');
  });
});
