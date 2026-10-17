import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { StatusPill } from '@/components/ui';
import { PlaybookRunner } from '@/components/playbooks/PlaybookRunner';
import { PLAYBOOKS, getPlaybook } from '@/lib/playbooks/registry';
import type { Job } from '@/lib/jobs/types';

export const metadata: Metadata = { title: 'Playbooks' };

const HISTORY = 12;

type RunRow = Pick<Job, 'id' | 'playbook' | 'status' | 'output' | 'error' | 'cost_usd' | 'created_at'> & { clients: { name: string } | null };

export default async function PlaybooksPage({ searchParams }: { searchParams: Promise<{ pb?: string; client?: string }> }) {
  const profile = await requireAgency();
  const params = await searchParams;
  const active = getPlaybook(params.pb ?? '') ?? PLAYBOOKS[0];
  const admin = createAdminClient();

  const [{ data: clients }, { data: runs }] = await Promise.all([
    admin.from('clients').select('id, name').order('name'),
    admin
      .from('jobs')
      .select('id, playbook, status, output, error, cost_usd, created_at, clients(name)')
      .eq('kind', 'playbook')
      .like('playbook', `${active.id}@v%`)
      .order('created_at', { ascending: false })
      .limit(HISTORY),
  ]);

  return (
    <Shell profile={profile} groups={consoleNav('playbooks')}>
      <h1 className="text-[22px] font-semibold tracking-tight">Playbooks</h1>
      <p className="mono text-muted mt-1 mb-5">Your skills, run on a brand kit. Every run is a costed job.</p>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {PLAYBOOKS.map((p) => (
          <Link key={p.id} href={`/console/playbooks?pb=${p.id}${params.client ? `&client=${params.client}` : ''}`} className={`btn btn-sm ${p.id === active.id ? '' : 'btn-ghost'}`}>
            {p.title}
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <PlaybookRunner
          key={active.id}
          playbook={{ id: active.id, title: active.title, summary: active.summary, skill: active.skill, fields: active.fields }}
          clients={clients ?? []}
          defaultClientId={params.client}
        />

        <div className="panel p-4 flex flex-col gap-3">
          <span className="lbl">Recent runs</span>
          {(runs ?? []).length === 0 && <p className="text-muted text-[13px]">No runs yet.</p>}
          {((runs ?? []) as unknown as RunRow[]).map((r) => (
            <details key={r.id} className="border-t border-line pt-2">
              <summary className="cursor-pointer flex items-center gap-2 text-[13px]">
                <StatusPill value={r.status} />
                <span className="truncate">{r.clients?.name ?? 'brand'}</span>
                <span className="mono text-faint ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
              </summary>
              {r.error ? (
                <p className="mono text-failed mt-2">{r.error}</p>
              ) : (
                <pre className="whitespace-pre-wrap text-[12.5px] mt-2 font-sans text-ink-2">{String(r.output?.text ?? '')}</pre>
              )}
            </details>
          ))}
        </div>
      </div>
    </Shell>
  );
}
