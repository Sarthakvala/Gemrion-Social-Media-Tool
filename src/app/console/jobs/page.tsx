import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState, StatusPill } from '@/components/ui';
import { failStaleAppJobs, listJobs, spendSince } from '@/lib/jobs/repo';
import { canCancel, canRetry, durationMs, workerLastSeen, type Job } from '@/lib/jobs/types';
import { cancelJob, retryJob, sendWorkerPing } from './actions';

export const metadata: Metadata = { title: 'Jobs' };

function money(n: number | null): string {
  return n === null ? 'n/a' : `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function seconds(job: Job): string {
  const ms = durationMs(job);
  return ms === null ? '' : `${(ms / 1000).toFixed(1)}s`;
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const profile = await requireAgency();
  const { client } = await searchParams;
  const admin = createAdminClient();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  await failStaleAppJobs(admin);
  const [{ data: clients }, jobs, monthCosts] = await Promise.all([
    admin.from('clients').select('id, name').order('name'),
    listJobs(admin, { clientId: client }),
    spendSince(admin, monthStart.toISOString()),
  ]);

  const scoped = client ? monthCosts.filter((r) => r.client_id === client) : monthCosts;
  const spend = scoped.reduce((n, r) => n + r.cost_usd, 0);
  const unpriced = scoped.reduce((n, r) => n + r.unpriced_jobs, 0);
  const queued = jobs.filter((j) => j.runner === 'worker' && j.status === 'queued').length;
  const seen = workerLastSeen(jobs);

  return (
    <Shell profile={profile} groups={consoleNav('jobs')}>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Jobs</h1>
          <p className="mono text-muted mt-1">
            AI spend this month {money(spend)}
            {unpriced > 0 && ` (+${unpriced} unpriced)`} · {queued} waiting for the worker · worker last seen{' '}
            {seen ? new Date(seen).toLocaleString() : 'never'}
          </p>
        </div>
        <form action={sendWorkerPing} className="flex items-center gap-2">
          <select name="client_id" defaultValue={client ?? clients?.[0]?.id}>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn-sm">Test the worker</button>
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center mb-4">
        <span className="lbl mr-1">Brand</span>
        <Link href="/console/jobs" className={`btn btn-sm ${client ? 'btn-ghost' : ''}`}>
          All
        </Link>
        {(clients ?? []).map((c) => (
          <Link key={c.id} href={`/console/jobs?client=${c.id}`} className={`btn btn-sm ${client === c.id ? '' : 'btn-ghost'}`}>
            {c.name}
          </Link>
        ))}
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No jobs yet" hint="Every AI run and worker task shows up here with its cost." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left border-b border-line">
                {['When', 'Brand', 'Job', 'Runs on', 'Status', 'Tokens in/out', 'Cost', 'Time', ''].map((h) => (
                  <th key={h} className="lbl px-3 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-3 py-2 mono text-faint whitespace-nowrap">{new Date(j.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{j.clients?.name ?? '-'}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{j.playbook || j.kind}</div>
                    {j.error && <div className="mono text-failed mt-0.5 max-w-[360px] break-words">{j.error}</div>}
                  </td>
                  <td className="px-3 py-2 mono">
                    {j.runner}
                    {j.runner === 'worker' && j.attempts > 0 && ` · try ${j.attempts}/${j.max_attempts}`}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill value={j.status} />
                  </td>
                  <td className="px-3 py-2 mono whitespace-nowrap">
                    {j.input_tokens.toLocaleString()} / {j.output_tokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 mono" title={j.model}>
                    {j.input_tokens || j.output_tokens ? money(j.cost_usd) : ''}
                  </td>
                  <td className="px-3 py-2 mono">{seconds(j)}</td>
                  <td className="px-3 py-2">
                    {canRetry(j) && (
                      <form action={retryJob}>
                        <input type="hidden" name="id" value={j.id} />
                        <button className="btn btn-ghost btn-sm">Retry</button>
                      </form>
                    )}
                    {canCancel(j) && (
                      <form action={cancelJob}>
                        <input type="hidden" name="id" value={j.id} />
                        <button className="btn btn-ghost btn-sm">Cancel</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
