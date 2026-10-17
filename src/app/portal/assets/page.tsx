import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { portalNav } from '@/lib/nav';
import { EmptyState, StatusPill } from '@/components/ui';
import { AssetPreview } from '@/components/assets/AssetPreview';
import { signAssetUrls, type AssetRow } from '@/lib/assets/repo';

export const metadata: Metadata = { title: 'Files' };

export default async function PortalAssetsPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  // RLS scopes this to the client's own brands; only the latest version of each file is listed.
  const { data } = await supabase.from('assets').select('*, clients(name, color)').order('created_at', { ascending: false }).limit(200);
  const all = (data ?? []) as AssetRow[];
  const replaced = new Set(all.map((a) => a.parent_id).filter(Boolean));
  const assets = all.filter((a) => !replaced.has(a.id));
  const waiting = assets.filter((a) => a.approval === 'pending').length;

  // signing only rows RLS already returned to this user
  const urls = await signAssetUrls(createAdminClient(), assets.filter((a) => a.mime.startsWith('image/')));

  return (
    <Shell profile={profile} nav={portalNav('files')}>
      <h1 className="text-[22px] font-semibold tracking-tight">Files</h1>
      <p className="text-muted text-[13.5px] mt-1 mb-5">Creatives, videos and documents from your agency. Approve them or ask for changes.</p>

      {waiting > 0 && (
        <div className="panel p-3.5 mb-5 border-l-[3px] border-l-accent">
          <span className="lbl">Waiting on you</span>
          <p className="text-[13.5px] mt-1">
            {waiting} file{waiting > 1 ? 's' : ''} need{waiting > 1 ? '' : 's'} your review.
          </p>
        </div>
      )}

      {assets.length === 0 ? (
        <EmptyState title="No files yet" hint="Your agency has not shared any files with this account." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {assets.map((a) => (
            <Link key={a.id} href={`/portal/assets/${a.id}`} className="panel p-2 flex flex-col gap-2 hover:border-line-2 transition">
              <AssetPreview asset={a} url={urls[a.id]} compact />
              <div className="px-1 pb-1 flex flex-col gap-1">
                <span className="text-[13px] font-medium truncate">{a.title}</span>
                <span className="mono text-faint truncate">
                  {a.kind}
                  {a.version > 1 ? ` · v${a.version}` : ''}
                </span>
                <StatusPill value={a.approval} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
