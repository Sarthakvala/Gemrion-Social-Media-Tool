import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Asset } from '@/lib/types';
import { ASSET_BUCKET } from './paths';

/** Signed links expire, so a leaked URL stops working. One hour covers a review session. */
export const VIEW_TTL_SECONDS = 3600;
const MAX_VERSION_DEPTH = 25;

export type AssetRow = Asset & { clients: { name: string; color: string } | null };

/**
 * Signs view URLs for assets the caller has ALREADY been authorized to see
 * (agency, or rows returned by an RLS-scoped query). The admin client is needed
 * only because the bucket is private; it never decides access.
 */
export async function signAssetUrls(admin: SupabaseClient, assets: Pick<Asset, 'id' | 'storage_path'>[]): Promise<Record<string, string>> {
  if (!assets.length) return {};
  const { data, error } = await admin.storage.from(ASSET_BUCKET).createSignedUrls(
    assets.map((a) => a.storage_path),
    VIEW_TTL_SECONDS
  );
  if (error || !data) {
    console.error('[assets] signing failed', error?.message);
    return {};
  }
  const byPath = new Map(data.map((d) => [d.path, d.signedUrl]));
  return Object.fromEntries(assets.flatMap((a) => (byPath.get(a.storage_path) ? [[a.id, byPath.get(a.storage_path)!]] : [])));
}

/** The asset's older versions, newest first, walking parent links. */
export async function versionHistory(db: SupabaseClient, asset: Asset): Promise<Asset[]> {
  const chain: Asset[] = [];
  let parentId = asset.parent_id;
  while (parentId && chain.length < MAX_VERSION_DEPTH) {
    const { data } = await db.from('assets').select('*').eq('id', parentId).maybeSingle();
    if (!data) break;
    chain.push(data as Asset);
    parentId = (data as Asset).parent_id;
  }
  return chain;
}

/** The version that replaced this one, if any. */
export async function newerVersion(db: SupabaseClient, assetId: string): Promise<Pick<Asset, 'id' | 'version'> | null> {
  const { data } = await db.from('assets').select('id, version').eq('parent_id', assetId).order('version', { ascending: false }).limit(1);
  return (data?.[0] as Pick<Asset, 'id' | 'version'>) ?? null;
}
