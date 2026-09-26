import { describe, expect, test } from 'vitest';
import { calendarCsv, captionFor, captionsFile, hashtagsFor, postFolderName, slugify, type ExportablePost } from './export';

const post = (over: Partial<ExportablePost> = {}): ExportablePost => ({
  id: 'p1',
  title: 'The Offer Test!',
  pillar: 'Education',
  format: 'carousel',
  hook: 'Two questions',
  copy: 'Main caption',
  caption: 'Short one',
  hashtags: '#offer #cro',
  platforms: ['IG', 'X', 'LI'],
  platform_captions: { IG: 'Instagram version' },
  visual_brief: 'Navy, big type',
  scheduled_at: '2026-10-03T04:00:00.000Z',
  slides_content: [{}, {}, {}],
  ...over,
});

describe('slugify', () => {
  test('lowercases and dashes', () => {
    expect(slugify('The Offer Test!')).toBe('the-offer-test');
  });

  test('never returns empty', () => {
    expect(slugify('!!!')).toBe('post');
  });

  test('respects max length without a trailing dash', () => {
    expect(slugify('aaaa bbbb', 5)).toBe('aaaa');
  });
});

describe('hashtagsFor', () => {
  const tags = '#a #b #c #d #e #f #g';

  test('keeps the first 5 for Instagram, TikTok and LinkedIn', () => {
    expect(hashtagsFor(tags, 'IG')).toBe('#a #b #c #d #e');
    expect(hashtagsFor(tags, 'LI')).toBe('#a #b #c #d #e');
  });

  test('keeps the first 2 for X and Facebook', () => {
    expect(hashtagsFor(tags, 'X')).toBe('#a #b');
    expect(hashtagsFor(tags, 'FB')).toBe('#a #b');
  });

  test('handles empty input', () => {
    expect(hashtagsFor('  ', 'IG')).toBe('');
  });
});

describe('captionFor', () => {
  test('prefers the tailored platform caption', () => {
    expect(captionFor(post(), 'IG')).toBe('Instagram version\n\n#offer #cro');
  });

  test('X falls back to the short caption and trims hashtags to 2', () => {
    expect(captionFor(post({ hashtags: '#offer #cro #ads' }), 'X')).toBe('Short one\n\n#offer #cro');
  });

  test('other platforms fall back to the main caption', () => {
    expect(captionFor(post(), 'LI')).toBe('Main caption\n\n#offer #cro');
  });

  test('no hashtags means no trailing blank lines', () => {
    expect(captionFor(post({ hashtags: '' }), 'LI')).toBe('Main caption');
  });
});

describe('captionsFile', () => {
  test('has a section per platform plus the visual brief', () => {
    const out = captionsFile(post());
    expect(out).toContain('===== Instagram =====');
    expect(out).toContain('===== X =====');
    expect(out).toContain('===== LinkedIn =====');
    expect(out).toContain('===== Visual brief =====\nNavy, big type');
  });
});

describe('calendarCsv', () => {
  test('escapes commas, quotes and newlines', () => {
    const csv = calendarCsv([post({ copy: 'Line one,\nsaid "hi"' })]);
    const [header, row] = csv.split('\r\n');
    expect(header.startsWith('date,time_utc,title')).toBe(true);
    expect(row).toContain('"Line one,\nsaid ""hi"""');
    expect(row.startsWith('2026-10-03,04:00,The Offer Test!')).toBe(true);
  });
});

describe('postFolderName', () => {
  test('numbers, dates and slugs', () => {
    expect(postFolderName(post(), 0)).toBe('01-2026-10-03-the-offer-test');
    expect(postFolderName(post({ scheduled_at: null }), 9)).toBe('10-unscheduled-the-offer-test');
  });
});
