import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/ai/crypto';
import { siteUrl } from '@/lib/site';
import { checkState, type OAuthState } from './providers/mastodon';

export const MASTODON_STATE_COOKIE = 'af_mastodon_state';
export const MASTODON_STATE_INFO = 'agencyflow/mastodon-state/v1';
const APP_SECRET_INFO = 'agencyflow/mastodon-app/v1';

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function mastodonRedirectUri(): string {
  return new URL('/api/channels/mastodon/callback', siteUrl()).toString();
}

export function sealMastodonSecret(clientSecret: string): string {
  return encryptSecret(clientSecret, secret(), APP_SECRET_INFO);
}

export async function openMastodonApp(db: SupabaseClient, instance: string, redirectUri: string): Promise<{ clientId: string; clientSecret: string } | null> {
  const { data } = await db.from('mastodon_apps').select('client_id, client_secret').eq('instance', instance).eq('redirect_uri', redirectUri).maybeSingle();
  if (!data) return null;
  return { clientId: data.client_id as string, clientSecret: decryptSecret(data.client_secret as string, secret(), APP_SECRET_INFO) };
}

/** Null unless the cookie decrypts (not tampered), has not expired and matches the nonce Mastodon echoed back. */
export function readMastodonState(cookie: string | undefined, echoedNonce: string | null): OAuthState | null {
  if (!cookie) return null;
  try {
    return checkState(decryptSecret(cookie, secret(), MASTODON_STATE_INFO), echoedNonce);
  } catch {
    return null;
  }
}
