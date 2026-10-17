import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sumUsage, type TokenUsage, type UsageListener } from '@/lib/ai/usage';
import { createJob, failJob, finishJob } from './repo';
import type { JobKind } from './types';

export interface TrackedRun {
  kind: JobKind;
  playbook: string;
  clientId: string | null;
  createdBy: string | null;
  input?: Record<string, unknown>;
}

/**
 * Runs an in-app AI task as a recorded job: creates the row, meters every model
 * call through `onUsage`, then stores the outcome, tokens and cost. Errors are
 * recorded and re-thrown so the caller's own error handling is unchanged.
 * Recording problems never break the task itself.
 */
export async function trackJob<T>(
  run: TrackedRun,
  task: (onUsage: UsageListener) => Promise<T>,
  summarize: (result: T) => Record<string, unknown> = () => ({})
): Promise<T> {
  const admin = createAdminClient();
  const calls: TokenUsage[] = [];
  const onUsage: UsageListener = (u) => calls.push(u);

  const job = await createJob(admin, { ...run, runner: 'app', startNow: true }).catch((e: unknown) => {
    console.error('[jobs] could not record job, running untracked', e);
    return null;
  });

  try {
    const result = await task(onUsage);
    if (job) await finishJob(admin, job.id, summarize(result), sumUsage(calls));
    return result;
  } catch (e) {
    if (job) await failJob(admin, job.id, e instanceof Error ? e.message : String(e), sumUsage(calls));
    throw e;
  }
}
