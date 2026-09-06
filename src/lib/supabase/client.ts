'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Browser-side Supabase client. Runs as the signed-in user, so RLS applies. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
