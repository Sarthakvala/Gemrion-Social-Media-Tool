import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState, StatusPill } from '@/components/ui';
import { NewReel } from '@/components/video/NewReel';
import { formatBytes } from '@/lib/assets/paths';
import type { AssetRow } from '@/lib/assets/repo';
import { workerLastSeen, type Job } from '@/lib/jobs/types';
import { listReels } from '@/lib/video/reels';
import { totalSeconds } from '@/lib/video/timing';
import { reelScriptPlaybook } from '@/lib/playbooks/reelScript';

export const metadata: Metadata = { title: 'Video & reels' };

const PIPELINE = [
  { step: 'Hooks', href: '/console/playbooks?pb=viral-hook-writer', note: '10 openings across 7 angles' },
  { step: 'Script', href: '#new-reel', note: 'reel-scripter: beats, on-screen text, visuals' },
  { step: 'Edit', note: 'beats, timing and format, in the brand look' },
  { step: 'Render', note: 'Remotion on the local worker, MP4 into Assets' },
  { step: 'Caption', href: '/console/playbooks?pb=caption-and-hashtags', note: 'caption, tiered hashtags, first comment' },
  { step: 'Approve', href: '/console/assets?kind=reel', note: 'client review in the portal' },
];

export default async function VideoPage() {
  const profile = await requireAgency();
  const admin = createAdminClient();

  const [{ data: clients }, reels, { data: videos }, { data: lastWorker }] = await Promise.all([
    admin.from('clients').select('id, name').order('name'),
    listReels(admin),
    admin.from('assets').select('*, clients(name, color)').in('kind', ['video', 'reel']).order('created_at', { ascending: false }).limit(24),
    admin.from('jobs').select('runner, status, attempts, locked_at, finished_at').eq('runner', 'worker').gt('attempts', 0).order('updated_at', { ascending: false }).limit(20),
  ]);
  const seen = workerLastSeen((lastWorker ?? []) as Pick<Job, 'runner' | 'status' | 'attempts' | 'locked_at' | 'finished_at'>[]);
  const files = (videos ?? []) as AssetRow[];

  return (
    <Shell profile={profile} groups={consoleNav('video')}>
      <h1 className="text-[22px] font-semibold tracking-tight">Video & reels</h1>
      <p className="text-muted text-[13.5px] mt-1 mb-5 max-w-[720px]">
        Brand-templated reels: script with AI or write by hand, edit the beats, render to MP4 on the agency PC, then send for approval. Renders need the worker running (worker last seen{' '}
        {seen ? new Date(seen).toLocaleString() : 'never'}).
      </p>

      <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {PIPELINE.map((p, i) => {
          const body = (
            <>
              <span className="mono text-faint">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-medium text-[13.5px]">{p.step}</span>
              <span className="text-muted text-[12px]">{p.note}</span>
            </>
          );
          return (
            <li key={p.step} className="border border-line rounded-lg p-3 flex flex-col gap-1 bg-panel">
              {p.href ? (
                <Link href={p.href} className="flex flex-col gap-1 hover:text-ink">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>

      <div id="new-reel" className="mb-6">
        {(clients ?? []).length ? <NewReel clients={clients ?? []} fields={reelScriptPlaybook.fields} /> : <EmptyState title="Add a brand first" />}
      </div>

      <h2 className="lbl mb-2">Reels</h2>
      {reels.length === 0 ? (
        <EmptyState title="No reels yet" hint="Start one above." />
      ) : (
        <div className="panel divide-y divide-line mb-6">
          {reels.map((r) => (
            <Link key={r.id} href={`/console/video/${r.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-canvas">
              <span className="text-[13.5px] font-medium truncate flex-1">{r.title}</span>
              <span className="mono text-faint">{r.clients?.name}</span>
              <span className="mono text-faint hidden sm:inline">
                {r.spec.aspect} · {totalSeconds(r.spec.beats ?? []).toFixed(0)}s
              </span>
              {r.render ? <StatusPill value={r.render.status} /> : <span className="pill pill-draft">draft</span>}
            </Link>
          ))}
        </div>
      )}

      <h2 className="lbl mb-2">Video and reel files</h2>
      {files.length === 0 ? (
        <EmptyState title="No videos yet" hint="Rendered reels and uploaded videos appear here." />
      ) : (
        <div className="panel divide-y divide-line">
          {files.map((a) => (
            <Link key={a.id} href={`/console/assets/${a.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-canvas">
              <span className="text-[13.5px] font-medium truncate flex-1">{a.title}</span>
              <span className="mono text-faint">{a.clients?.name}</span>
              <span className="mono text-faint hidden sm:inline">
                {a.kind} · v{a.version} · {formatBytes(a.bytes)}
              </span>
              <StatusPill value={a.approval} />
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
