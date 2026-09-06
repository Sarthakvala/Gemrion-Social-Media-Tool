import 'server-only';

export type PlatformConfig = {
  name: string;
  authorize: string;
  scope: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  configured: () => boolean;
  pkce?: boolean;
  tiktok?: boolean;
};

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  FB: {
    name: 'Facebook Page',
    authorize: 'https://www.facebook.com/v21.0/dialog/oauth',
    scope: 'pages_show_list,pages_manage_posts,pages_read_engagement,business_management',
    clientId: () => process.env.META_APP_ID,
    clientSecret: () => process.env.META_APP_SECRET,
    configured: () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
  },
  IG: {
    name: 'Instagram Business',
    authorize: 'https://www.facebook.com/v21.0/dialog/oauth',
    scope: 'pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement,business_management',
    clientId: () => process.env.META_APP_ID,
    clientSecret: () => process.env.META_APP_SECRET,
    configured: () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
  },
  X: {
    name: 'X (Twitter)',
    authorize: 'https://twitter.com/i/oauth2/authorize',
    scope: 'tweet.read tweet.write users.read offline.access',
    clientId: () => process.env.X_CLIENT_ID,
    clientSecret: () => process.env.X_CLIENT_SECRET,
    configured: () => !!(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
    pkce: true,
  },
  LI: {
    name: 'LinkedIn',
    authorize: 'https://www.linkedin.com/oauth/v2/authorization',
    scope: 'openid profile w_member_social',
    clientId: () => process.env.LINKEDIN_CLIENT_ID,
    clientSecret: () => process.env.LINKEDIN_CLIENT_SECRET,
    configured: () => !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
  },
  TT: {
    name: 'TikTok',
    authorize: 'https://www.tiktok.com/v2/auth/authorize',
    scope: 'user.info.basic,video.publish',
    clientId: () => process.env.TIKTOK_CLIENT_KEY,
    clientSecret: () => process.env.TIKTOK_CLIENT_SECRET,
    configured: () => !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
    tiktok: true,
  },
};

export function redirectUri(platform: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return `${base}/api/oauth/${platform}/callback`;
}

export async function fetchJson(url: string, opts?: RequestInit) {
  const r = await fetch(url, opts);
  const t = await r.text();
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(t);
  } catch {
    j = { raw: t };
  }
  if (!r.ok) {
    const err = j.error as Record<string, string> | undefined;
    const msg =
      err?.message ||
      err?.error_description ||
      (j.error_description as string) ||
      (j.title as string) ||
      'HTTP ' + r.status;
    throw new Error(msg);
  }
  return j;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generatePkce() {
  const { randomBytes, webcrypto } = await import('crypto');
  const verifier = b64url(randomBytes(32));
  const digest = await webcrypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return { verifier, challenge: b64url(Buffer.from(digest)) };
}

export function generateState(): string {
  const { randomBytes } = require('crypto') as typeof import('crypto');
  return b64url(randomBytes(16));
}
