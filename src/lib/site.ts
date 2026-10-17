/** Single source for the app's public identity: name, copy, URL, share colors. */
export const siteConfig = {
  name: 'AgencyFlow',
  tagline: 'On-brand social content, a month at a time',
  description:
    'Train it once on a brand, then plan, write and render a month of on-brand social posts: calendar, captions, hashtags and slides, ready to download and post.',
  keywords: [
    'social media content studio',
    'brand kit',
    'content calendar',
    'AI captions',
    'carousel slides',
    'agency workflow',
    'client approvals',
  ],
  colors: { canvas: '#fafaf9', ink: '#0a0a0a', muted: '#71717a', line: '#e4e4e7', accent: '#ff5a1f' },
} as const;

const LOCAL_URL = 'http://localhost:3000';

/**
 * Absolute origin used for metadataBase, canonical links and the sitemap.
 * Order: explicit NEXT_PUBLIC_SITE_URL, then Vercel's production domain, then localhost.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(LOCAL_URL);
}

/** Paths that sit behind auth or serve machine endpoints; never indexed. */
export const PRIVATE_PATHS = ['/console', '/portal', '/api', '/auth'] as const;
