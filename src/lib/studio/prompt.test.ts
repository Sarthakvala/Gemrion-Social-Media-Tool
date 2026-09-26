import { describe, expect, test } from 'vitest';
import { buildBrandSystemPrompt, buildPlanRequest, buildRegenerateRequest, buildWriteRequest, daysInMonth, monthName } from './prompt';
import { emptyBrandProfile, type BrandExample } from './types';
import type { PlanItem } from './schema';

const example = (body: string, platform = ''): BrandExample => ({
  id: body, client_id: 'c1', platform, body, post_id: null, created_at: '2026-01-01',
});

const item = (over: Partial<PlanItem> = {}): PlanItem => ({
  date: '2026-10-03', time: '09:00', pillar: 'Education', title: 'A', angle: 'x', format: 'carousel', aspect: '4:5',
  framework: 'hack-list', hook_type: 'contrarian', promotional: false, ask_question: true, ...over,
});

describe('buildBrandSystemPrompt', () => {
  test('includes filled sections and skips empty ones', () => {
    const profile = { ...emptyBrandProfile('c1'), voice: 'Blunt and specific', donts: '' };
    const out = buildBrandSystemPrompt('Gemrion', profile, []);
    expect(out).toContain('for Gemrion');
    expect(out).toContain('## Voice and tone\nBlunt and specific');
    expect(out).not.toContain('## Never\n');
    expect(out).not.toContain('Approved past posts');
  });

  test('carries the skill-derived craft rules and carousel frameworks', () => {
    const out = buildBrandSystemPrompt('B', emptyBrandProfile('c1'), []);
    expect(out).toContain('## Craft rules');
    expect(out).toContain('value-stack');
    expect(out).toContain('rant-callout');
    expect(out).toContain('Instagram ~125 chars');
  });

  test('lists pillars with their share and skips unnamed rows', () => {
    const profile = {
      ...emptyBrandProfile('c1'),
      pillars: [
        { name: 'Education', share: 30, topics: 'offer tests' },
        { name: ' ', share: 10, topics: '' },
      ],
    };
    const out = buildBrandSystemPrompt('B', profile, []);
    expect(out).toContain('- Education (30% of posts): offer tests');
    expect(out.match(/% of posts\)/g)).toHaveLength(1);
  });

  test('includes at most 8 examples, tagged with platform', () => {
    const examples = Array.from({ length: 10 }, (_, i) => example(`post ${i}`, i === 0 ? 'LI' : ''));
    const out = buildBrandSystemPrompt('B', emptyBrandProfile('c1'), examples);
    expect(out.match(/<example /g)).toHaveLength(8);
    expect(out).toContain('<example index="1" platform="LI">');
    expect(out).not.toContain('post 9');
  });

  test('is deterministic for caching', () => {
    const p = emptyBrandProfile('c1');
    expect(buildBrandSystemPrompt('B', p, [example('x')])).toBe(buildBrandSystemPrompt('B', p, [example('x')]));
  });
});

describe('dates', () => {
  test('daysInMonth handles leap years', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 10)).toBe(31);
  });

  test('monthName', () => {
    expect(monthName(2026, 10)).toBe('October 2026');
  });
});

describe('buildPlanRequest', () => {
  const base = { start: '2026-10-01', end: '2026-10-31', count: 12, platforms: ['IG', 'LI'] as ('IG' | 'LI')[], existingTitles: ['Old idea'] };

  test('month mode weaves the brief in and lists titles to avoid', () => {
    const out = buildPlanRequest({ ...base, brief: 'Diwali offer', mode: 'month' });
    expect(out).toContain('exactly 12 posts to publish between 2026-10-01 and 2026-10-31');
    expect(out).toContain('IG (Instagram), LI (LinkedIn)');
    expect(out).toContain('weave it in');
    expect(out).toContain('- Old idea');
    expect(out).toContain('## Planning rules');
  });

  test('brief mode makes every post serve the campaign', () => {
    const out = buildPlanRequest({ ...base, brief: 'Launch of X', mode: 'brief', existingTitles: [] });
    expect(out).toContain('Every post must serve this brief');
    expect(out).not.toContain('Already planned');
  });
});

describe('buildWriteRequest', () => {
  test('lists every slot in order with framework, hook type and question flag', () => {
    const out = buildWriteRequest([item({ title: 'A' }), item({ title: 'B', format: 'single', framework: 'none', ask_question: false })], ['IG'], '');
    expect(out).toContain('these 2 planned posts');
    expect(out.indexOf('Title: A')).toBeLessThan(out.indexOf('Title: B'));
    expect(out).toContain('framework: hack-list');
    expect(out).toContain('end with an open question');
    expect(out.match(/framework:/g)).toHaveLength(1);
    expect(out).not.toContain('Brief from the team');
  });
});

describe('buildRegenerateRequest', () => {
  test('keeps pillar and format and passes the note', () => {
    const out = buildRegenerateRequest({ title: 't', hook: 'h', caption: 'c', pillar: 'Case', format: 'carousel' }, 'shorter hook', ['LI']);
    expect(out).toContain('Keep the pillar ("Case") and the format (carousel)');
    expect(out).toContain('What to change: shorter hook');
  });
});
