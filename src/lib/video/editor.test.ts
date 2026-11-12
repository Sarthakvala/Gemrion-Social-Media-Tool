import { describe, expect, it } from 'vitest';
import { applyEdits, blankScript } from './editor';
import { scriptToSpec } from './fromScript';
import { specProblem } from './spec';

const brand = { name: 'Gemrion', profile: { palette: { bg: '#0b1b3a', fg: '#ffffff', accent: '#c9a227', muted: '#9fb0d0' }, heading_font: 'DM Sans', body_font: 'DM Sans', logo_url: '', handle: '@gemrion' } };
const base = () => scriptToSpec(blankScript(), brand, { title: 'Draft', aspect: '9:16' });

describe('blankScript', () => {
  it('turns into a valid 18-second spec that ends on a CTA', () => {
    const spec = base();
    expect(specProblem(spec)).toBeNull();
    expect(spec.beats.at(-1)?.kind).toBe('cta');
    expect(spec.beats.reduce((n, b) => n + b.seconds, 0)).toBe(18);
  });
});

describe('applyEdits', () => {
  const beats = [
    { kind: 'hook', heading: ' New hook ', sub: '', seconds: '3' },
    { kind: 'cta', heading: 'Follow', sub: 'for more', seconds: 2.5 },
  ];

  it('applies title, format and beats and clamps seconds', () => {
    const r = applyEdits(base(), { title: ' Final ', aspect: '1:1', beats: [...beats, { kind: 'point', heading: 'x', sub: '', seconds: 99 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.title).toBe('Final');
    expect(r.spec.aspect).toBe('1:1');
    expect(r.spec.beats[0].heading).toBe('New hook');
    expect(r.spec.beats[2].seconds).toBe(8);
  });

  it('keeps the brand from the saved spec', () => {
    const current = base();
    const r = applyEdits(current, { title: 't', aspect: '9:16', beats });
    expect(r.ok && r.spec.brand).toEqual(current.brand);
  });

  it('rejects unknown formats, beat types and empty headings', () => {
    expect(applyEdits(base(), { title: 't', aspect: '16:9', beats })).toEqual({ ok: false, message: 'Pick a valid format.' });
    expect(applyEdits(base(), { title: 't', aspect: '9:16', beats: [{ kind: 'intro', heading: 'x', sub: '', seconds: 3 }, beats[1]] })).toEqual({ ok: false, message: 'Unknown beat type.' });
    expect(applyEdits(base(), { title: 't', aspect: '9:16', beats: [{ ...beats[0], heading: '  ' }, beats[1]] }).ok).toBe(false);
  });

  it('rejects a single beat and a missing title', () => {
    expect(applyEdits(base(), { title: 't', aspect: '9:16', beats: [beats[0]] }).ok).toBe(false);
    expect(applyEdits(base(), { title: '  ', aspect: '9:16', beats }).ok).toBe(false);
  });
});
