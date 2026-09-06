import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  PLATFORM_CONFIGS,
  redirectUri,
  fetchJson,
} from '@/lib/platforms';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const P = PLATFORM_CONFIGS[platform];
  if (!P) {
    return NextResponse.redirect(
      new URL('/console/clients?error=unknown_platform', request.url)
    );
  }

  const q = request.nextUrl.searchParams;
  const code = q.get('code');
  const err = q.get('error') || q.get('error_description');

  if (err) {
    return NextResponse.redirect(
      new URL(`/console/clients?error=${encodeURIComponent(err)}`, request.url)
    );
  }

  const jar = await cookies();
  const raw = jar.get('oauth_state')?.value;
  if (!raw) {
    return NextResponse.redirect(
      new URL('/console/clients?error=missing_state', request.url)
    );
  }

  let entry: {
    state: string;
    platform: string;
    clientId: string;
    verifier: string;
    exp: number;
  };
  try {
    entry = JSON.parse(raw);
  } catch {
    return NextResponse.redirect(
      new URL('/console/clients?error=bad_state', request.url)
    );
  }

  jar.delete('oauth_state');

  const reqState = q.get('state');
  if (
    reqState !== entry.state ||
    entry.platform !== platform ||
    entry.exp < Date.now()
  ) {
    return NextResponse.redirect(
      new URL('/console/clients?error=invalid_state', request.url)
    );
  }

  try {
    let tokenData: Record<string, unknown> = {};
    let handle = '';

    if (platform === 'FB' || platform === 'IG') {
      const tr = await fetchJson(
        'https://graph.facebook.com/v21.0/oauth/access_token?' +
          new URLSearchParams({
            client_id: P.clientId()!,
            client_secret: P.clientSecret()!,
            redirect_uri: redirectUri(platform),
            code: code!,
          })
      );
      const userTok = tr.access_token as string;

      const ll = await fetchJson(
        'https://graph.facebook.com/v21.0/oauth/access_token?' +
          new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: P.clientId()!,
            client_secret: P.clientSecret()!,
            fb_exchange_token: userTok,
          })
      );
      const longTok = (ll.access_token as string) || userTok;

      const pages = await fetchJson(
        'https://graph.facebook.com/v21.0/me/accounts?fields=name,access_token,instagram_business_account&access_token=' +
          longTok
      );
      const pageList = (pages.data as Array<Record<string, unknown>>) || [];
      const page = pageList[0];
      if (!page) throw new Error('No Facebook Page found for this user');

      if (platform === 'FB') {
        tokenData = { pageId: page.id, pageToken: page.access_token };
        handle = page.name as string;
      } else {
        const igAccount = page.instagram_business_account as Record<string, string> | undefined;
        const igId = igAccount?.id;
        if (!igId) throw new Error('No Instagram Business account linked to the Page');
        tokenData = { igId, pageToken: page.access_token };
        handle = '@instagram';
      }
    } else if (platform === 'X') {
      const tr = await fetchJson('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(P.clientId()! + ':' + P.clientSecret()!).toString('base64'),
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code!,
          redirect_uri: redirectUri('X'),
          code_verifier: entry.verifier,
          client_id: P.clientId()!,
        }).toString(),
      });
      tokenData = {
        accessToken: tr.access_token,
        refreshToken: tr.refresh_token,
      };
      const me = await fetchJson('https://api.twitter.com/2/users/me', {
        headers: { Authorization: 'Bearer ' + tr.access_token },
      });
      const meData = me.data as Record<string, string> | undefined;
      handle = meData ? '@' + meData.username : '@x';
    } else if (platform === 'LI') {
      const tr = await fetchJson(
        'https://www.linkedin.com/oauth/v2/accessToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code!,
            redirect_uri: redirectUri('LI'),
            client_id: P.clientId()!,
            client_secret: P.clientSecret()!,
          }).toString(),
        }
      );
      const me = await fetchJson(
        'https://api.linkedin.com/v2/userinfo',
        {
          headers: { Authorization: 'Bearer ' + tr.access_token },
        }
      );
      tokenData = {
        accessToken: tr.access_token,
        personUrn: 'urn:li:person:' + ((me.sub as string) || ''),
      };
      handle = (me.name as string) || 'LinkedIn';
    } else if (platform === 'TT') {
      const tr = await fetchJson(
        'https://open.tiktokapis.com/v2/oauth/token/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: P.clientId()!,
            client_secret: P.clientSecret()!,
            code: code!,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri('TT'),
          }).toString(),
        }
      );
      tokenData = {
        accessToken: tr.access_token,
        openId: tr.open_id,
      };
      handle = 'TikTok';
    }

    const admin = createAdminClient();
    await admin.from('social_accounts').upsert(
      {
        client_id: entry.clientId,
        platform,
        connected: true,
        is_real: true,
        handle,
        access_token: JSON.stringify(tokenData),
        meta: tokenData,
      },
      { onConflict: 'client_id,platform' }
    );

    return NextResponse.redirect(
      new URL(`/console/clients?connected=${platform}`, request.url)
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth failed';
    return NextResponse.redirect(
      new URL(`/console/clients?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
