import { NextRequest, NextResponse } from 'next/server';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  await requireAgency();
  const { platform } = await params;

  const body = await request.json();
  const clientId = body.client_id;
  if (!clientId) {
    return NextResponse.json({ error: 'Missing client_id' }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from('social_accounts')
    .update({
      connected: false,
      is_real: false,
      access_token: null,
      refresh_token: null,
      meta: {},
    })
    .eq('client_id', clientId)
    .eq('platform', platform);

  return NextResponse.json({ ok: true });
}
