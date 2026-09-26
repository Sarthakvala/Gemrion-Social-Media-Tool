import { describe, expect, test } from 'vitest';
import { addDays, clampDate, contentToPostRow, normalizeHashtags, normalizeSlides, parseTime, toScheduledIso, zoneOffset, type Slot } from './normalize';
import type { PostContent } from './schema';
import type { Slide } from './types';

const slide = (over: Partial<Slide> = {}): Slide => ({
  layout: 'statement', kicker: '', headline: 'Headline', body: '', points: [], stat: '', ...over,
});

const content = (over: Partial<PostContent> = {}): PostContent => ({
  title: 'The offer test',
  hook: 'Two questions before you spend',
  caption: 'Long caption',
  short_caption: 'Short caption',
  platform_captions: { IG: 'ig text', FB: '', X: 'x text', LI: 'li text', TT: '' },
  hashtags: ['#offer', 'marketing tips', '#Offer'],
  visual_brief: 'Navy background',
  slides: [slide(), slide({ layout: 'cta' })],
  ...over,
});

const slot = (over: Partial<Slot> = {}): Slot => ({
  date: '2026-10-03', time: '09:30', pillar: 'Education', format: 'carousel', aspect: '4:5', ...over,
});

describe('zoneOffset', () => {
  test('returns the fixed IST offset', () => {
    expect(zoneOffset('Asia/Kolkata', new Date('2026-10-03T00:00:00Z'))).toBe('+05:30');
  });

  test('returns UTC as +00:00', () => {
    expect(zoneOffset('UTC', new Date('2026-10-03T00:00:00Z'))).toBe('+00:00');
  });

  test('follows daylight saving for New York', () => {
    expect(zoneOffset('America/New_York', new Date('2026-07-01T12:00:00Z'))).toBe('-04:00');
    expect(zoneOffset('America/New_York', new Date('2026-12-01T12:00:00Z'))).toBe('-05:00');
  });
});

describe('parseTime', () => {
  test('pads and clamps', () => {
    expect(parseTime('9:05')).toBe('09:05');
    expect(parseTime('27:99')).toBe('23:59');
  });

  test('falls back to 10:00 on garbage', () => {
    expect(parseTime('morning')).toBe('10:00');
  });
});

describe('clampDate', () => {
  test('keeps dates inside the window', () => {
    expect(clampDate('2026-10-10', '2026-10-01', '2026-10-31')).toBe('2026-10-10');
  });

  test('snaps out-of-range dates to the nearest edge', () => {
    expect(clampDate('2026-09-20', '2026-10-01', '2026-10-31')).toBe('2026-10-01');
    expect(clampDate('2026-11-02', '2026-10-01', '2026-10-31')).toBe('2026-10-31');
  });

  test('invalid dates fall back to the start', () => {
    expect(clampDate('Oct 3', '2026-10-01', '2026-10-31')).toBe('2026-10-01');
    expect(clampDate('2026-13-45', '2026-10-01', '2026-10-31')).toBe('2026-10-01');
  });
});

describe('toScheduledIso', () => {
  test('converts brand-local time to UTC', () => {
    expect(toScheduledIso('2026-10-03', '09:30', 'Asia/Kolkata')).toBe('2026-10-03T04:00:00.000Z');
  });

  test('crosses midnight backwards correctly', () => {
    expect(toScheduledIso('2026-10-03', '02:00', 'Asia/Kolkata')).toBe('2026-10-02T20:30:00.000Z');
  });
});

describe('addDays', () => {
  test('rolls over months and years', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('normalizeHashtags', () => {
  test('adds #, strips spaces and punctuation, dedupes case-insensitively', () => {
    expect(normalizeHashtags(['#offer', 'marketing tips', '#Offer', '##cro!', '#'])).toBe('#offer #marketingtips #cro');
  });

  test('keeps non-latin letters and combining marks', () => {
    expect(normalizeHashtags(['दिवाली'])).toBe('#दिवाली');
  });
});

describe('normalizeSlides', () => {
  test('single format keeps only the first slide', () => {
    expect(normalizeSlides([slide(), slide()], 'single')).toHaveLength(1);
  });

  test('carousel is capped at 8 slides', () => {
    expect(normalizeSlides(Array.from({ length: 12 }, () => slide()), 'carousel')).toHaveLength(8);
  });

  test('drops empty slides and clears fields that do not belong to the layout', () => {
    const out = normalizeSlides(
      [slide({ headline: '  ' }), slide({ layout: 'statement', points: ['a'], stat: '9x' }), slide({ layout: 'list', points: [' a ', '', 'b'] })],
      'carousel'
    );
    expect(out).toHaveLength(2);
    expect(out[0].points).toEqual([]);
    expect(out[0].stat).toBe('');
    expect(out[1].points).toEqual(['a', 'b']);
  });
});

describe('contentToPostRow', () => {
  const opts = { clientId: 'c1', timeZone: 'Asia/Kolkata', platforms: ['LI', 'IG'] as ('IG' | 'LI')[] };

  test('maps captions, hashtags and the plan slot', () => {
    const row = contentToPostRow(content(), slot(), opts);
    expect(row.copy).toBe('Long caption');
    expect(row.caption).toBe('Short caption');
    expect(row.hashtags).toBe('#offer #marketingtips');
    expect(row.platforms).toEqual(['IG', 'LI']);
    expect(row.platform_captions).toEqual({ IG: 'ig text', LI: 'li text' });
    expect(row.pillar).toBe('Education');
    expect(row.scheduled_at).toBe('2026-10-03T04:00:00.000Z');
    expect(row.slides_content).toHaveLength(2);
  });

  test('ignores captions for platforms that were not requested', () => {
    const row = contentToPostRow(content(), slot(), { ...opts, platforms: ['IG'] });
    expect(row.platform_captions).toEqual({ IG: 'ig text' });
  });

  test('stories are always 9:16 with one slide', () => {
    const row = contentToPostRow(content(), slot({ format: 'story', aspect: '1:1' }), opts);
    expect(row.aspect).toBe('9:16');
    expect(row.slides_content).toHaveLength(1);
  });

  test('uses the hook as title when the title is blank', () => {
    const row = contentToPostRow(content({ title: ' ' }), slot(), opts);
    expect(row.title).toBe('Two questions before you spend');
  });
});
