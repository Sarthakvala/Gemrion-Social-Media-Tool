import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState, StatusPill } from '@/components/ui';
import { AssetUploader } from '@/components/assets/AssetUploader';
import { AssetPreview } from '@/components/assets/AssetPreview';
import { signAssetUrls, type AssetRow } from '@/lib/assets/repo';
import { ASSET_KINDS, formatBytes, isAssetKind } from '@/lib/assets/paths';
import type { Approval } from '@/lib/types';

export const metadata: Metadata = { title: 'Assets' };

const APPROVALS: Approval[] = ['pending', 'approved', 'changes_requested'];
const PAGE_SIZE = 120;

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; kind?: string; approval?: string }>;
}) {
  const profile = await requireAgency();
  const params = await searchParams;
  const admin = createAdminClient();

  let query = admin.from('assets').select('*, clients(name, color)').order('created_at', { ascending: false }).limit(PAGE_SIZE);
  if (params.client) query = query.eq('client_id', params.client);
  if (params.kind && isAssetKind(params.kind)) query = query.eq('kind', params.kind);
  if (params.approval && APPROVALS.includes(params.approval as Approval)) query = query.eq('approval', params.approval);

  const [{ data: clients }, { data: rows }] = await Promise.all([admin.from('clients').select('id, name').order('name'), query]);
  const assets = (rows ?? []) as AssetRow[];
  const urls = await signAssetUrls(admin, assets.filter((a) => a.mime.startsWith('image/')));

  const filterHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(Object.entries({ ...params, ...patch }).filter((e): e is [string, string] => !!e[1]));
    const qs = next.toString();
    return qs ? `/console/assets?${qs}` : '/console/assets';
  };

  return (
    <Shell profile={profile} groups={consoleNav('assets')}>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Assets</h1>
          <p className="mono text-muted mt-1">
            {assets.length} file{assets.length === 1 ? '' : 's'}
            {assets.length === PAGE_SIZE && ' (latest shown)'} · images, slides, videos, reels and documents per brand
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="lbl mr-1">Brand</span>
            <Link href={filterHref({ client: undefined })} className={`btn btn-sm ${params.client ? 'btn-ghost' : ''}`}>
              All
            </Link>
            {(clients ?? []).map((c) => (
              <Link key={c.id} href={filterHref({ client: c.id })} className={`btn btn-sm ${params.client === c.id ? '' : 'btn-ghost'}`}>
                {c.name}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="lbl mr-1">Status</span>
            <Link href={filterHref({ approval: undefined })} className={`btn btn-sm ${params.approval ? 'btn-ghost' : ''}`}>
              Any
            </Link>
            {APPROVALS.map((a) => (
              <Link key={a} href={filterHref({ approval: a })} className={`btn btn-sm ${params.approval === a ? '' : 'btn-ghost'}`}>
                {a.replace('_', ' ')}
              </Link>
            ))}
            <span className="lbl ml-3 mr-1">Kind</span>
            <Link href={filterHref({ kind: undefined })} className={`btn btn-sm ${params.kind ? 'btn-ghost' : ''}`}>
              Any
            </Link>
            {ASSET_KINDS.map((k) => (
              <Link key={k} href={filterHref({ kind: k })} className={`btn btn-sm ${params.kind === k ? '' : 'btn-ghost'}`}>
                {k}
              </Link>
            ))}
          </div>

          {assets.length === 0 ? (
            <EmptyState title="No files yet" hint="Upload brand files here. Rendered slides and videos from the worker land here too." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {assets.map((a) => (
                <Link key={a.id} href={`/console/assets/${a.id}`} className="panel p-2 flex flex-col gap-2 hover:border-line-2 transition">
                  <AssetPreview asset={a} url={urls[a.id]} compact />
                  <div className="px-1 pb-1 flex flex-col gap-1">
                    <span className="text-[13px] font-medium truncate">{a.title}</span>
                    <span className="mono text-faint truncate">
                      {a.clients?.name ?? 'brand'} · {a.kind} · v{a.version} · {formatBytes(a.bytes)}
                    </span>
                    <StatusPill value={a.approval} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <AssetUploader clients={clients ?? []} />
      </div>
    </Shell>
  );
}
