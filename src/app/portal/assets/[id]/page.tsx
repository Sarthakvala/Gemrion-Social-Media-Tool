import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { portalNav } from '@/lib/nav';
import { StatusPill } from '@/components/ui';
import { Comments } from '@/components/Comments';
import { AssetPreview } from '@/components/assets/AssetPreview';
import { AssetReview } from '@/components/assets/AssetReview';
import { newerVersion, signAssetUrls } from '@/lib/assets/repo';
import type { Asset, AssetComment } from '@/lib/types';

export default async function PortalAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  // RLS: a client only gets the row if it belongs to one of their brands
  const { data } = await supabase.from('assets').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const asset = data as Asset;

  const [newer, { data: comments, error: commentsError }] = await Promise.all([
    newerVersion(supabase, asset.id),
    supabase.from('asset_comments').select('*, profiles(email)').eq('asset_id', id).order('created_at'),
  ]);
  const urls = await signAssetUrls(createAdminClient(), [asset]);

  return (
    <Shell profile={profile} nav={portalNav('files')}>
      <Link href="/portal/assets" className="mono text-muted hover:text-ink">
        ← files
      </Link>
      <div className="flex items-center gap-3 mt-2 mb-5 flex-wrap">
        <h1 className="text-[22px] font-semibold tracking-tight">{asset.title}</h1>
        <StatusPill value={asset.approval} />
        {asset.version > 1 && <span className="mono text-faint">version {asset.version}</span>}
      </div>

      {newer && (
        <div className="panel p-3 mb-4 border-l-[3px] border-l-accent">
          <span className="text-[13.5px]">
            This file has been updated.{' '}
            <Link className="underline" href={`/portal/assets/${newer.id}`}>
              See the latest version
            </Link>
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="panel p-3">
          <AssetPreview asset={asset} url={urls[asset.id]} />
        </div>
        <div className="flex flex-col gap-4">
          {!newer && (
            <div className="panel p-4 flex flex-col gap-3">
              <span className="lbl">Your decision</span>
              <AssetReview assetId={asset.id} approval={asset.approval} />
              {urls[asset.id] && (
                <a className="btn btn-ghost btn-sm self-start" href={urls[asset.id]} target="_blank" rel="noopener noreferrer">
                  Download
                </a>
              )}
            </div>
          )}
          <Comments target="asset" targetId={asset.id} userId={profile.id} comments={(comments ?? []) as AssetComment[]} loadError={commentsError?.message} />
        </div>
      </div>
    </Shell>
  );
}
