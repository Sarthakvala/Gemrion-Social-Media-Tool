import { describe, expect, it } from 'vitest';
import { scriptToSpec } from './fromScript';
import { specProblem } from './spec';
import { totalSeconds } from './timing';
import type { ReelScript } from '@/lib/playbooks/reelScript';

const beat = (part: ReelScript['beats'][number]['part'], on_screen: string, seconds = 4) => ({ part, spoken: 's', on_screen, sub: '', seconds, visual: 'v' });

const brand = {
  name: 'Gemrion',
  profile: { palette: { bg: '#0b1b3a', fg: '#ffffff', accent: '#c9a227', muted: '#9fb0d0' }, heading_font: 'DM Sans', body_font: 'DM Sans', logo_url: 'https://x.supabase.co/logo.png', handle: '@gemrion' },
};

const script = (beats: ReelScript['beats']): ReelScript => ({ beats, caption: 'c', alt_ctas: [] });

describe('scriptToSpec', () => {
  it('maps parts to beat kinds and produces a valid spec', () => {
    const spec = scriptToSpec(script([beat('hook', 'Audits miss this'), beat('context', 'Why'), beat('value', '3x'), beat('value', 'Match payouts'), beat('payoff', 'Follow for more')]), brand, { title: 'Cash leaks', aspect: '9:16' });
    expect(spec.beats.map((b) => b.kind)).toEqual(['hook', 'point', 'stat', 'point', 'cta']);
    expect(specProblem(spec)).toBeNull();
  });

  it('makes the last beat the CTA even when the model forgot the payoff', () => {
    const spec = scriptToSpec(script([beat('hook', 'A'), beat('value', 'B')]), brand, { title: 't', aspect: '1:1' });
    expect(spec.beats.at(-1)?.kind).toBe('cta');
  });

  it('pads a too-short script and drops empty beats', () => {
    const spec = scriptToSpec(script([beat('hook', 'Only one'), beat('value', '   ')]), brand, { title: 't', aspect: '9:16' });
    expect(spec.beats).toHaveLength(2);
    expect(specProblem(spec)).toBeNull();
  });

  it('fits an overlong script under 60 seconds', () => {
    const spec = scriptToSpec(script(Array.from({ length: 10 }, (_, i) => beat(i === 0 ? 'hook' : 'value', `Beat ${i}`, 8))), brand, { title: 't', aspect: '9:16' });
    expect(totalSeconds(spec.beats)).toBeLessThanOrEqual(60);
    expect(specProblem(spec)).toBeNull();
  });

  it('truncates long text and falls back from unsafe brand values', () => {
    const spec = scriptToSpec(script([beat('hook', 'x'.repeat(200)), beat('payoff', 'y')]), { name: 'B', profile: { palette: { bg: 'red', fg: '#fff', accent: '#c9a227', muted: '#9fb0d0' }, heading_font: 'Bad;Font', body_font: 'Inter', logo_url: 'http://insecure/logo.png', handle: '' } }, { title: 't', aspect: '9:16' });
    expect(spec.beats[0].heading.length).toBeLessThanOrEqual(90);
    expect(spec.brand.bg).toBe('#0b1b3a');
    expect(spec.brand.fg).toBe('#ffffff');
    expect(spec.brand.headingFont).toBe('Inter');
    expect(spec.brand.logoUrl).toBe('');
    expect(specProblem(spec)).toBeNull();
  });
});
