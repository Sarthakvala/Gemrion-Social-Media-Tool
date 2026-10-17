import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UsageTotals } from '@/lib/ai/usage';
import type { Job, JobKind, JobRunner } from './types';

/**
 * Data access for public.jobs. Uses the service key, so every caller must have
 * passed requireAgency() first (the table has no grants for authenticated).
 */

type Admin = ReturnType<typeof createAdminClient>;

export interface NewJob {
  kind: JobKind;
  runner: JobRunner;
  clientId: string | null;
  playbook?: string;
  input?: Record<string, unknown>;
  createdBy: string | null;
  /** App jobs start immediately; worker jobs wait in the queue. */
  startNow?: boolean;
}

export async function createJob(admin: Admin, job: NewJob): Promise<Job> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('jobs')
    .insert({
      kind: job.kind,
      runner: job.runner,
      client_id: job.clientId,
      playbook: job.playbook ?? '',
      input: job.input ?? {},
      created_by: job.createdBy,
      ...(job.startNow ? { status: 'running', started_at: now, attempts: 1 } : {}),
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Could not create job: ${error?.message ?? 'no row'}`);
  return data as Job;
}

function usageColumns(usage: UsageTotals) {
  return {
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: usage.costUsd,
  };
}

export async function finishJob(admin: Admin, id: string, output: Record<string, unknown>, usage: UsageTotals) {
  const { error } = await admin
    .from('jobs')
    .update({ status: 'succeeded', output, error: null, finished_at: new Date().toISOString(), ...usageColumns(usage) })
    .eq('id', id);
  if (error) console.error('[jobs] finish failed', id, error.message);
}

export async function failJob(admin: Admin, id: string, message: string, usage: UsageTotals) {
  const { error } = await admin
    .from('jobs')
    .update({ status: 'failed', error: message.slice(0, 2000), finished_at: new Date().toISOString(), ...usageColumns(usage) })
    .eq('id', id);
  if (error) console.error('[jobs] fail failed', id, error.message);
}

export type JobRow = Job & { clients: { name: string; color: string } | null };

export async function listJobs(admin: Admin, opts: { clientId?: string; limit?: number } = {}): Promise<JobRow[]> {
  let q = admin.from('jobs').select('*, clients(name, color)').order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (opts.clientId) q = q.eq('client_id', opts.clientId);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load jobs: ${error.message}`);
  return (data ?? []) as JobRow[];
}

export async function getJob(admin: Admin, id: string): Promise<Job | null> {
  const { data } = await admin.from('jobs').select('*').eq('id', id).maybeSingle();
  return (data as Job) ?? null;
}

/** Conditional updates: the status filter makes these safe against a worker racing us. */
export async function cancelQueuedJob(admin: Admin, id: string): Promise<boolean> {
  const { data } = await admin
    .from('jobs')
    .update({ status: 'canceled', finished_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'queued')
    .select('id');
  return !!data?.length;
}

export async function requeueJob(admin: Admin, id: string): Promise<boolean> {
  const { data } = await admin
    .from('jobs')
    .update({ status: 'queued', error: null, attempts: 0, finished_at: null, locked_by: null, locked_at: null })
    .eq('id', id)
    .eq('runner', 'worker')
    .in('status', ['failed', 'canceled'])
    .select('id');
  return !!data?.length;
}

export interface BrandSpend {
  client_id: string | null;
  cost_usd: number;
  unpriced_jobs: number;
}

/** Spend per brand since a date, summed in SQL (spend_by_brand, migration 007) so it is never truncated. */
export async function spendSince(admin: Admin, sinceIso: string): Promise<BrandSpend[]> {
  const { data, error } = await admin.rpc('spend_by_brand', { since: sinceIso });
  if (error) throw new Error(`Could not load spend: ${error.message}`);
  return ((data ?? []) as { client_id: string | null; cost_usd: number | string; unpriced_jobs: number | string }[]).map((r) => ({
    client_id: r.client_id,
    cost_usd: Number(r.cost_usd),
    unpriced_jobs: Number(r.unpriced_jobs),
  }));
}

/**
 * App jobs run inside one request. If that request died (timeout, crash), the row
 * stays 'running' forever; after this long it cannot still be alive. Vercel caps
 * functions far below this.
 */
export const APP_JOB_STALE_MINUTES = 20;

export async function failStaleAppJobs(admin: Admin, now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - APP_JOB_STALE_MINUTES * 60_000).toISOString();
  const { error } = await admin
    .from('jobs')
    .update({ status: 'failed', error: 'The request running this job ended before it finished.', finished_at: now.toISOString() })
    .eq('runner', 'app')
    .eq('status', 'running')
    .lt('started_at', cutoff);
  if (error) console.error('[jobs] stale sweep failed', error.message);
}
