import { describe, expect, it } from 'vitest';
import { ReelSpecSchema, specProblem, type ReelSpec } from './spec';
import { beatSlots, clampBeatSeconds, headingFontSize, reelDimensions, totalFrames, totalSeconds } from './timing';

export const sampleSpec = (over: Partial<ReelSpec> = {}): ReelSpec => ({
  version: 1,
  title: 'Why audits miss cash leaks',
  aspect: '9:16',
  fps: 30,
  brand: {
    name: 'Gemrion',
    bg: '#0b1b3a',
    fg: '#ffffff',
    accent: '#c9a227',
    muted: '#9fb0d0',
    headingFont: 'DM Sans',
    bodyFont: 'DM Sans',
    logoUrl: '',
    handle: '@gemrion',
  },
  beats: [
    { kind: 'hook', heading: 'Your audit passed. Cash still leaked.', sub: '', seconds: 3 },
    { kind: 'point', heading: 'Reconcile weekly, not yearly', sub: 'Small gaps compound.', seconds: 4 },
    { kind: 'cta', heading: 'Follow for one fix a week', sub: '', seconds: 3 },
  ],
  ...over,
});

describe('timing', () => {
  it('maps aspects to 1080-wide frames', () => {
    expect(reelDimensions('9:16')).toEqual({ width: 1080, height: 1920 });
    expect(reelDimensions('1:1')).toEqual({ width: 1080, height: 1080 });
  });

  it('clamps and rounds beat lengths', () => {
    expect(clampBeatSeconds(0.2)).toBe(1.5);
    expect(clampBeatSeconds(99)).toBe(8);
    expect(clampBeatSeconds(3.14)).toBe(3.1);
    expect(clampBeatSeconds(Number.NaN)).toBe(1.5);
  });

  it('lays beats back to back in frames', () => {
    expect(beatSlots([{ seconds: 3 }, { seconds: 4 }])).toEqual([
      { from: 0, durationInFrames: 90 },
      { from: 90, durationInFrames: 120 },
    ]);
    expect(totalFrames([{ seconds: 3 }, { seconds: 4 }])).toBe(210);
    expect(totalFrames([])).toBe(30);
    expect(totalSeconds([{ seconds: 3 }, { seconds: 4.5 }])).toBe(7.5);
  });
});

describe('ReelSpecSchema', () => {
  it('accepts a valid spec', () => {
    expect(specProblem(sampleSpec())).toBeNull();
  });

  it('rejects reels over 60 seconds', () => {
    const beats = Array.from({ length: 9 }, () => ({ kind: 'point' as const, heading: 'x', sub: '', seconds: 8 }));
    expect(specProblem(sampleSpec({ beats }))).toContain('at most 60 seconds');
  });

  it('rejects unsafe values the worker browser would load', () => {
    expect(ReelSpecSchema.safeParse(sampleSpec({ brand: { ...sampleSpec().brand, logoUrl: 'http://x.test/logo.png' } })).success).toBe(false);
    expect(ReelSpecSchema.safeParse(sampleSpec({ brand: { ...sampleSpec().brand, headingFont: 'Inter;}body{x' } })).success).toBe(false);
    expect(ReelSpecSchema.safeParse(sampleSpec({ brand: { ...sampleSpec().brand, bg: 'red' } })).success).toBe(false);
  });

  it('needs 2-12 beats and points at the bad field', () => {
    expect(specProblem(sampleSpec({ beats: [sampleSpec().beats[0]] }))).toMatch(/^beats:/);
    expect(specProblem({ ...sampleSpec(), version: 2 })).toMatch(/^version:/);
  });
});

describe('headingFontSize', () => {
  it('keeps short lines large and long lines readable', () => {
    expect(headingFontSize(10, '9:16')).toBe(112);
    expect(headingFontSize(90, '9:16')).toBe(56);
    expect(headingFontSize(40, '9:16')).toBeLessThan(headingFontSize(20, '9:16'));
  });

  it('scales by aspect and boosts hooks', () => {
    expect(headingFontSize(10, '1:1')).toBeLessThan(headingFontSize(10, '9:16'));
    expect(headingFontSize(10, '9:16', true)).toBeGreaterThan(headingFontSize(10, '9:16'));
  });
});
