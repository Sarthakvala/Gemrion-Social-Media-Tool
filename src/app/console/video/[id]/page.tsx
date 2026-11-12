import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { StatusPill } from '@/components/ui';
import { ReelEditor } from '@/components/video/ReelEditor';
import { getReel } from '@/lib/video/reels';
import { isInFlight } from '@/lib/jobs/types';
import { ReelSpecSchema, specProblem } from '@/lib/video/spec';
import { totalSeconds } from '@/lib/video/timing';
import { signAssetUrls } from '@/lib/assets/repo';
import { formatBytes } from '@/lib/assets/paths';
import type { Asset } from '@/lib/types';
import type { ReelScript } from '@/lib/playbooks/reelScript';
import { queueRender } from '../actions';

const STATUS_NOTE: Record<string, string> = {
  queued: 'Waiting for the worker on the agency PC. It starts within seconds when the worker is running.',
  running: 'Rendering on the worker. A 30-second reel takes about 2-4 minutes.',
  failed: 'The render failed. Fix the reel if the error says so, then render again.',
  canceled: 'The render was canceled.',
};

export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAgency();
  const { id } = await params;
  const admin = createAdminClient();
  const reel = await getReel(admin, id);
  if (!reel) notFound();

  const parsed = ReelSpecSchema.safeParse(reel.spec);
  const { data: renders } = await admin.from('assets').select('*').eq('meta->>reel_id', reel.id).order('created_at', { ascending: false }).limit(10);
  const files = (renders ?? []) as Asset[];
  const urls = await signAssetUrls(admin, files);
  const latest = files[0];
  const busy = isInFlight(reel.render);
  const script = reel.script as Partial<ReelScript>;

  return (
    <Shell profile={profile} groups={consoleNav('video')}>
      <Link href="/console/video" className="mono text-muted hover:text-ink">
        ← video & reels
      </Link>
      <div className="flex items-center gap-3 mt-2 mb-5 flex-wrap">
        <h1 className="text-[22px] font-semibold tracking-tight">{reel.title}</h1>
        <span className="mono text-faint">
          {reel.clients?.name} · {reel.spec.aspect} · {parsed.success ? `${totalSeconds(reel.spec.beats).toFixed(1)}s` : 'invalid'}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        {parsed.success ? (
          <ReelEditor key={reel.updated_at} id={reel.id} spec={parsed.data} />
        ) : (
          <div className="panel p-4 mono text-failed">This reel cannot be edited: {specProblem(reel.spec)}</div>
        )}

        <div className="flex flex-col gap-4">
          <div className="panel p-4 flex flex-col gap-3">
            <span className="lbl">Render</span>
            {reel.render ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <StatusPill value={reel.render.status} />
                  <span className="mono text-faint">try {reel.render.attempts}/{reel.render.max_attempts}</span>
                </div>
                {STATUS_NOTE[reel.render.status] && <p className="text-muted text-[13px]">{STATUS_NOTE[reel.render.status]}</p>}
                {reel.render.error && <p className="mono text-failed break-words">{reel.render.error}</p>}
              </div>
            ) : (
              <p className="text-muted text-[13px]">Not rendered yet. Save your edits, then render; the MP4 lands in Assets for approval.</p>
            )}
            <form action={queueRender}>
              <input type="hidden" name="id" value={reel.id} />
              <button className="btn btn-accent btn-sm" disabled={busy || !parsed.success}>
                {busy ? 'Render in progress' : latest ? 'Render again' : 'Render MP4'}
              </button>
            </form>
            <p className="mono text-faint">Renders the last saved version.</p>
          </div>

          {latest && (
            <div className="panel p-3 flex flex-col gap-2">
              {urls[latest.id] && <video src={urls[latest.id]} controls preload="metadata" className="w-full rounded-lg bg-black" />}
              <div className="flex items-center gap-2">
                <StatusPill value={latest.approval} />
                <span className="mono text-faint">
                  v{latest.version} · {formatBytes(latest.bytes)}
                </span>
                <Link href={`/console/assets/${latest.id}`} className="btn btn-ghost btn-sm ml-auto">
                  Open asset
                </Link>
              </div>
              {files.length > 1 && <span className="mono text-faint">{files.length - 1} earlier render(s) in Assets</span>}
            </div>
          )}

          {script.beats?.length ? (
            <details className="panel p-4">
              <summary className="lbl cursor-pointer">Script (spoken lines, caption)</summary>
              <ol className="mt-3 flex flex-col gap-2 text-[13px]">
                {script.beats.map((b, i) => (
                  <li key={i}>
                    <span className="mono text-faint">{b.part}</span> {b.spoken}
                    {b.visual && <div className="text-muted">Visual: {b.visual}</div>}
                  </li>
                ))}
              </ol>
              {script.caption && <p className="text-[13px] mt-3 whitespace-pre-wrap">{script.caption}</p>}
            </details>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
