import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  PLATFORM_CONFIGS,
  redirectUri,
  generatePkce,
  generateState,
} from '@/lib/platforms';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  await requireAgency();
  const { platform } = await params;

  const P = PLATFORM_CONFIGS[platform];
  if (!P) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 });
  }

  const clientId = request.nextUrl.searchParams.get('client_id');
  if (!clientId) {
    return NextResponse.json({ error: 'Missing client_id' }, { status: 400 });
  }

  if (!P.configured()) {
    const admin = createAdminClient();
    const { error } = await admin.from('social_accounts').upsert(
      {
        client_id: clientId,
        platform,
        connected: true,
        is_real: false,
        handle: 'demo',
      },
      { onConflict: 'client_id,platform' }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.redirect(
      new URL('/console/clients?connected=demo', request.url)
    );
  }

  const state = generateState();
  const oauthParams: Record<string, string> = {
    response_type: 'code',
    client_id: P.clientId()!,
    redirect_uri: redirectUri(platform),
    scope: P.scope,
    state,
  };

  let verifier = '';
  if (P.tiktok) {
    oauthParams.client_key = P.clientId()!;
    delete oauthParams.client_id;
  }
  if (P.pkce) {
    const pk = await generatePkce();
    verifier = pk.verifier;
    oauthParams.code_challenge = pk.challenge;
    oauthParams.code_challenge_method = 'S256';
  }

  const jar = await cookies();
  jar.set('oauth_state', JSON.stringify({
    state,
    platform,
    clientId,
    verifier,
    exp: Date.now() + 10 * 60_000,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = P.authorize + '?' + new URLSearchParams(oauthParams).toString();
  return NextResponse.redirect(url);
}
