import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveChannel } from '@/lib/publishing/channels';
import { exchangeCode } from '@/lib/publishing/providers/mastodon';
import { MASTODON_STATE_COOKIE, mastodonRedirectUri, openMastodonApp, readMastodonState } from '@/lib/publishing/mastodonState';

/** Step 2 of Mastodon: verify the state, swap the code for a token, save the channel. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = readMastodonState(jar.get(MASTODON_STATE_COOKIE)?.value, url.searchParams.get('state'));
  jar.delete(MASTODON_STATE_COOKIE);

  const profile = await getProfile();
  if (!profile || profile.role !== 'agency') return NextResponse.redirect(new URL('/login', url));
  if (!state) return NextResponse.redirect(new URL('/console/clients?mastodon=expired', url));

  const back = new URL(`/console/clients/${state.clientId}/channels`, url);
  const code = url.searchParams.get('code');
  if (!code) {
    back.searchParams.set('mastodon', 'denied');
    return NextResponse.redirect(back);
  }

  try {
    const admin = createAdminClient();
    const redirectUri = mastodonRedirectUri();
    const app = await openMastodonApp(admin, state.instance, redirectUri);
    if (!app) throw new Error('App registration missing; start again.');
    const ch = await exchangeCode(state.instance, app, code, redirectUri);
    await saveChannel(admin, state.clientId, 'mastodon', ch, profile.id);
    back.searchParams.set('mastodon', 'connected');
  } catch (e) {
    console.error('[mastodon callback]', e);
    back.searchParams.set('mastodon', 'failed');
  }
  return NextResponse.redirect(back);
}
