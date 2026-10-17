/** Mirrors the checks on public.jobs in supabase/004_jobs_assets.sql. */
export const JOB_KINDS = ['playbook', 'video_render', 'worker_ping'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
export type JobRunner = 'app' | 'worker';

export interface Job {
  id: string;
  client_id: string | null;
  kind: JobKind;
  playbook: string;
  runner: JobRunner;
  status: JobStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type JobState = Pick<Job, 'status' | 'runner'>;

export function isFinished(status: JobStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

/** App jobs run inside a request and cannot be resumed, so only worker jobs retry. */
export function canRetry(job: JobState): boolean {
  return job.runner === 'worker' && (job.status === 'failed' || job.status === 'canceled');
}

/** Only jobs nobody has picked up yet can be canceled safely. */
export function canCancel(job: JobState): boolean {
  return job.status === 'queued';
}

/** Wall-clock run time in ms, or null if the job has not started or finished. */
export function durationMs(job: Pick<Job, 'started_at' | 'finished_at'>): number | null {
  if (!job.started_at || !job.finished_at) return null;
  return new Date(job.finished_at).getTime() - new Date(job.started_at).getTime();
}

/**
 * Latest moment a worker demonstrably did something: a heartbeat on a running
 * job (locked_at) or a finish it recorded. locked_at alone is not enough, the
 * worker clears it when a job ends.
 */
export function workerLastSeen(jobs: readonly Pick<Job, 'runner' | 'status' | 'attempts' | 'locked_at' | 'finished_at'>[]): string | null {
  const times = jobs
    .filter((j) => j.runner === 'worker' && j.attempts > 0)
    .flatMap((j) => [j.locked_at, j.status === 'succeeded' || j.status === 'failed' ? j.finished_at : null])
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime());
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}
