import { describe, expect, it } from 'vitest';
import { PRIVATE_PATHS, siteConfig, siteUrl } from './site';

describe('siteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL', () => {
    const url = siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://app.example.com', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' });
    expect(url.origin).toBe('https://app.example.com');
  });

  it('falls back to the Vercel production domain over https', () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'agencyflow.vercel.app' }).origin).toBe('https://agencyflow.vercel.app');
  });

  it('ignores blank values and falls back to localhost', () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: '  ' }).origin).toBe('http://localhost:3000');
  });

  it('throws on a malformed explicit URL instead of emitting broken tags', () => {
    expect(() => siteUrl({ NEXT_PUBLIC_SITE_URL: 'not a url' })).toThrow();
  });
});

describe('siteConfig', () => {
  it('keeps the description within the ~160 char snippet budget', () => {
    expect(siteConfig.description.length).toBeLessThanOrEqual(160);
  });

  it('marks every authenticated area private', () => {
    expect(PRIVATE_PATHS).toEqual(expect.arrayContaining(['/console', '/portal', '/api']));
  });
});
