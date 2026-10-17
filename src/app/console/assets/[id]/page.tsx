import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { StatusPill } from '@/components/ui';
import { Comments } from '@/components/Comments';
import { AssetPreview } from '@/components/assets/AssetPreview';
import { AssetUploader } from '@/components/assets/AssetUploader';
import { newerVersion, signAssetUrls, versionHistory, type AssetRow } from '@/lib/assets/repo';
import { formatBytes } from '@/lib/assets/paths';
import { setAssetApproval } from '../actions';
import type { Approval, AssetComment } from '@/lib/types';

const DECISIONS: { value: Approval; label: string }[] = [
  { value: 'approved', label: 'Approve' },
  { value: 'changes_requested', label: 'Needs changes' },
  { value: 'pending', label: 'Reset to pending' },
];

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAgency();
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin.from('assets').select('*, clients(name, color)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const asset = data as AssetRow;

  const [history, newer, { data: comments, error: commentsError }] = await Promise.all([
    versionHistory(admin, asset),
    newerVersion(admin, asset.id),
    admin.from('asset_comments').select('*, profiles(email)').eq('asset_id', id).order('created_at'),
  ]);
  const urls = await signAssetUrls(admin, [asset, ...history]);

  return (
    <Shell profile={profile} groups={consoleNav('assets')}>
      <Link href="/console/assets" className="mono text-muted hover:text-ink">
        ← assets
      </Link>
      <div className="flex items-center gap-3 mt-2 mb-5 flex-wrap">
        <h1 className="text-[22px] font-semibold tracking-tight">{asset.title}</h1>
        <StatusPill value={asset.approval} />
        <span className="mono text-faint">
          {asset.clients?.name} · {asset.kind} · v{asset.version} · {formatBytes(asset.bytes)} · {asset.mime || 'unknown type'}
        </span>
      </div>

      {newer && (
        <div className="panel p-3 mb-4 border-l-[3px] border-l-accent">
          <span className="text-[13.5px]">
            A newer version exists.{' '}
            <Link className="underline" href={`/console/assets/${newer.id}`}>
              Open v{newer.version}
            </Link>
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <div className="panel p-3">
            <AssetPreview asset={asset} url={urls[asset.id]} />
          </div>
          <Comments target="asset" targetId={asset.id} userId={profile.id} comments={(comments ?? []) as AssetComment[]} loadError={commentsError?.message} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel p-4 flex flex-col gap-3">
            <span className="lbl">Approval</span>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((d) => (
                <form key={d.value} action={setAssetApproval}>
                  <input type="hidden" name="id" value={asset.id} />
                  <input type="hidden" name="approval" value={d.value} />
                  <button className={`btn btn-sm ${d.value === 'approved' ? '' : 'btn-ghost'}`} disabled={asset.approval === d.value}>
                    {d.label}
                  </button>
                </form>
              ))}
            </div>
            {asset.approved_at && (
              <span className="mono text-faint">decided {new Date(asset.approved_at).toLocaleString()}</span>
            )}
            {urls[asset.id] && (
              <a className="btn btn-ghost btn-sm self-start" href={urls[asset.id]} target="_blank" rel="noopener noreferrer">
                Open original
              </a>
            )}
          </div>

          {!newer && <AssetUploader clients={[]} clientId={asset.client_id} parentId={asset.id} />}

          {history.length > 0 && (
            <div className="panel p-4 flex flex-col gap-2">
              <span className="lbl">Earlier versions</span>
              {history.map((v) => (
                <Link key={v.id} href={`/console/assets/${v.id}`} className="flex items-center justify-between gap-2 text-[13px] hover:text-ink text-ink-2">
                  <span className="truncate">
                    v{v.version} · {v.title}
                  </span>
                  <StatusPill value={v.approval} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
