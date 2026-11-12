import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publishDue } from '@/lib/publishing/engine';

// Called every minute by Supabase pg_cron (supabase/010_publish_cron.sql) and once a
// day by Vercel Cron as a fallback. Publishing is idempotent per target, so overlapping
// calls are safe: claim_due_targets hands each target to one run only.
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get('authorization') ?? '';
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const report = await publishDue(createAdminClient(), { deadline: Date.now() + 50_000 });
    return NextResponse.json(report);
  } catch (e) {
    console.error('[cron/publish]', e);
    return NextResponse.json({ error: 'Publishing run failed.' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
