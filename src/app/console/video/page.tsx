import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState, StatusPill } from '@/components/ui';
import { PhaseIntro } from '@/components/PhaseIntro';
import { formatBytes } from '@/lib/assets/paths';
import type { AssetRow } from '@/lib/assets/repo';
import { workerLastSeen, type Job } from '@/lib/jobs/types';

export const metadata: Metadata = { title: 'Video & reels' };

const PIPELINE = [
  { step: 'Hooks', status: 'live', href: '/console/playbooks?pb=viral-hook-writer', note: '10 openings across 7 angles' },
  { step: 'Script + shot list', status: 'phase 2', note: 'reel-scripter, b-roll-shot-list, on-screen text' },
  { step: 'Render', status: 'phase 2', note: 'Remotion on the local worker, brand fonts and palette' },
  { step: 'Cover + caption', status: 'live', href: '/console/playbooks?pb=caption-and-hashtags', note: 'caption, tiered hashtags, first comment' },
  { step: 'Approve', status: 'live', href: '/console/assets?kind=reel', note: 'client review in the portal' },
];

export default async function VideoPage() {
  const profile = await requireAgency();
  const admin = createAdminClient();

  const [{ data: videos }, { data: lastWorker }] = await Promise.all([
    admin.from('assets').select('*, clients(name, color)').in('kind', ['video', 'reel']).order('created_at', { ascending: false }).limit(24),
    admin.from('jobs').select('runner, status, attempts, locked_at, finished_at').eq('runner', 'worker').gt('attempts', 0).order('updated_at', { ascending: false }).limit(20),
  ]);
  const seen = workerLastSeen((lastWorker ?? []) as Pick<Job, 'runner' | 'status' | 'attempts' | 'locked_at' | 'finished_at'>[]);
  const rows = (videos ?? []) as AssetRow[];

  return (
    <Shell profile={profile} groups={consoleNav('video')}>
      <PhaseIntro
        title="Video & reels"
        phase="phase 2"
        lead="Brand-templated reels rendered on your own machine: hook, script, render, caption, approval. Hooks, captions and approval already work; scripting and rendering arrive in phase 2."
        coming={[
          'Reel scripts with beats, on-screen text and a shot list, from your reel skills',
          'Remotion compositions per brand (fonts, palette, logo, captions)',
          'One-click render on the local Docker worker; the file lands in Assets for approval',
          'Templates seeded from the video prompt library',
        ]}
        needs={[
          'Docker Desktop running with the worker container (worker/README.md)',
          'A Remotion company licence if the agency grows past 3 people',
        ]}
      />

      <div className="panel p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <span className="lbl">Reel pipeline</span>
          <span className="mono text-faint">worker last seen {seen ? new Date(seen).toLocaleString() : 'never'}</span>
        </div>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {PIPELINE.map((p, i) => {
            const body = (
              <>
                <span className="mono text-faint">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-medium text-[13.5px]">{p.step}</span>
                <span className="text-muted text-[12.5px]">{p.note}</span>
                <span className={`mono text-[10px] uppercase ${p.status === 'live' ? 'text-published' : 'text-faint'}`}>{p.status}</span>
              </>
            );
            return (
              <li key={p.step} className="border border-line rounded-lg p-3 flex flex-col gap-1">
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
      </div>

      <h2 className="lbl mb-2">Video and reel files</h2>
      {rows.length === 0 ? (
        <EmptyState title="No videos yet" hint="Upload a video or reel in Assets now; rendered reels will appear here in phase 2." />
      ) : (
        <div className="panel divide-y divide-line">
          {rows.map((a) => (
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
