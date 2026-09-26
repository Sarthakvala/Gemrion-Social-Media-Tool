import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_PALETTE, emptyBrandProfile, type BrandExample, type BrandProfile } from './types';

export interface LoadedBrand {
  name: string;
  profile: BrandProfile;
  examples: BrandExample[];
}

export function mergeProfile(clientId: string, row: Partial<BrandProfile> | null): BrandProfile {
  const base = emptyBrandProfile(clientId);
  if (!row) return base;
  return {
    ...base,
    ...row,
    pillars: Array.isArray(row.pillars) ? row.pillars : [],
    palette: { ...DEFAULT_PALETTE, ...(row.palette ?? {}) },
  };
}

/**
 * Brand kit for one client. Pass the admin client from agency code paths, or
 * the user's session client where RLS should decide (examples come back empty
 * for client-role users, which is intended).
 */
export async function loadBrand(db: SupabaseClient, clientId: string): Promise<LoadedBrand | null> {
  const [{ data: client }, { data: profile }, { data: examples }] = await Promise.all([
    db.from('clients').select('name').eq('id', clientId).maybeSingle(),
    db.from('brand_profiles').select('*').eq('client_id', clientId).maybeSingle(),
    db.from('brand_examples').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
  ]);
  if (!client) return null;
  return {
    name: client.name as string,
    profile: mergeProfile(clientId, profile as Partial<BrandProfile> | null),
    examples: (examples ?? []) as BrandExample[],
  };
}
