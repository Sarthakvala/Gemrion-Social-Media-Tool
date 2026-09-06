import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS and column grants entirely.
 *
 * The 'server-only' import above makes the build fail if this file is ever
 * pulled into a client component, which would leak the secret key.
 *
 * Rule: every route that uses this MUST check the caller is an agency user
 * first (see requireAgency() in src/lib/auth.ts). RLS is not protecting you here.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
