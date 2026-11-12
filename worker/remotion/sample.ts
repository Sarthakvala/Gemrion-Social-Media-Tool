import type { ReelSpec } from '../../src/lib/video/spec.ts';

/** Studio preview and smoke-test render. Real renders always pass a spec from the app. */
export const SAMPLE_SPEC: ReelSpec = {
  version: 1,
  title: 'Sample reel',
  aspect: '9:16',
  fps: 30,
  brand: {
    name: 'Sample Brand',
    bg: '#0b1b3a',
    fg: '#ffffff',
    accent: '#c9a227',
    muted: '#9fb0d0',
    headingFont: 'DM Sans',
    bodyFont: 'DM Sans',
    logoUrl: '',
    handle: '@samplebrand',
  },
  beats: [
    { kind: 'hook', heading: 'Your audit passed. Cash still leaked.', sub: '', seconds: 3 },
    { kind: 'point', heading: 'Reconcile weekly, not yearly', sub: 'Small gaps compound into big ones.', seconds: 3.5 },
    { kind: 'stat', heading: '3x', sub: 'faster close with weekly reconciliation', seconds: 3 },
    { kind: 'point', heading: 'Match every payout to an invoice', sub: 'Unmatched payouts are where money hides.', seconds: 3.5 },
    { kind: 'cta', heading: 'Follow for one fix a week', sub: 'Save this for your next close.', seconds: 3 },
  ],
};
