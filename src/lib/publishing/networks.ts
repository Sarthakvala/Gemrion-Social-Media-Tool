/**
 * Every network AgencyFlow can publish to, and what each one allows. This is
 * the single source for limits and capabilities: the composer, the validator
 * and the publisher all read from here. Mirrors the network check on
 * public.channels (supabase/009_publishing.sql).
 */

export const NETWORK_IDS = [
  'bluesky',
  'mastodon',
  'telegram',
  'discord',
  'facebook',
  'instagram',
  'threads',
  'x',
  'linkedin',
  'linkedin_page',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'google_business',
] as const;
export type NetworkId = (typeof NETWORK_IDS)[number];

/** How a channel is connected. Only `oauth` needs a developer app registered with the network. */
export type AuthKind = 'app_password' | 'instance_oauth' | 'bot_token' | 'webhook' | 'oauth';

export interface NetworkSpec {
  id: NetworkId;
  name: string;
  auth: AuthKind;
  /** Env vars that must be set before this network can be connected (developer app credentials). */
  appEnv: readonly string[];
  /** Max post length, counted the way the network counts it. */
  textLimit: number;
  /** Caption limit when media is attached, if different (e.g. Telegram). */
  captionLimit?: number;
  maxImages: number;
  maxImageBytes: number;
  video: boolean;
  /** Post cannot be text only. */
  mediaRequired: boolean;
  /** Network counts user-perceived characters (graphemes) rather than UTF-16 units. */
  countsGraphemes: boolean;
  /** Can a first comment / reply be added after publishing. */
  firstComment: boolean;
}

const MB = 1024 * 1024;

const SPECS: Record<NetworkId, Omit<NetworkSpec, 'id'>> = {
  bluesky: { name: 'Bluesky', auth: 'app_password', appEnv: [], textLimit: 300, maxImages: 4, maxImageBytes: 976_560, video: false, mediaRequired: false, countsGraphemes: true, firstComment: true },
  mastodon: { name: 'Mastodon', auth: 'instance_oauth', appEnv: [], textLimit: 500, maxImages: 4, maxImageBytes: 16 * MB, video: false, mediaRequired: false, countsGraphemes: true, firstComment: true },
  telegram: { name: 'Telegram', auth: 'bot_token', appEnv: [], textLimit: 4096, captionLimit: 1024, maxImages: 10, maxImageBytes: 10 * MB, video: false, mediaRequired: false, countsGraphemes: false, firstComment: false },
  discord: { name: 'Discord', auth: 'webhook', appEnv: [], textLimit: 2000, maxImages: 10, maxImageBytes: 10 * MB, video: false, mediaRequired: false, countsGraphemes: false, firstComment: false },
  facebook: { name: 'Facebook Page', auth: 'oauth', appEnv: ['META_APP_ID', 'META_APP_SECRET'], textLimit: 63_206, maxImages: 10, maxImageBytes: 10 * MB, video: true, mediaRequired: false, countsGraphemes: false, firstComment: true },
  instagram: { name: 'Instagram', auth: 'oauth', appEnv: ['META_APP_ID', 'META_APP_SECRET'], textLimit: 2200, maxImages: 10, maxImageBytes: 8 * MB, video: true, mediaRequired: true, countsGraphemes: false, firstComment: true },
  threads: { name: 'Threads', auth: 'oauth', appEnv: ['THREADS_APP_ID', 'THREADS_APP_SECRET'], textLimit: 500, maxImages: 10, maxImageBytes: 8 * MB, video: true, mediaRequired: false, countsGraphemes: false, firstComment: true },
  x: { name: 'X', auth: 'oauth', appEnv: ['X_CLIENT_ID', 'X_CLIENT_SECRET'], textLimit: 280, maxImages: 4, maxImageBytes: 5 * MB, video: true, mediaRequired: false, countsGraphemes: true, firstComment: true },
  linkedin: { name: 'LinkedIn profile', auth: 'oauth', appEnv: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'], textLimit: 3000, maxImages: 9, maxImageBytes: 10 * MB, video: true, mediaRequired: false, countsGraphemes: false, firstComment: true },
  linkedin_page: { name: 'LinkedIn page', auth: 'oauth', appEnv: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'], textLimit: 3000, maxImages: 9, maxImageBytes: 10 * MB, video: true, mediaRequired: false, countsGraphemes: false, firstComment: true },
  tiktok: { name: 'TikTok', auth: 'oauth', appEnv: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'], textLimit: 2200, maxImages: 35, maxImageBytes: 20 * MB, video: true, mediaRequired: true, countsGraphemes: false, firstComment: false },
  youtube: { name: 'YouTube', auth: 'oauth', appEnv: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'], textLimit: 5000, maxImages: 0, maxImageBytes: 0, video: true, mediaRequired: true, countsGraphemes: false, firstComment: true },
  pinterest: { name: 'Pinterest', auth: 'oauth', appEnv: ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'], textLimit: 500, maxImages: 5, maxImageBytes: 20 * MB, video: true, mediaRequired: true, countsGraphemes: false, firstComment: false },
  reddit: { name: 'Reddit', auth: 'oauth', appEnv: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'], textLimit: 40_000, maxImages: 20, maxImageBytes: 20 * MB, video: true, mediaRequired: false, countsGraphemes: false, firstComment: true },
  google_business: { name: 'Google Business Profile', auth: 'oauth', appEnv: ['GOOGLE_BUSINESS_CLIENT_ID', 'GOOGLE_BUSINESS_CLIENT_SECRET'], textLimit: 1500, maxImages: 1, maxImageBytes: 5 * MB, video: false, mediaRequired: false, countsGraphemes: false, firstComment: false },
};

export function network(id: NetworkId): NetworkSpec {
  return { id, ...SPECS[id] };
}

export const NETWORKS: readonly NetworkSpec[] = NETWORK_IDS.map(network);

export function isNetworkId(value: string): value is NetworkId {
  return (NETWORK_IDS as readonly string[]).includes(value);
}

/** True when the network can be connected right now: no app needed, or its app credentials are configured. */
export function isAvailable(spec: Pick<NetworkSpec, 'appEnv'>, env: Record<string, string | undefined> = process.env): boolean {
  return spec.appEnv.every((k) => !!env[k]?.trim());
}

export function needsDeveloperApp(spec: Pick<NetworkSpec, 'auth'>): boolean {
  return spec.auth === 'oauth';
}
